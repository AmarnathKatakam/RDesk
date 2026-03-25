from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from math import asin, cos, radians, sin, sqrt
from typing import Any

from django.db import models, transaction
from django.utils import timezone

from employees.models import Employee, EmployeeAttendance, LeaveRequest

from .models import (
    AttendanceAuditLog,
    AttendancePolicy,
    AttendanceRecord,
    EmployeeShiftAssignment,
    Holiday,
    MonthlyAttendanceSummary,
    OfficeLocation,
    Shift,
)


class AttendanceServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class ActorContext:
    actor_type: str
    actor_employee: Employee | None = None
    actor_admin: Any | None = None


def _safe_decimal(value: Any, default: Decimal = Decimal("0")) -> Decimal:
    if value is None or value == "":
        return default
    return Decimal(str(value))


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371000  # meters
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return radius * c


def check_attendance_configurations() -> dict[str, Any]:
    """
    Check if required attendance configurations exist.
    Returns a dictionary with configuration status and warnings.
    """
    warnings = []
    
    # Check for shifts
    shifts_exist = Shift.objects.filter(is_active=True).exists()
    if not shifts_exist:
        warnings.append("No active shifts configured. Please create at least one shift.")
    
    # Check for office locations
    office_locations_exist = OfficeLocation.objects.filter(is_active=True).exists()
    if not office_locations_exist:
        warnings.append("No office locations configured. Please add at least one office location.")
    
    # Check for attendance policies
    policies_exist = AttendancePolicy.objects.filter(is_active=True).exists()
    if not policies_exist:
        warnings.append("No attendance policies configured. Please create an attendance policy.")
    
    return {
        "configured": shifts_exist and office_locations_exist and policies_exist,
        "shifts_exist": shifts_exist,
        "office_locations_exist": office_locations_exist,
        "policies_exist": policies_exist,
        "warnings": warnings,
    }


def get_configuration_warning_message() -> str | None:
    """
    Returns a warning message if attendance is not properly configured.
    """
    config = check_attendance_configurations()
    if not config["configured"]:
        return " | ".join(config["warnings"])
    return None


def resolve_employee_for_request(request, provided_employee_id=None) -> Employee:
    session_employee_id = request.session.get("employee_id")
    request_employee_id = (
        provided_employee_id
        or request.GET.get("employee_id")
        or request.data.get("employee_id")
        or request.POST.get("employee_id")
    )

    if session_employee_id:
        if request_employee_id and str(request_employee_id) != str(session_employee_id):
            raise AttendanceServiceError("Forbidden.", status_code=403)
        target_id = session_employee_id
    elif is_admin_request(request):
        if not request_employee_id:
            raise AttendanceServiceError("employee_id is required.", status_code=400)
        target_id = request_employee_id
    else:
        raise AttendanceServiceError("Unauthorized.", status_code=401)

    try:
        return Employee.objects.get(id=target_id, is_active=True)
    except Employee.DoesNotExist as exc:
        raise AttendanceServiceError("Employee not found.", status_code=404) from exc


def is_admin_request(request) -> bool:
    return bool(request.session.get("admin_id")) or bool(getattr(request.user, "is_authenticated", False))


def resolve_actor_context(request) -> ActorContext:
    session_employee_id = request.session.get("employee_id")
    if session_employee_id:
        employee = Employee.objects.filter(id=session_employee_id).first()
        return ActorContext(
            actor_type=AttendanceAuditLog.ACTOR_EMPLOYEE,
            actor_employee=employee,
        )

    if getattr(request.user, "is_authenticated", False):
        return ActorContext(
            actor_type=AttendanceAuditLog.ACTOR_ADMIN,
            actor_admin=request.user,
        )

    return ActorContext(actor_type=AttendanceAuditLog.ACTOR_SYSTEM)


def snapshot_record(record: AttendanceRecord | None) -> dict[str, Any]:
    if record is None:
        return {}
    return {
        "status": record.status,
        "punch_in_time": record.punch_in_time.isoformat() if record.punch_in_time else None,
        "punch_out_time": record.punch_out_time.isoformat() if record.punch_out_time else None,
        "working_hours": str(record.working_hours),
        "overtime_hours": str(record.overtime_hours),
        "location_verified": record.location_verified,
        "punch_out_location_verified": record.punch_out_location_verified,
        "notes": record.notes,
    }


def create_audit_log(
    record: AttendanceRecord,
    actor: ActorContext,
    action: str,
    before_data: dict[str, Any] | None = None,
    after_data: dict[str, Any] | None = None,
    reason: str | None = None,
) -> None:
    AttendanceAuditLog.objects.create(
        attendance=record,
        actor_type=actor.actor_type,
        actor_employee=actor.actor_employee,
        actor_admin=actor.actor_admin,
        action=action,
        before_data=before_data or {},
        after_data=after_data or {},
        reason=reason or "",
    )


def get_active_assignment(employee: Employee, target_date: date) -> EmployeeShiftAssignment | None:
    return (
        EmployeeShiftAssignment.objects.select_related("shift", "office_location", "policy")
        .filter(
            employee=employee,
            is_active=True,
            effective_from__lte=target_date,
        )
        .filter(models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=target_date))
        .order_by("-effective_from", "-id")
        .first()
    )


def get_active_policy(assignment: EmployeeShiftAssignment | None) -> AttendancePolicy | None:
    if assignment and assignment.policy and assignment.policy.is_active:
        return assignment.policy
    return AttendancePolicy.objects.filter(is_active=True).order_by("-id").first()


def get_active_office_location(
    assignment: EmployeeShiftAssignment | None,
    policy: AttendancePolicy | None,
) -> OfficeLocation | None:
    if assignment and assignment.office_location and assignment.office_location.is_active:
        return assignment.office_location
    if policy and policy.default_office_location and policy.default_office_location.is_active:
        return policy.default_office_location
    return OfficeLocation.objects.filter(is_active=True, is_default=True).first() or OfficeLocation.objects.filter(
        is_active=True
    ).first()


def has_approved_leave(employee: Employee, target_date: date) -> bool:
    return LeaveRequest.objects.filter(
        employee=employee,
        status="APPROVED",
        start_date__lte=target_date,
        end_date__gte=target_date,
    ).exists()


def is_holiday(target_date: date, location: OfficeLocation | None = None) -> bool:
    holiday_qs = Holiday.objects.filter(holiday_date=target_date)
    if location:
        holiday_qs = holiday_qs.filter(models.Q(location__isnull=True) | models.Q(location=location))
    return holiday_qs.exists()


def is_week_off(target_date: date, policy: AttendancePolicy | None) -> bool:
    if not policy:
        return target_date.weekday() in {5, 6}
    raw = policy.week_off_days or []
    try:
        week_off_days = {int(day) for day in raw}
    except (TypeError, ValueError):
        week_off_days = {5, 6}
    return target_date.weekday() in week_off_days


def validate_location(
    policy: AttendancePolicy | None,
    office_location: OfficeLocation | None,
    latitude: Decimal | None,
    longitude: Decimal | None,
) -> tuple[bool, float | None]:
    if not policy:
        return False, None

    if not policy.enforce_gps or policy.allow_remote_punch:
        return False, None

    if not office_location:
        raise AttendanceServiceError("No office location configured for attendance validation.", status_code=400)
    if latitude is None or longitude is None:
        raise AttendanceServiceError("GPS coordinates are required for attendance.", status_code=400)

    distance = haversine_distance_meters(
        float(latitude),
        float(longitude),
        float(office_location.latitude),
        float(office_location.longitude),
    )
    if distance > float(office_location.allowed_radius_meters):
        raise AttendanceServiceError(
            f"Attendance rejected. You are outside the allowed office radius ({office_location.allowed_radius_meters} m).",
            status_code=403,
        )
    return True, distance


def evaluate_status_for_punch_in(shift, punched_time: time) -> str:
    if punched_time <= shift.late_after:
        return AttendanceRecord.STATUS_PRESENT
    if punched_time <= shift.half_day_after:
        return AttendanceRecord.STATUS_LATE
    return AttendanceRecord.STATUS_HALF_DAY


def _sync_legacy_attendance(record: AttendanceRecord) -> None:
    legacy, _ = EmployeeAttendance.objects.get_or_create(
        employee=record.employee,
        date=record.date,
    )
    legacy.sign_in_time = record.punch_in_time
    legacy.sign_out_time = record.punch_out_time
    legacy.save(update_fields=["sign_in_time", "sign_out_time", "updated_at"])


def _serialize_record(record: AttendanceRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "employee_id": record.employee.id,
        "employee_code": record.employee.employee_id,
        "employee_name": record.employee.name,
        "date": record.date.isoformat(),
        "punch_in_time": record.punch_in_time.isoformat() if record.punch_in_time else None,
        "punch_out_time": record.punch_out_time.isoformat() if record.punch_out_time else None,
        "working_hours": float(record.working_hours),
        "overtime_hours": float(record.overtime_hours),
        "status": record.status,
        "location_verified": record.location_verified,
        "punch_out_location_verified": record.punch_out_location_verified,
        "shift": record.shift.name if record.shift else None,
        "shift_id": record.shift_id,
        "office_location": record.office_location.name if record.office_location else None,
    }


def punch_in(
    *,
    employee: Employee,
    actor: ActorContext,
    latitude: Decimal | None = None,
    longitude: Decimal | None = None,
    notes: str | None = None,
) -> tuple[AttendanceRecord, dict[str, Any]]:
    today = timezone.localdate()
    now = timezone.now()
    local_now = timezone.localtime(now)

    # Check configuration before proceeding
    config_warning = get_configuration_warning_message()
    if config_warning:
        raise AttendanceServiceError(
            f"Attendance system not fully configured. {config_warning}",
            status_code=400
        )

    if has_approved_leave(employee, today):
        raise AttendanceServiceError("Cannot punch in on an approved leave day.", status_code=409)

    assignment = get_active_assignment(employee, today)
    if not assignment or not assignment.shift or not assignment.shift.is_active:
        raise AttendanceServiceError(
            "No active shift assignment found. Please contact HR to get your shift assigned before punching in.",
            status_code=400
        )

    policy = get_active_policy(assignment)
    office_location = get_active_office_location(assignment, policy)
    location_verified, distance = validate_location(policy, office_location, latitude, longitude)
    status = evaluate_status_for_punch_in(assignment.shift, local_now.time())

    with transaction.atomic():
        record, _ = AttendanceRecord.objects.select_for_update().get_or_create(
            employee=employee,
            date=today,
            defaults={
                "shift": assignment.shift,
                "office_location": office_location,
                "status": AttendanceRecord.STATUS_ABSENT,
            },
        )

        if record.punch_in_time:
            raise AttendanceServiceError("Punch in already recorded for today.", status_code=409)

        before_data = snapshot_record(record)

        record.shift = assignment.shift
        record.office_location = office_location
        record.punch_in_time = now
        record.punch_in_latitude = latitude
        record.punch_in_longitude = longitude
        record.location_verified = location_verified
        record.status = status
        record.notes = notes or record.notes
        record.marked_by_system = False
        record.save()

        _sync_legacy_attendance(record)
        create_audit_log(
            record=record,
            actor=actor,
            action=AttendanceAuditLog.ACTION_PUNCH_IN,
            before_data=before_data,
            after_data=snapshot_record(record),
            reason="Employee punched in.",
        )

    return record, {"distance_meters": round(distance, 2) if distance is not None else None}


def punch_out(
    *,
    employee: Employee,
    actor: ActorContext,
    latitude: Decimal | None = None,
    longitude: Decimal | None = None,
    notes: str | None = None,
) -> tuple[AttendanceRecord, dict[str, Any]]:
    today = timezone.localdate()
    now = timezone.now()

    # Check configuration before proceeding
    config_warning = get_configuration_warning_message()
    if config_warning:
        raise AttendanceServiceError(
            f"Attendance system not fully configured. {config_warning}",
            status_code=400
        )

    assignment = get_active_assignment(employee, today)
    if not assignment or not assignment.shift or not assignment.shift.is_active:
        raise AttendanceServiceError(
            "No active shift assignment found. Please contact HR to get your shift assigned before punching out.",
            status_code=400
        )

    policy = get_active_policy(assignment)
    office_location = get_active_office_location(assignment, policy)
    location_verified, distance = validate_location(policy, office_location, latitude, longitude)

    with transaction.atomic():
        try:
            record = AttendanceRecord.objects.select_for_update().get(employee=employee, date=today)
        except AttendanceRecord.DoesNotExist as exc:
            raise AttendanceServiceError("No punch in found for today.", status_code=404) from exc

        if record.punch_out_time:
            raise AttendanceServiceError("Punch out already recorded for today.", status_code=409)
        if not record.punch_in_time:
            raise AttendanceServiceError("Please punch in first.", status_code=400)

        before_data = snapshot_record(record)

        record.punch_out_time = now
        record.punch_out_latitude = latitude
        record.punch_out_longitude = longitude
        record.punch_out_location_verified = location_verified
        record.notes = notes or record.notes
        record.recalculate_working_hours()

        working_hours = _safe_decimal(record.working_hours)
        shift_hours = assignment.shift.shift_duration_hours
        overtime = Decimal("0.00")
        if assignment.shift.overtime_allowed and working_hours > shift_hours:
            overtime = (working_hours - shift_hours).quantize(Decimal("0.01"))
        record.overtime_hours = overtime

        if record.status not in {
            AttendanceRecord.STATUS_HALF_DAY,
            AttendanceRecord.STATUS_LEAVE,
            AttendanceRecord.STATUS_HOLIDAY,
            AttendanceRecord.STATUS_WEEK_OFF,
            AttendanceRecord.STATUS_ABSENT,
        }:
            min_half_day = _safe_decimal(policy.min_half_day_hours if policy else Decimal("4.00"))
            if working_hours < min_half_day:
                record.status = AttendanceRecord.STATUS_HALF_DAY
            elif record.status == AttendanceRecord.STATUS_LATE:
                record.status = AttendanceRecord.STATUS_LATE
            else:
                record.status = AttendanceRecord.STATUS_PRESENT

        record.save()
        _sync_legacy_attendance(record)
        create_audit_log(
            record=record,
            actor=actor,
            action=AttendanceAuditLog.ACTION_PUNCH_OUT,
            before_data=before_data,
            after_data=snapshot_record(record),
            reason="Employee punched out.",
        )

    generate_monthly_summary(employee, month=today.month, year=today.year)
    return record, {"distance_meters": round(distance, 2) if distance is not None else None}


def get_day_status(employee: Employee, target_date: date) -> dict[str, Any]:
    assignment = get_active_assignment(employee, target_date)
    policy = get_active_policy(assignment)
    office_location = get_active_office_location(assignment, policy)

    record = AttendanceRecord.objects.filter(employee=employee, date=target_date).first()
    if record:
        payload = _serialize_record(record)
        payload["is_leave"] = False
        payload["is_holiday"] = False
        payload["is_week_off"] = False
        return payload

    if has_approved_leave(employee, target_date):
        return {
            "employee_id": employee.id,
            "employee_code": employee.employee_id,
            "employee_name": employee.name,
            "date": target_date.isoformat(),
            "punch_in_time": None,
            "punch_out_time": None,
            "working_hours": 0,
            "overtime_hours": 0,
            "status": AttendanceRecord.STATUS_LEAVE,
            "is_leave": True,
            "is_holiday": False,
            "is_week_off": False,
            "shift": assignment.shift.name if assignment and assignment.shift else None,
            "shift_id": assignment.shift_id if assignment and assignment.shift_id else None,
            "office_location": office_location.name if office_location else None,
        }

    if is_holiday(target_date, office_location):
        return {
            "employee_id": employee.id,
            "employee_code": employee.employee_id,
            "employee_name": employee.name,
            "date": target_date.isoformat(),
            "punch_in_time": None,
            "punch_out_time": None,
            "working_hours": 0,
            "overtime_hours": 0,
            "status": AttendanceRecord.STATUS_HOLIDAY,
            "is_leave": False,
            "is_holiday": True,
            "is_week_off": False,
            "shift": assignment.shift.name if assignment and assignment.shift else None,
            "shift_id": assignment.shift_id if assignment and assignment.shift_id else None,
            "office_location": office_location.name if office_location else None,
        }

    if is_week_off(target_date, policy):
        return {
            "employee_id": employee.id,
            "employee_code": employee.employee_id,
            "employee_name": employee.name,
            "date": target_date.isoformat(),
            "punch_in_time": None,
            "punch_out_time": None,
            "working_hours": 0,
            "overtime_hours": 0,
            "status": AttendanceRecord.STATUS_WEEK_OFF,
            "is_leave": False,
            "is_holiday": False,
            "is_week_off": True,
            "shift": assignment.shift.name if assignment and assignment.shift else None,
            "shift_id": assignment.shift_id if assignment and assignment.shift_id else None,
            "office_location": office_location.name if office_location else None,
        }

    current_day = timezone.localdate()
    status = AttendanceRecord.STATUS_ABSENT if target_date < current_day else "NOT_MARKED"
    return {
        "employee_id": employee.id,
        "employee_code": employee.employee_id,
        "employee_name": employee.name,
        "date": target_date.isoformat(),
        "punch_in_time": None,
        "punch_out_time": None,
        "working_hours": 0,
        "overtime_hours": 0,
        "status": status,
        "is_leave": False,
        "is_holiday": False,
        "is_week_off": False,
        "shift": assignment.shift.name if assignment and assignment.shift else None,
        "shift_id": assignment.shift_id if assignment and assignment.shift_id else None,
        "office_location": office_location.name if office_location else None,
    }


def daterange(start_date: date, end_date: date):
    current = start_date
    while current <= end_date:
        yield current
        current += timedelta(days=1)


def generate_monthly_summary(employee: Employee, *, month: int, year: int) -> MonthlyAttendanceSummary:
    last_day = calendar.monthrange(year, month)[1]
    period_start = date(year, month, 1)
    period_end = date(year, month, last_day)
    today = timezone.localdate()
    effective_end = min(period_end, today)

    if effective_end < period_start:
        effective_end = period_start - timedelta(days=1)

    records = AttendanceRecord.objects.filter(
        employee=employee,
        date__gte=period_start,
        date__lte=period_end,
    ).select_related("office_location")
    records_by_date = {record.date: record for record in records}

    leave_days_set: set[date] = set()
    leave_requests = LeaveRequest.objects.filter(
        employee=employee,
        status="APPROVED",
        start_date__lte=period_end,
        end_date__gte=period_start,
    )
    for leave in leave_requests:
        leave_start = max(leave.start_date, period_start)
        leave_end = min(leave.end_date, period_end)
        for day in daterange(leave_start, leave_end):
            leave_days_set.add(day)

    present_days = 0
    late_days = 0
    leave_days = 0
    absent_days = 0
    half_days = 0
    total_working_hours = Decimal("0.00")
    overtime_hours = Decimal("0.00")

    if effective_end >= period_start:
        for day in daterange(period_start, effective_end):
            assignment = get_active_assignment(employee, day)
            policy = get_active_policy(assignment)
            office_location = get_active_office_location(assignment, policy)

            # Holiday/week off days are excluded from absent computation.
            if is_holiday(day, office_location):
                continue
            if is_week_off(day, policy):
                continue

            if day in leave_days_set:
                leave_days += 1
                continue

            record = records_by_date.get(day)
            if not record:
                absent_days += 1
                continue

            total_working_hours += _safe_decimal(record.working_hours)
            overtime_hours += _safe_decimal(record.overtime_hours)

            if record.status == AttendanceRecord.STATUS_PRESENT:
                present_days += 1
            elif record.status == AttendanceRecord.STATUS_LATE:
                present_days += 1
                late_days += 1
            elif record.status == AttendanceRecord.STATUS_HALF_DAY:
                half_days += 1
            elif record.status == AttendanceRecord.STATUS_LEAVE:
                leave_days += 1
            elif record.status == AttendanceRecord.STATUS_ABSENT:
                absent_days += 1

    payable_days = Decimal(present_days + leave_days) + (Decimal(half_days) / Decimal("2"))

    summary, _ = MonthlyAttendanceSummary.objects.update_or_create(
        employee=employee,
        month=month,
        year=year,
        defaults={
            "present_days": present_days,
            "late_days": late_days,
            "leave_days": leave_days,
            "absent_days": absent_days,
            "half_days": half_days,
            "total_working_hours": total_working_hours.quantize(Decimal("0.01")),
            "overtime_hours": overtime_hours.quantize(Decimal("0.01")),
            "payable_days": payable_days.quantize(Decimal("0.01")),
        },
    )
    return summary


def generate_monthly_summaries(month: int, year: int, employee_ids: list[int] | None = None) -> list[MonthlyAttendanceSummary]:
    employees_qs = Employee.objects.filter(is_active=True, doj__lte=date(year, month, 1))
    if employee_ids:
        employees_qs = employees_qs.filter(id__in=employee_ids)
    summaries: list[MonthlyAttendanceSummary] = []
    for employee in employees_qs:
        summaries.append(generate_monthly_summary(employee, month=month, year=year))
    return summaries


def mark_absent_for_date(target_date: date | None = None) -> dict[str, int]:
    if target_date is None:
        target_date = timezone.localdate()

    created_count = 0
    updated_count = 0

    employees = Employee.objects.filter(is_active=True, doj__lte=target_date).iterator()
    actor = ActorContext(actor_type=AttendanceAuditLog.ACTOR_SYSTEM)

    for employee in employees:
        assignment = get_active_assignment(employee, target_date)
        policy = get_active_policy(assignment)
        office_location = get_active_office_location(assignment, policy)

        if policy and not policy.auto_mark_absent:
            continue
        if has_approved_leave(employee, target_date):
            continue
        if is_holiday(target_date, office_location):
            continue
        if is_week_off(target_date, policy):
            continue

        with transaction.atomic():
            record, created = AttendanceRecord.objects.select_for_update().get_or_create(
                employee=employee,
                date=target_date,
                defaults={
                    "shift": assignment.shift if assignment else None,
                    "office_location": office_location,
                    "status": AttendanceRecord.STATUS_ABSENT,
                    "marked_by_system": True,
                },
            )

            before_data = snapshot_record(record)
            changed = False

            if created:
                created_count += 1
                changed = True
            elif not record.punch_in_time and record.status != AttendanceRecord.STATUS_ABSENT:
                record.status = AttendanceRecord.STATUS_ABSENT
                record.marked_by_system = True
                record.save(update_fields=["status", "marked_by_system", "updated_at"])
                updated_count += 1
                changed = True

            if changed:
                _sync_legacy_attendance(record)
                create_audit_log(
                    record=record,
                    actor=actor,
                    action=AttendanceAuditLog.ACTION_AUTO_ABSENT,
                    before_data=before_data,
                    after_data=snapshot_record(record),
                    reason="Daily automation marked employee absent.",
                )

        generate_monthly_summary(employee, month=target_date.month, year=target_date.year)

    return {
        "created": created_count,
        "updated": updated_count,
        "processed_date": int(target_date.strftime("%Y%m%d")),
    }


def ensure_leave_attendance_records(target_date: date | None = None) -> dict[str, int]:
    """
    Ensure attendance records exist for employees on approved leave for the given date.
    This creates LEAVE status records so leave days are properly counted in summaries.
    """
    if target_date is None:
        target_date = timezone.localdate()

    created_count = 0
    
    # Get all employees with approved leave on this date
    leave_requests = LeaveRequest.objects.filter(
        status="APPROVED",
        start_date__lte=target_date,
        end_date__gte=target_date,
    ).select_related("employee")

    actor = ActorContext(actor_type=AttendanceAuditLog.ACTOR_SYSTEM)

    for leave in leave_requests:
        employee = leave.employee
        if not employee.is_active:
            continue
            
        assignment = get_active_assignment(employee, target_date)
        policy = get_active_policy(assignment)
        office_location = get_active_office_location(assignment, policy)

        with transaction.atomic():
            record, created = AttendanceRecord.objects.select_for_update().get_or_create(
                employee=employee,
                date=target_date,
                defaults={
                    "shift": assignment.shift if assignment else None,
                    "office_location": office_location,
                    "status": AttendanceRecord.STATUS_LEAVE,
                    "marked_by_system": True,
                    "notes": f"Auto-created for approved leave ({leave.leave_type.name if leave.leave_type else 'N/A'})",
                },
            )

            if created:
                created_count += 1
                create_audit_log(
                    record=record,
                    actor=actor,
                    action=AttendanceAuditLog.ACTION_CREATE,
                    before_data={},
                    after_data=snapshot_record(record),
                    reason=f"Auto-created for approved leave ID: {leave.id}",
                )

        # Regenerate monthly summary for this employee
        generate_monthly_summary(employee, month=target_date.month, year=target_date.year)

    return {
        "created": created_count,
        "processed_date": int(target_date.strftime("%Y%m%d")),
    }


def get_payroll_metrics(employee: Employee, month: int, year: int) -> dict[str, Any]:
    summary = generate_monthly_summary(employee, month=month, year=year)
    working_days = summary.present_days + summary.leave_days + summary.absent_days + summary.half_days
    return {
        "employee_id": employee.id,
        "employee_code": employee.employee_id,
        "employee_name": employee.name,
        "month": month,
        "year": year,
        "working_days": working_days,
        "present_days": summary.present_days,
        "late_days": summary.late_days,
        "leave_days": summary.leave_days,
        "absent_days": summary.absent_days,
        "half_days": summary.half_days,
        "payable_days": float(summary.payable_days),
        "total_working_hours": float(summary.total_working_hours),
        "overtime_hours": float(summary.overtime_hours),
    }
