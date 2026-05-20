from __future__ import annotations

import calendar
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from attendance.models import AttendanceAuditLog, AttendanceRecord
from attendance.services import (
    ActorContext,
    _sync_legacy_attendance,
    create_audit_log,
    generate_monthly_summary,
    get_active_assignment,
    get_active_office_location,
    get_active_policy,
    snapshot_record,
)
from authentication.models import AdminUser

from .models import (
    Employee,
    EmployeeLeaveBalance,
    LeaveEncashment,
    LeavePolicy,
    LeaveRequest,
    LeaveType,
    MonthlySalaryData,
    Notification,
    SalaryStructure,
)

ZERO = Decimal("0")
ONE = Decimal("1")
DEFAULT_LEAVE_POLICY_NAME = "RDesk Policy"
ACTIVE_LEAVE_STATUSES = ("PENDING", "APPROVED")
LEAVE_CYCLE_START_MONTH = 4
LEAVE_CYCLE_START_DAY = 1
STANDARD_LEAVE_TYPES = (
    {
        "name": "Casual Leave",
        "code": "CL",
        "policy_field": "casual_leave_per_year",
        "is_paid": True,
    },
    {
        "name": "Sick Leave",
        "code": "SL",
        "policy_field": "sick_leave_per_year",
        "is_paid": True,
    },
    {
        "name": "Earned Leave",
        "code": "EL",
        "policy_field": "earned_leave_per_year",
        "is_paid": True,
    },
)
LEAVE_POLICY_BY_NAME = {
    " ".join(policy["name"].lower().split()): policy for policy in STANDARD_LEAVE_TYPES
}
LEAVE_POLICY_BY_CODE = {policy["code"]: policy for policy in STANDARD_LEAVE_TYPES}
LEAVE_POLICY_ORDER = {
    policy["code"]: index for index, policy in enumerate(STANDARD_LEAVE_TYPES)
}


class LeaveManagementError(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = 400,
        payload: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.payload = payload or {}


def _normalize_leave_name(name: str | None) -> str:
    return " ".join((name or "").strip().lower().split())


def _round_days(value: Decimal | int | float | None) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def _round_money(value: Decimal | int | float | None) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _decimal_to_json(value: Decimal | int | float | None) -> int | float:
    decimal_value = Decimal(str(value or 0))
    if decimal_value == decimal_value.to_integral():
        return int(decimal_value)
    return float(decimal_value)


def _month_start(target_date: date) -> date:
    return target_date.replace(day=1)


def _next_month(target_date: date) -> date:
    if target_date.month == 12:
        return date(target_date.year + 1, 1, 1)
    return date(target_date.year, target_date.month + 1, 1)


def iter_leave_dates(start_date: date, end_date: date):
    current = start_date
    while current <= end_date:
        yield current
        current += timedelta(days=1)


def calculate_requested_days(start_date: date, end_date: date) -> Decimal:
    return _round_days((end_date - start_date).days + 1)


def get_leave_year_for_date(target_date: date) -> int:
    return target_date.year if target_date.month >= LEAVE_CYCLE_START_MONTH else target_date.year - 1


def get_leave_cycle_bounds(leave_year: int) -> tuple[date, date]:
    cycle_start = date(leave_year, LEAVE_CYCLE_START_MONTH, LEAVE_CYCLE_START_DAY)
    cycle_end = date(leave_year + 1, LEAVE_CYCLE_START_MONTH, LEAVE_CYCLE_START_DAY) - timedelta(days=1)
    return cycle_start, cycle_end


def get_leave_year_label(leave_year: int) -> str:
    return f"{leave_year}-{str(leave_year + 1)[-2:]}"


def iter_leave_years(start_date: date, end_date: date):
    current_year = get_leave_year_for_date(start_date)
    end_year = get_leave_year_for_date(end_date)
    while current_year <= end_year:
        yield current_year
        current_year += 1


def split_requested_days_by_leave_year(start_date: date, end_date: date) -> dict[int, Decimal]:
    days_by_year: dict[int, Decimal] = {}
    for leave_day in iter_leave_dates(start_date, end_date):
        leave_year = get_leave_year_for_date(leave_day)
        days_by_year[leave_year] = days_by_year.get(leave_year, ZERO) + ONE
    return {leave_year: _round_days(days) for leave_year, days in days_by_year.items()}


def get_active_leave_policy() -> LeavePolicy:
    leave_policy = LeavePolicy.objects.filter(is_active=True).order_by("-updated_at", "id").first()
    if leave_policy:
        return leave_policy

    return LeavePolicy.objects.create(
        name=DEFAULT_LEAVE_POLICY_NAME,
        earned_leave_per_year=18,
        casual_leave_per_year=6,
        sick_leave_per_year=6,
        el_carry_forward_limit=30,
        el_encashment_limit=30,
        accrual_enabled=True,
        accrual_rate_per_month=Decimal("1.5"),
        is_active=True,
    )


def serialize_leave_policy(policy: LeavePolicy) -> dict[str, Any]:
    return {
        "id": policy.id,
        "name": policy.name,
        "earned_leave_per_year": policy.earned_leave_per_year,
        "casual_leave_per_year": policy.casual_leave_per_year,
        "sick_leave_per_year": policy.sick_leave_per_year,
        "el_carry_forward_limit": policy.el_carry_forward_limit,
        "el_encashment_limit": policy.el_encashment_limit,
        "accrual_enabled": policy.accrual_enabled,
        "accrual_rate_per_month": _decimal_to_json(policy.accrual_rate_per_month),
        "is_active": policy.is_active,
        "updated_at": policy.updated_at.isoformat(),
    }


def sync_leave_types_with_policy(policy: LeavePolicy | None = None) -> dict[str, LeaveType]:
    active_policy = policy or get_active_leave_policy()
    leave_types: dict[str, LeaveType] = {}

    for leave_config in STANDARD_LEAVE_TYPES:
        leave_type = LeaveType.objects.filter(name=leave_config["name"]).order_by("id").first()
        max_days = getattr(active_policy, leave_config["policy_field"])

        if leave_type is None:
            leave_type = LeaveType.objects.create(
                name=leave_config["name"],
                max_days_per_year=max_days,
                is_paid=leave_config["is_paid"],
                is_active=True,
            )
        else:
            updated_fields: list[str] = []
            if leave_type.max_days_per_year != max_days:
                leave_type.max_days_per_year = max_days
                updated_fields.append("max_days_per_year")
            if leave_type.is_paid != leave_config["is_paid"]:
                leave_type.is_paid = leave_config["is_paid"]
                updated_fields.append("is_paid")
            if not leave_type.is_active:
                leave_type.is_active = True
                updated_fields.append("is_active")
            if updated_fields:
                leave_type.save(update_fields=[*updated_fields, "updated_at"])

        leave_types[leave_config["code"]] = leave_type

    return leave_types


def get_leave_code(leave_type: LeaveType | None) -> str | None:
    if leave_type is None:
        return None

    policy = LEAVE_POLICY_BY_NAME.get(_normalize_leave_name(leave_type.name))
    if policy:
        return str(policy["code"])

    words = [word for word in leave_type.name.split() if word]
    if not words:
        return None
    return "".join(word[0] for word in words[:2]).upper()


def _leave_type_sort_key(leave_type: LeaveType) -> tuple[int, str]:
    code = get_leave_code(leave_type) or ""
    return (LEAVE_POLICY_ORDER.get(code, 999), leave_type.name.lower())


def _accrual_cutoff_for_leave_year(leave_year: int, today: date) -> date | None:
    current_leave_year = get_leave_year_for_date(today)
    cycle_start, cycle_end = get_leave_cycle_bounds(leave_year)

    if leave_year < current_leave_year:
        return cycle_end
    if leave_year == current_leave_year:
        return today
    if today >= cycle_end:
        return cycle_end
    if today < cycle_start:
        return None
    return today


def initialize_employee_leave_cycle(
    employee: Employee,
    leave_year: int,
    *,
    policy: LeavePolicy | None = None,
    for_update: bool = False,
) -> dict[str, EmployeeLeaveBalance]:
    active_policy = policy or get_active_leave_policy()
    leave_types_by_code = sync_leave_types_with_policy(active_policy)
    leave_types = list(leave_types_by_code.values())

    queryset = EmployeeLeaveBalance.objects.filter(
        employee=employee,
        leave_type__in=leave_types,
        year=leave_year,
    ).select_related("leave_type")
    if for_update:
        queryset = queryset.select_for_update()
    existing_by_code = {
        get_leave_code(balance.leave_type): balance
        for balance in queryset
    }

    for leave_code, leave_type in leave_types_by_code.items():
        if leave_code in existing_by_code:
            continue

        if leave_code == "CL":
            opening_balance = _round_days(active_policy.casual_leave_per_year)
            allocated = opening_balance
            last_accrual_processed_on = None
        elif leave_code == "SL":
            opening_balance = _round_days(active_policy.sick_leave_per_year)
            allocated = opening_balance
            last_accrual_processed_on = None
        else:
            previous_balance = (
                EmployeeLeaveBalance.objects.filter(
                    employee=employee,
                    leave_type=leave_type,
                    year=leave_year - 1,
                )
                .select_related("leave_type")
                .first()
            )
            previous_remaining = Decimal(str(previous_balance.remaining)) if previous_balance else ZERO
            opening_balance = min(
                _round_days(previous_remaining),
                _round_days(active_policy.el_carry_forward_limit),
            )
            if active_policy.accrual_enabled:
                allocated = opening_balance
                last_accrual_processed_on = None
            else:
                allocated = opening_balance + _round_days(active_policy.earned_leave_per_year)
                last_accrual_processed_on = date(leave_year, LEAVE_CYCLE_START_MONTH, 1)

        try:
            EmployeeLeaveBalance.objects.create(
                employee=employee,
                leave_type=leave_type,
                year=leave_year,
                opening_balance=opening_balance,
                allocated=allocated,
                used=ZERO,
                encashed=ZERO,
                last_accrual_processed_on=last_accrual_processed_on,
            )
        except IntegrityError:
            pass

    queryset = EmployeeLeaveBalance.objects.filter(
        employee=employee,
        leave_type__in=leave_types,
        year=leave_year,
    ).select_related("leave_type")
    if for_update:
        queryset = queryset.select_for_update()
    return {
        get_leave_code(balance.leave_type): balance
        for balance in queryset
        if get_leave_code(balance.leave_type)
    }


def catch_up_earned_leave_accrual_for_employee(
    employee: Employee,
    as_of_date: date,
    *,
    policy: LeavePolicy | None = None,
    for_update: bool = False,
) -> EmployeeLeaveBalance:
    active_policy = policy or get_active_leave_policy()
    leave_year = get_leave_year_for_date(as_of_date)
    balances = initialize_employee_leave_cycle(
        employee,
        leave_year,
        policy=active_policy,
        for_update=for_update,
    )
    el_balance = balances["EL"]

    if not active_policy.accrual_enabled:
        return el_balance

    cycle_start, cycle_end = get_leave_cycle_bounds(leave_year)
    target_month = _month_start(min(as_of_date, cycle_end))
    current_month = cycle_start
    if el_balance.last_accrual_processed_on:
        current_month = _next_month(_month_start(el_balance.last_accrual_processed_on))

    allocated = Decimal(str(el_balance.allocated))
    opening_balance = Decimal(str(el_balance.opening_balance))
    max_allocated = opening_balance + _round_days(active_policy.earned_leave_per_year)
    accrual_rate = _round_days(active_policy.accrual_rate_per_month)
    updated = False
    last_processed_on = el_balance.last_accrual_processed_on

    while current_month <= target_month and current_month <= cycle_end:
        if allocated < max_allocated:
            remaining_cap = max_allocated - allocated
            allocated += min(accrual_rate, remaining_cap)
            updated = True
        last_processed_on = current_month
        current_month = _next_month(current_month)

    if updated or last_processed_on != el_balance.last_accrual_processed_on:
        el_balance.allocated = _round_days(allocated)
        el_balance.last_accrual_processed_on = last_processed_on
        el_balance.save(update_fields=["allocated", "last_accrual_processed_on", "updated_at"])

    return el_balance


def get_or_create_leave_balance(
    employee: Employee,
    leave_type: LeaveType,
    leave_year: int,
    *,
    policy: LeavePolicy | None = None,
    for_update: bool = False,
) -> EmployeeLeaveBalance:
    active_policy = policy or get_active_leave_policy()
    balances = initialize_employee_leave_cycle(
        employee,
        leave_year,
        policy=active_policy,
        for_update=for_update,
    )
    leave_code = get_leave_code(leave_type)
    if leave_code == "EL":
        today = timezone.localdate()
        accrual_cutoff = _accrual_cutoff_for_leave_year(leave_year, today)
        if accrual_cutoff:
            catch_up_earned_leave_accrual_for_employee(
                employee,
                accrual_cutoff,
                policy=active_policy,
                for_update=for_update,
            )
            balances = initialize_employee_leave_cycle(
                employee,
                leave_year,
                policy=active_policy,
                for_update=for_update,
            )

    if leave_code and leave_code in balances:
        return balances[leave_code]

    queryset = EmployeeLeaveBalance.objects.filter(
        employee=employee,
        leave_type=leave_type,
        year=leave_year,
    )
    if for_update:
        queryset = queryset.select_for_update()
    return queryset.get()


def serialize_leave_balance(
    balance: EmployeeLeaveBalance,
    *,
    policy: LeavePolicy | None = None,
) -> dict[str, Any]:
    active_policy = policy or get_active_leave_policy()
    cycle_start, cycle_end = get_leave_cycle_bounds(balance.year)
    leave_code = get_leave_code(balance.leave_type)
    encashable_days = ZERO
    if leave_code == "EL":
        encashable_days = max(
            ZERO,
            min(
                Decimal(str(balance.remaining)),
                _round_days(active_policy.el_encashment_limit) - Decimal(str(balance.encashed)),
            ),
        )

    return {
        "leave_type_id": balance.leave_type_id,
        "leave_type": balance.leave_type.name,
        "leave_code": leave_code,
        "is_paid": balance.leave_type.is_paid,
        "opening_balance": _decimal_to_json(balance.opening_balance),
        "allocated": _decimal_to_json(balance.allocated),
        "used": _decimal_to_json(balance.used),
        "encashed": _decimal_to_json(balance.encashed),
        "remaining": _decimal_to_json(balance.remaining),
        "year": balance.year,
        "leave_year": balance.year,
        "leave_year_label": get_leave_year_label(balance.year),
        "cycle_start": cycle_start.isoformat(),
        "cycle_end": cycle_end.isoformat(),
        "encashable_days": _decimal_to_json(encashable_days),
        "updated_at": balance.updated_at.isoformat(),
    }


def serialize_leave_request(
    leave_request: LeaveRequest,
    *,
    include_employee: bool = False,
) -> dict[str, Any]:
    payload = {
        "id": leave_request.id,
        "leave_type": leave_request.leave_type.name if leave_request.leave_type else "N/A",
        "leave_type_id": leave_request.leave_type_id,
        "leave_code": get_leave_code(leave_request.leave_type),
        "is_paid": leave_request.leave_type.is_paid if leave_request.leave_type else False,
        "start_date": leave_request.start_date.isoformat(),
        "end_date": leave_request.end_date.isoformat(),
        "number_of_days": _decimal_to_json(calculate_requested_days(leave_request.start_date, leave_request.end_date)),
        "paid_days": _decimal_to_json(leave_request.paid_days),
        "lop_days": _decimal_to_json(leave_request.lop_days),
        "lop_amount": float(_round_money(leave_request.lop_amount)),
        "day_breakdown": leave_request.day_breakdown or [],
        "is_lop": Decimal(str(leave_request.lop_days or 0)) > ZERO,
        "reason": leave_request.reason,
        "status": leave_request.status,
        "approved_date": leave_request.approved_date.isoformat() if leave_request.approved_date else None,
        "rejection_reason": leave_request.rejection_reason,
        "approved_by": leave_request.approved_by.username if leave_request.approved_by else None,
        "created_at": leave_request.created_at.isoformat(),
        "updated_at": leave_request.updated_at.isoformat(),
    }
    if include_employee:
        payload.update(
            {
                "employee_name": leave_request.employee.name,
                "employee_id": leave_request.employee.employee_id,
                "employee_pk": leave_request.employee_id,
            }
        )
    return payload


def serialize_leave_encashment(encashment: LeaveEncashment) -> dict[str, Any]:
    return {
        "id": encashment.id,
        "leave_year": encashment.leave_year,
        "leave_year_label": get_leave_year_label(encashment.leave_year),
        "requested_days": _decimal_to_json(encashment.requested_days),
        "encashed_days": _decimal_to_json(encashment.encashed_days),
        "basic_salary_snapshot": float(_round_money(encashment.basic_salary_snapshot)),
        "encash_amount": float(_round_money(encashment.encash_amount)),
        "status": encashment.status,
        "remarks": encashment.remarks,
        "processed_by": encashment.processed_by.username if encashment.processed_by else None,
        "processed_at": encashment.processed_at.isoformat() if encashment.processed_at else None,
        "created_at": encashment.created_at.isoformat(),
    }


def _get_encashment_summary(
    employee: Employee,
    leave_year: int,
    *,
    policy: LeavePolicy | None = None,
) -> dict[str, Any]:
    active_policy = policy or get_active_leave_policy()
    leave_types = sync_leave_types_with_policy(active_policy)
    el_balance = get_or_create_leave_balance(
        employee,
        leave_types["EL"],
        leave_year,
        policy=active_policy,
    )
    encashable_days = max(
        ZERO,
        min(
            Decimal(str(el_balance.remaining)),
            _round_days(active_policy.el_encashment_limit) - Decimal(str(el_balance.encashed)),
        ),
    )

    return {
        "leave_year": leave_year,
        "leave_year_label": get_leave_year_label(leave_year),
        "eligible_days": _decimal_to_json(encashable_days),
        "limit": active_policy.el_encashment_limit,
        "already_encashed": _decimal_to_json(el_balance.encashed),
        "remaining_earned_leave": _decimal_to_json(el_balance.remaining),
    }


def list_leave_types() -> list[dict[str, Any]]:
    policy = get_active_leave_policy()
    sync_leave_types_with_policy(policy)
    leave_types = list(LeaveType.objects.filter(is_active=True))
    leave_types.sort(key=_leave_type_sort_key)

    return [
        {
            "id": leave_type.id,
            "name": leave_type.name,
            "code": get_leave_code(leave_type),
            "max_days_per_year": leave_type.max_days_per_year,
            "is_paid": leave_type.is_paid,
        }
        for leave_type in leave_types
    ]


def get_leave_balance_data(employee: Employee, year: int | None = None) -> dict[str, Any]:
    policy = get_active_leave_policy()
    today = timezone.localdate()
    leave_year = year if year is not None else get_leave_year_for_date(today)
    leave_types = sync_leave_types_with_policy(policy)

    initialize_employee_leave_cycle(employee, leave_year, policy=policy)
    accrual_cutoff = _accrual_cutoff_for_leave_year(leave_year, today)
    if accrual_cutoff:
        catch_up_earned_leave_accrual_for_employee(employee, accrual_cutoff, policy=policy)

    balances = [
        serialize_leave_balance(
            get_or_create_leave_balance(employee, leave_type, leave_year, policy=policy),
            policy=policy,
        )
        for _, leave_type in sorted(
            leave_types.items(),
            key=lambda item: LEAVE_POLICY_ORDER.get(item[0], 999),
        )
    ]

    cycle_start, cycle_end = get_leave_cycle_bounds(leave_year)
    summary = {
        balance["leave_code"] or f"TYPE_{balance['leave_type_id']}": balance
        for balance in balances
    }
    return {
        "year": leave_year,
        "leave_year": leave_year,
        "leave_year_label": get_leave_year_label(leave_year),
        "cycle_start": cycle_start.isoformat(),
        "cycle_end": cycle_end.isoformat(),
        "balances": balances,
        "summary": summary,
        "policy": serialize_leave_policy(policy),
        "encashment": _get_encashment_summary(employee, leave_year, policy=policy),
    }


def get_employee_leave_requests_data(employee: Employee) -> list[dict[str, Any]]:
    leave_requests = (
        LeaveRequest.objects.filter(employee=employee)
        .select_related("leave_type", "approved_by")
        .order_by("-created_at")
    )
    return [serialize_leave_request(leave_request) for leave_request in leave_requests]


def summarize_leave_requests_data(leave_requests: list[dict[str, Any]]) -> dict[str, Any]:
    summary = {
        "total_requests": len(leave_requests),
        "pending": 0,
        "approved": 0,
        "rejected": 0,
        "total_requested_days": ZERO,
        "total_paid_days": ZERO,
        "total_lop_days": ZERO,
        "total_lop_amount": ZERO,
    }

    for leave_request in leave_requests:
        status = (leave_request.get("status") or "").upper()
        if status == "PENDING":
            summary["pending"] += 1
        elif status == "APPROVED":
            summary["approved"] += 1
        elif status == "REJECTED":
            summary["rejected"] += 1

        summary["total_requested_days"] += Decimal(str(leave_request.get("number_of_days") or 0))
        summary["total_paid_days"] += Decimal(str(leave_request.get("paid_days") or 0))
        summary["total_lop_days"] += Decimal(str(leave_request.get("lop_days") or 0))
        summary["total_lop_amount"] += Decimal(str(leave_request.get("lop_amount") or 0))

    return {
        "total_requests": summary["total_requests"],
        "pending": summary["pending"],
        "approved": summary["approved"],
        "rejected": summary["rejected"],
        "total_requested_days": _decimal_to_json(summary["total_requested_days"]),
        "total_paid_days": _decimal_to_json(summary["total_paid_days"]),
        "total_lop_days": _decimal_to_json(summary["total_lop_days"]),
        "total_lop_amount": float(_round_money(summary["total_lop_amount"])),
    }


def get_admin_leave_requests_data(
    *,
    status: str | None = None,
    employee_filter: str | None = None,
) -> list[dict[str, Any]]:
    queryset = (
        LeaveRequest.objects.select_related("employee", "leave_type", "approved_by")
        .order_by("-created_at")
    )

    if status:
        queryset = queryset.filter(status=status.strip().upper())

    if employee_filter:
        trimmed = employee_filter.strip()
        queryset = queryset.filter(
            Q(employee__employee_id=trimmed) | Q(employee__name__icontains=trimmed)
        )

    return [serialize_leave_request(leave_request, include_employee=True) for leave_request in queryset]


def _ensure_no_overlapping_requests(
    employee: Employee,
    start_date: date,
    end_date: date,
    *,
    exclude_request_id: int | None = None,
) -> None:
    queryset = LeaveRequest.objects.filter(
        employee=employee,
        status__in=ACTIVE_LEAVE_STATUSES,
        start_date__lte=end_date,
        end_date__gte=start_date,
    ).select_related("leave_type")
    if exclude_request_id:
        queryset = queryset.exclude(id=exclude_request_id)

    overlapping_request = queryset.order_by("start_date", "id").first()
    if overlapping_request:
        raise LeaveManagementError(
            (
                "Overlapping leave request already exists "
                f"from {overlapping_request.start_date} to {overlapping_request.end_date}."
            ),
            status_code=400,
            payload={"overlapping_leave_request": serialize_leave_request(overlapping_request)},
        )


def _resolve_salary_snapshot(employee: Employee, target_date: date) -> dict[str, Decimal]:
    month_name = target_date.strftime("%B")
    monthly_salary_data = (
        MonthlySalaryData.objects.filter(
            employee=employee,
            month=month_name,
            year=target_date.year,
        )
        .order_by("-uploaded_at")
        .first()
    )
    if monthly_salary_data:
        return {
            "monthly_salary": _round_money(monthly_salary_data.gross_earnings),
            "basic_salary": _round_money(monthly_salary_data.basic),
        }

    try:
        from payroll_config.services import get_assignment_at_date
        from payslip_generation.calculation_engine import build_line_items_from_assignment

        assignment = get_assignment_at_date(employee, target_date)
        if assignment:
            calc_result = build_line_items_from_assignment(
                assignment=assignment,
                payroll_date=target_date,
                lop_days=0,
                work_days=0,
                days_in_month=calendar.monthrange(target_date.year, target_date.month)[1],
                employee_state=getattr(employee, "location_state", "KA") or "KA",
            )
            basic_amount = next(
                (
                    Decimal(str(line["amount"]))
                    for line in calc_result["lines"]
                    if line.get("code") == "BASIC"
                ),
                ZERO,
            )
            return {
                "monthly_salary": _round_money(calc_result["gross_earnings"]),
                "basic_salary": _round_money(basic_amount),
            }
    except Exception:
        pass

    salary_structure = (
        SalaryStructure.objects.filter(
            employee=employee,
            is_active=True,
            effective_from__lte=target_date,
        )
        .order_by("-effective_from", "-created_at")
        .first()
    )
    if salary_structure:
        monthly_salary = Decimal(str(salary_structure.annual_ctc)) / Decimal("12")
        return {
            "monthly_salary": _round_money(monthly_salary),
            "basic_salary": _round_money(monthly_salary * Decimal("0.4")),
        }

    return {
        "monthly_salary": ZERO,
        "basic_salary": ZERO,
    }


def _resolve_working_days(employee: Employee, month: int, year: int) -> int:
    try:
        from payslip_generation.payroll_calendar_service import _resolve_week_off_days, get_working_days

        week_off_days = _resolve_week_off_days(employee)
        total_calendar, weekly_off, holiday_count = get_working_days(
            month,
            year,
            week_off_days,
            getattr(employee, "location_state", None),
        )
        working_days = total_calendar - weekly_off - holiday_count
        if working_days > 0:
            return working_days
    except Exception:
        pass

    return calendar.monthrange(year, month)[1]


def _calculate_lop_amount(employee: Employee, day_breakdown: list[dict[str, Any]]) -> Decimal:
    lop_days_by_month: dict[tuple[int, int], Decimal] = defaultdict(lambda: ZERO)

    for day_payload in day_breakdown:
        if (day_payload.get("status") or "").upper() != "LOP":
            continue
        leave_date = day_payload.get("date")
        if not leave_date:
            continue
        target_date = date.fromisoformat(str(leave_date))
        lop_days_by_month[(target_date.year, target_date.month)] += ONE

    lop_amount = ZERO
    for (year, month), lop_days in lop_days_by_month.items():
        salary_snapshot = _resolve_salary_snapshot(employee, date(year, month, 1))
        monthly_salary = Decimal(str(salary_snapshot["monthly_salary"]))
        working_days = Decimal(str(_resolve_working_days(employee, month, year)))
        if monthly_salary <= ZERO or working_days <= ZERO:
            continue
        lop_amount += (monthly_salary / working_days) * lop_days

    return _round_money(lop_amount)


def _preview_leave_allocation(
    *,
    employee: Employee,
    leave_type: LeaveType,
    start_date: date,
    end_date: date,
    policy: LeavePolicy,
    for_update: bool = False,
) -> dict[str, Any]:
    leave_code = get_leave_code(leave_type)
    balances_by_year: dict[int, EmployeeLeaveBalance] = {}

    for leave_year in iter_leave_years(start_date, end_date):
        balance = get_or_create_leave_balance(
            employee,
            leave_type,
            leave_year,
            policy=policy,
            for_update=for_update,
        )
        balances_by_year[leave_year] = balance

    carry_forward_limit = _round_days(policy.el_carry_forward_limit)
    preview_states: dict[int, dict[str, Any]] = {}
    paid_days = ZERO
    lop_days = ZERO
    day_breakdown: list[dict[str, Any]] = []

    for leave_day in iter_leave_dates(start_date, end_date):
        leave_year = get_leave_year_for_date(leave_day)
        if leave_year not in preview_states:
            balance = balances_by_year.get(leave_year)
            starting_remaining = Decimal(str(balance.remaining)) if balance else ZERO
            carry_forward_delta = ZERO
            expected_opening = Decimal(str(balance.opening_balance)) if balance else ZERO

            if leave_code == "EL" and (leave_year - 1) in preview_states and balance is not None:
                previous_state = preview_states[leave_year - 1]
                expected_opening = min(previous_state["remaining"], carry_forward_limit)
                carry_forward_delta = expected_opening - Decimal(str(balance.opening_balance))
                starting_remaining = max(starting_remaining + carry_forward_delta, ZERO)

            preview_states[leave_year] = {
                "balance": balance,
                "starting_remaining": _round_days(starting_remaining),
                "remaining": _round_days(starting_remaining),
                "carry_forward_delta": _round_days(carry_forward_delta),
                "expected_opening": _round_days(expected_opening),
                "paid_days": ZERO,
            }

        state = preview_states[leave_year]
        is_paid_day = leave_type.is_paid and state["remaining"] >= ONE

        if is_paid_day:
            state["remaining"] = _round_days(state["remaining"] - ONE)
            state["paid_days"] = _round_days(state["paid_days"] + ONE)
            paid_days = _round_days(paid_days + ONE)
            day_status = "PAID"
        else:
            lop_days = _round_days(lop_days + ONE)
            day_status = "LOP"

        day_breakdown.append(
            {
                "date": leave_day.isoformat(),
                "status": day_status,
                "leave_year": leave_year,
                "leave_year_label": get_leave_year_label(leave_year),
                "leave_code": leave_code,
            }
        )

    lop_amount = _calculate_lop_amount(employee, day_breakdown) if lop_days > ZERO else ZERO

    preview_balances: dict[int, dict[str, Any]] = {}
    for leave_year, state in preview_states.items():
        balance = state["balance"]
        if balance is None:
            continue
        serialized = serialize_leave_balance(balance, policy=policy)
        serialized.update(
            {
                "remaining_before_request": _decimal_to_json(state["starting_remaining"]),
                "remaining_after_request": _decimal_to_json(state["remaining"]),
                "requested_paid_days": _decimal_to_json(state["paid_days"]),
                "carry_forward_delta": _decimal_to_json(state["carry_forward_delta"]),
                "effective_opening_balance": _decimal_to_json(state["expected_opening"]),
            }
        )
        preview_balances[leave_year] = serialized

    return {
        "requested_days": calculate_requested_days(start_date, end_date),
        "days_by_year": split_requested_days_by_leave_year(start_date, end_date),
        "paid_days": paid_days,
        "lop_days": lop_days,
        "lop_amount": lop_amount,
        "day_breakdown": day_breakdown,
        "balances_by_year": preview_balances,
        "preview_states": preview_states,
    }


def validate_leave_request(
    employee: Employee,
    leave_type: LeaveType,
    start_date: date,
    end_date: date,
    *,
    exclude_request_id: int | None = None,
    for_update: bool = False,
) -> dict[str, Any]:
    if not leave_type.is_active:
        raise LeaveManagementError("Selected leave type is inactive.", status_code=400)

    if start_date > end_date:
        raise LeaveManagementError("Start date cannot be after end date.", status_code=400)

    _ensure_no_overlapping_requests(
        employee,
        start_date,
        end_date,
        exclude_request_id=exclude_request_id,
    )

    policy = get_active_leave_policy()
    preview = _preview_leave_allocation(
        employee=employee,
        leave_type=leave_type,
        start_date=start_date,
        end_date=end_date,
        policy=policy,
        for_update=for_update,
    )
    preview["policy"] = policy
    return preview


def _notify_manager_of_leave_request(employee: Employee, leave_request: LeaveRequest) -> None:
    manager = employee.reporting_manager
    if not manager:
        return

    lop_note = ""
    if Decimal(str(leave_request.lop_days or 0)) > ZERO:
        lop_note = (
            f" Preview: {_decimal_to_json(leave_request.lop_days)} day(s) may be treated as LOP "
            "based on the current balance."
        )

    Notification.objects.create(
        employee=manager,
        notification_type="ANNOUNCEMENT",
        title=f"Leave Request: {employee.name}",
        message=(
            f"{employee.name} applied for {leave_request.leave_type.name if leave_request.leave_type else 'leave'} "
            f"from {leave_request.start_date} to {leave_request.end_date} "
            f"({_decimal_to_json(leave_request.paid_days + leave_request.lop_days)} day(s))."
            f"{lop_note} Please review."
        ),
        related_id=leave_request.id,
    )


def apply_leave_request(
    *,
    employee: Employee,
    leave_type: LeaveType,
    start_date: date,
    end_date: date,
    reason: str,
) -> dict[str, Any]:
    trimmed_reason = (reason or "").strip()
    if not trimmed_reason:
        raise LeaveManagementError("Reason is required.", status_code=400)

    validation = validate_leave_request(employee, leave_type, start_date, end_date)

    with transaction.atomic():
        leave_request = LeaveRequest.objects.create(
            employee=employee,
            leave_type=leave_type,
            start_date=start_date,
            end_date=end_date,
            reason=trimmed_reason,
            status="PENDING",
            paid_days=validation["paid_days"],
            lop_days=validation["lop_days"],
            lop_amount=validation["lop_amount"],
            day_breakdown=validation["day_breakdown"],
        )
        transaction.on_commit(lambda: _notify_manager_of_leave_request(employee, leave_request))

    return {
        "leave_request": serialize_leave_request(leave_request),
        "requested_days": _decimal_to_json(validation["requested_days"]),
        "balances_by_year": validation["balances_by_year"],
        "policy": serialize_leave_policy(validation["policy"]),
    }


def _find_attendance_conflict(employee: Employee, start_date: date, end_date: date) -> AttendanceRecord | None:
    return (
        AttendanceRecord.objects.filter(employee=employee, date__gte=start_date, date__lte=end_date)
        .filter(
            Q(punch_in_time__isnull=False)
            | Q(punch_out_time__isnull=False)
            | Q(
                status__in=(
                    AttendanceRecord.STATUS_PRESENT,
                    AttendanceRecord.STATUS_LATE,
                    AttendanceRecord.STATUS_HALF_DAY,
                )
            )
        )
        .order_by("date", "id")
        .first()
    )


def _sync_leave_attendance(leave_request: LeaveRequest, admin: AdminUser) -> None:
    actor = ActorContext(
        actor_type=AttendanceAuditLog.ACTOR_ADMIN,
        actor_admin=admin,
    )
    employee = leave_request.employee
    note = (
        f"Approved leave: {leave_request.leave_type.name if leave_request.leave_type else 'N/A'} "
        f"(Request #{leave_request.id})"
    )
    affected_periods: set[tuple[int, int]] = set()

    for leave_day in iter_leave_dates(leave_request.start_date, leave_request.end_date):
        affected_periods.add((leave_day.year, leave_day.month))

        assignment = get_active_assignment(employee, leave_day)
        policy = get_active_policy(assignment)
        office_location = get_active_office_location(assignment, policy)

        record = (
            AttendanceRecord.objects.select_for_update()
            .filter(employee=employee, date=leave_day)
            .first()
        )

        if record is None:
            record = AttendanceRecord.objects.create(
                employee=employee,
                date=leave_day,
                shift=assignment.shift if assignment else None,
                office_location=office_location,
                status=AttendanceRecord.STATUS_LEAVE,
                marked_by_system=True,
                notes=note,
            )
            _sync_legacy_attendance(record)
            create_audit_log(
                record=record,
                actor=actor,
                action=AttendanceAuditLog.ACTION_CREATE,
                before_data={},
                after_data=snapshot_record(record),
                reason=f"Leave request #{leave_request.id} approved.",
            )
            continue

        before_data = snapshot_record(record)
        changed_fields: list[str] = []

        if record.status != AttendanceRecord.STATUS_LEAVE:
            record.status = AttendanceRecord.STATUS_LEAVE
            changed_fields.append("status")
        if record.notes != note:
            record.notes = note
            changed_fields.append("notes")
        if not record.marked_by_system:
            record.marked_by_system = True
            changed_fields.append("marked_by_system")
        if record.shift_id is None and assignment and assignment.shift_id:
            record.shift = assignment.shift
            changed_fields.append("shift")
        if record.office_location_id is None and office_location:
            record.office_location = office_location
            changed_fields.append("office_location")
        if not record.punch_in_time and record.working_hours != ZERO:
            record.working_hours = ZERO
            changed_fields.append("working_hours")
        if not record.punch_out_time and record.overtime_hours != ZERO:
            record.overtime_hours = ZERO
            changed_fields.append("overtime_hours")

        if changed_fields:
            record.save(update_fields=[*changed_fields, "updated_at"])
            _sync_legacy_attendance(record)
            create_audit_log(
                record=record,
                actor=actor,
                action=AttendanceAuditLog.ACTION_MANUAL_UPDATE,
                before_data=before_data,
                after_data=snapshot_record(record),
                reason=f"Leave request #{leave_request.id} approved.",
            )

    for year, month in affected_periods:
        generate_monthly_summary(employee, month=month, year=year)


def _apply_balance_preview(preview: dict[str, Any]) -> list[dict[str, Any]]:
    policy = preview.get("policy") or get_active_leave_policy()
    updated_balances: list[dict[str, Any]] = []

    for leave_year in sorted(preview["preview_states"]):
        state = preview["preview_states"][leave_year]
        balance: EmployeeLeaveBalance | None = state["balance"]
        if balance is None:
            continue

        update_fields: list[str] = []
        expected_opening = _round_days(state["expected_opening"])
        if Decimal(str(balance.opening_balance)) != expected_opening:
            delta = expected_opening - Decimal(str(balance.opening_balance))
            adjusted_allocated = Decimal(str(balance.allocated)) + delta
            minimum_allocated = Decimal(str(balance.used)) + Decimal(str(balance.encashed))
            balance.opening_balance = expected_opening
            balance.allocated = _round_days(max(adjusted_allocated, minimum_allocated))
            update_fields.extend(["opening_balance", "allocated"])

        requested_paid_days = _round_days(state["paid_days"])
        if requested_paid_days > ZERO:
            balance.used = _round_days(Decimal(str(balance.used)) + requested_paid_days)
            update_fields.append("used")

        if update_fields:
            balance.save(update_fields=[*update_fields, "updated_at"])

        updated_balances.append(serialize_leave_balance(balance, policy=policy))

    return updated_balances


def approve_leave_request(*, leave_request_id: int, admin: AdminUser) -> dict[str, Any]:
    with transaction.atomic():
        try:
            leave_request = (
                LeaveRequest.objects.select_for_update()
                .select_related("employee", "leave_type")
                .get(id=leave_request_id)
            )
        except LeaveRequest.DoesNotExist as exc:
            raise LeaveManagementError("Leave request not found.", status_code=404) from exc

        if leave_request.status != "PENDING":
            raise LeaveManagementError(
                f"Leave request is already {leave_request.status}.",
                status_code=400,
                payload={"leave_request": serialize_leave_request(leave_request, include_employee=True)},
            )

        attendance_conflict = _find_attendance_conflict(
            leave_request.employee,
            leave_request.start_date,
            leave_request.end_date,
        )
        if attendance_conflict:
            raise LeaveManagementError(
                (
                    "Cannot approve leave because attendance is already recorded on "
                    f"{attendance_conflict.date}."
                ),
                status_code=409,
                payload={
                    "conflicting_date": attendance_conflict.date.isoformat(),
                    "attendance_status": attendance_conflict.status,
                },
            )

        if leave_request.leave_type is not None:
            validation = validate_leave_request(
                leave_request.employee,
                leave_request.leave_type,
                leave_request.start_date,
                leave_request.end_date,
                exclude_request_id=leave_request.id,
                for_update=True,
            )
            balances_used = _apply_balance_preview(validation)
            leave_request.paid_days = validation["paid_days"]
            leave_request.lop_days = validation["lop_days"]
            leave_request.lop_amount = validation["lop_amount"]
            leave_request.day_breakdown = validation["day_breakdown"]
        else:
            balances_used = []
            leave_request.paid_days = ZERO
            leave_request.lop_days = calculate_requested_days(leave_request.start_date, leave_request.end_date)
            leave_request.day_breakdown = [
                {
                    "date": leave_day.isoformat(),
                    "status": "LOP",
                    "leave_year": get_leave_year_for_date(leave_day),
                    "leave_year_label": get_leave_year_label(get_leave_year_for_date(leave_day)),
                    "leave_code": None,
                }
                for leave_day in iter_leave_dates(leave_request.start_date, leave_request.end_date)
            ]
            leave_request.lop_amount = _calculate_lop_amount(leave_request.employee, leave_request.day_breakdown)

        leave_request.status = "APPROVED"
        leave_request.approved_by = admin
        leave_request.approved_date = timezone.now()
        leave_request.rejection_reason = ""
        leave_request.save(
            update_fields=[
                "status",
                "approved_by",
                "approved_date",
                "rejection_reason",
                "paid_days",
                "lop_days",
                "lop_amount",
                "day_breakdown",
                "updated_at",
            ]
        )

        _sync_leave_attendance(leave_request, admin)
        requested_days = leave_request.paid_days + leave_request.lop_days
        transaction.on_commit(
            lambda: Notification.objects.create(
                employee=leave_request.employee,
                notification_type="LEAVE_APPROVED",
                title="Leave Approved",
                message=(
                    f"Your {leave_request.leave_type.name if leave_request.leave_type else 'leave'} "
                    f"from {leave_request.start_date} to {leave_request.end_date} "
                    f"({_decimal_to_json(requested_days)} day(s)) has been approved."
                    + (
                        f" {_decimal_to_json(leave_request.lop_days)} day(s) will be treated as LOP."
                        if leave_request.lop_days > ZERO
                        else ""
                    )
                ),
                related_id=leave_request.id,
            )
        )

    return {
        "leave_request": serialize_leave_request(leave_request, include_employee=True),
        "balances": balances_used,
    }


def reject_leave_request(
    *,
    leave_request_id: int,
    admin: AdminUser,
    rejection_reason: str,
) -> dict[str, Any]:
    with transaction.atomic():
        try:
            leave_request = (
                LeaveRequest.objects.select_for_update()
                .select_related("employee", "leave_type")
                .get(id=leave_request_id)
            )
        except LeaveRequest.DoesNotExist as exc:
            raise LeaveManagementError("Leave request not found.", status_code=404) from exc

        if leave_request.status != "PENDING":
            raise LeaveManagementError(
                f"Leave request is already {leave_request.status}.",
                status_code=400,
                payload={"leave_request": serialize_leave_request(leave_request, include_employee=True)},
            )

        reason = (rejection_reason or "").strip() or "Rejected by admin"
        leave_request.status = "REJECTED"
        leave_request.approved_by = admin
        leave_request.approved_date = timezone.now()
        leave_request.rejection_reason = reason
        leave_request.save(
            update_fields=[
                "status",
                "approved_by",
                "approved_date",
                "rejection_reason",
                "updated_at",
            ]
        )

        transaction.on_commit(
            lambda: Notification.objects.create(
                employee=leave_request.employee,
                notification_type="LEAVE_REJECTED",
                title="Leave Rejected",
                message=(
                    f"Your {leave_request.leave_type.name if leave_request.leave_type else 'leave'} "
                    f"request has been rejected. Reason: {reason}"
                ),
                related_id=leave_request.id,
            )
        )

    return {
        "leave_request": serialize_leave_request(leave_request, include_employee=True),
    }


def encash_earned_leave(
    *,
    employee: Employee,
    requested_days: Decimal | int | float | str,
    remarks: str = "",
    processed_by: AdminUser | None = None,
) -> dict[str, Any]:
    requested_decimal = _round_days(requested_days)
    if requested_decimal <= ZERO:
        raise LeaveManagementError("Requested encashment days must be greater than zero.", status_code=400)

    leave_year = get_leave_year_for_date(timezone.localdate())
    policy = get_active_leave_policy()
    leave_types = sync_leave_types_with_policy(policy)

    with transaction.atomic():
        get_or_create_leave_balance(
            employee,
            leave_types["EL"],
            leave_year,
            policy=policy,
            for_update=True,
        )
        catch_up_earned_leave_accrual_for_employee(
            employee,
            timezone.localdate(),
            policy=policy,
            for_update=True,
        )
        el_balance = get_or_create_leave_balance(
            employee,
            leave_types["EL"],
            leave_year,
            policy=policy,
            for_update=True,
        )

        encashable_days = max(
            ZERO,
            min(
                Decimal(str(el_balance.remaining)),
                _round_days(policy.el_encashment_limit) - Decimal(str(el_balance.encashed)),
            ),
        )
        if requested_decimal > encashable_days:
            raise LeaveManagementError(
                (
                    "Insufficient earned leave available for encashment. "
                    f"You can encash up to {_decimal_to_json(encashable_days)} day(s)."
                ),
                status_code=400,
                payload={"eligible_days": _decimal_to_json(encashable_days)},
            )

        salary_snapshot = _resolve_salary_snapshot(employee, timezone.localdate())
        basic_salary = Decimal(str(salary_snapshot["basic_salary"]))
        encash_amount = _round_money((basic_salary / Decimal("30")) * requested_decimal) if basic_salary > ZERO else ZERO

        el_balance.encashed = _round_days(Decimal(str(el_balance.encashed)) + requested_decimal)
        el_balance.save(update_fields=["encashed", "updated_at"])

        encashment = LeaveEncashment.objects.create(
            employee=employee,
            leave_balance=el_balance,
            leave_year=leave_year,
            requested_days=requested_decimal,
            encashed_days=requested_decimal,
            basic_salary_snapshot=_round_money(basic_salary),
            encash_amount=encash_amount,
            status="APPROVED",
            remarks=(remarks or "").strip(),
            processed_by=processed_by,
        )

    return {
        "encashment": serialize_leave_encashment(encashment),
        "balance": serialize_leave_balance(el_balance, policy=policy),
        "encashment_summary": _get_encashment_summary(employee, leave_year, policy=policy),
    }


def process_leave_cycle_initialization(target_date: date | None = None) -> dict[str, Any]:
    active_policy = get_active_leave_policy()
    run_date = target_date or timezone.localdate()
    leave_year = get_leave_year_for_date(run_date)
    processed_employees = 0

    employees = Employee.objects.filter(is_active=True, doj__lte=run_date).iterator()
    for employee in employees:
        initialize_employee_leave_cycle(employee, leave_year, policy=active_policy)
        accrual_cutoff = _accrual_cutoff_for_leave_year(leave_year, run_date)
        if accrual_cutoff:
            catch_up_earned_leave_accrual_for_employee(employee, accrual_cutoff, policy=active_policy)
        processed_employees += 1

    return {
        "leave_year": leave_year,
        "leave_year_label": get_leave_year_label(leave_year),
        "processed_employees": processed_employees,
    }


def process_monthly_earned_leave_accrual(target_date: date | None = None) -> dict[str, Any]:
    run_date = target_date or timezone.localdate()
    active_policy = get_active_leave_policy()
    if not active_policy.accrual_enabled:
        return {
            "processed_employees": 0,
            "updated_balances": 0,
            "processed_month": _month_start(run_date).isoformat(),
            "message": "Accrual is disabled in the active leave policy.",
        }

    updated_balances = 0
    employees = list(Employee.objects.filter(is_active=True, doj__lte=run_date))
    leave_types = sync_leave_types_with_policy(active_policy)

    for employee in employees:
        existing_balance = EmployeeLeaveBalance.objects.filter(
            employee=employee,
            leave_type=leave_types["EL"],
            year=get_leave_year_for_date(run_date),
        ).first()
        before = Decimal(str(existing_balance.allocated)) if existing_balance else ZERO
        updated_balance = catch_up_earned_leave_accrual_for_employee(
            employee,
            run_date,
            policy=active_policy,
        )
        if Decimal(str(updated_balance.allocated)) != before:
            updated_balances += 1

    return {
        "processed_employees": len(employees),
        "updated_balances": updated_balances,
        "processed_month": _month_start(run_date).isoformat(),
    }
