"""
payroll_calendar_service.py — Phase B: Attendance Proration Engine

Single source of truth for computing payable days for any employee/month/year.
Pure service layer — no views, no models defined here.

Public API:
    compute_payable_days(employee, month, year, proration_basis) -> PayableDaysResult
    get_working_days(month, year, week_off_days, state=None) -> tuple[int, int, int]
    get_attendance_summary(employee, month, year) -> dict
    get_leave_summary(employee, month, year) -> dict
    create_or_update_snapshot(run_item, result, lop_override_used) -> PayrollInputSnapshot
"""
from __future__ import annotations

import calendar
import logging
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Optional

logger = logging.getLogger('payroll.calendar_service')


@dataclass
class PayableDaysResult:
    employee_id: int
    month: int
    year: int
    total_calendar_days: int
    weekly_off_days: int
    holiday_days: int
    working_days: int
    present_days: Decimal
    leave_days_paid: Decimal
    leave_days_unpaid: Decimal
    absent_days: int
    lop_days: Decimal
    payable_days: Decimal
    proration_basis: str
    proration_factor: Decimal
    has_attendance_data: bool
    warnings: list = field(default_factory=list)


# ─── Holiday resolution ───────────────────────────────────────────────────────

def _get_applicable_holiday_dates(month: int, year: int, state: Optional[str], week_off_set: set) -> set:
    """
    Return a set of date objects for NATIONAL holidays in the given month/year
    that do NOT fall on a weekly-off day.

    Applies both state-specific and company-wide (state=None) calendars.
    """
    from attendance.models import HolidayCalendar, Holiday

    holiday_dates: set = set()
    calendar_ids = []

    # State-specific calendar
    if state:
        state_cal = (
            HolidayCalendar.objects
            .filter(year=year, state=state, is_active=True)
            .values_list('id', flat=True)
            .first()
        )
        if state_cal:
            calendar_ids.append(state_cal)

    # Company-wide calendar (state=None)
    company_cal = (
        HolidayCalendar.objects
        .filter(year=year, state__isnull=True, is_active=True)
        .values_list('id', flat=True)
        .first()
    )
    if company_cal:
        calendar_ids.append(company_cal)

    if not calendar_ids:
        return holiday_dates

    dates = Holiday.objects.filter(
        calendar_id__in=calendar_ids,
        date__year=year,
        date__month=month,
        holiday_type='NATIONAL',
        is_active=True,
    ).values_list('date', flat=True)

    for d in dates:
        # Don't double-count holidays that fall on a weekly-off day
        if d.weekday() not in week_off_set:
            holiday_dates.add(d)

    return holiday_dates


# ─── Core helpers ─────────────────────────────────────────────────────────────

def get_working_days(
    month: int,
    year: int,
    week_off_days: list,
    state: Optional[str] = None,
) -> tuple:
    """
    Returns (total_calendar_days, weekly_off_count, holiday_count).

    week_off_days: list of weekday integers (0=Mon … 6=Sun)
    """
    total_calendar = calendar.monthrange(year, month)[1]
    week_off_set = set(week_off_days)

    weekly_off_count = sum(
        1 for day in range(1, total_calendar + 1)
        if date(year, month, day).weekday() in week_off_set
    )

    holiday_dates = _get_applicable_holiday_dates(month, year, state, week_off_set)
    holiday_count = len(holiday_dates)

    return (total_calendar, weekly_off_count, holiday_count)


def get_attendance_summary(employee, month: int, year: int) -> dict:
    """
    Aggregate AttendanceRecord statuses for the given employee/month/year.

    Returns:
        {
            'present': Decimal,   # PRESENT + LATE count as 1.0 each
            'absent': int,
            'half_day': Decimal,  # HALF_DAY counts as 0.5 each
            'late': int,
            'total_records': int,
        }
    """
    from attendance.models import AttendanceRecord

    records = AttendanceRecord.objects.filter(
        employee=employee,
        date__year=year,
        date__month=month,
    )

    present = Decimal('0')
    absent = 0
    half_day = Decimal('0')
    late = 0

    for r in records:
        if r.status in (AttendanceRecord.STATUS_PRESENT, AttendanceRecord.STATUS_LATE):
            present += Decimal('1')
            if r.status == AttendanceRecord.STATUS_LATE:
                late += 1
        elif r.status == AttendanceRecord.STATUS_HALF_DAY:
            half_day += Decimal('0.5')
        elif r.status == AttendanceRecord.STATUS_ABSENT:
            absent += 1

    return {
        'present': present + half_day,
        'absent': absent,
        'half_day': half_day,
        'late': late,
        'total_records': records.count(),
    }


def get_leave_summary(employee, month: int, year: int) -> dict:
    """
    Aggregate approved LeaveRequest records overlapping the given month/year.

    Returns:
        {
            'paid_days': Decimal,
            'unpaid_days': Decimal,
            'requests': list of leave request ids,
        }
    """
    from employees.models import LeaveRequest

    first_day = date(year, month, 1)
    last_day = date(year, month, calendar.monthrange(year, month)[1])

    leave_requests = LeaveRequest.objects.filter(
        employee=employee,
        status='APPROVED',
        start_date__lte=last_day,
        end_date__gte=first_day,
    ).select_related('leave_type')

    paid_days = Decimal('0')
    unpaid_days = Decimal('0')
    request_ids = []

    for lr in leave_requests:
        request_ids.append(lr.id)
        day_breakdown = lr.day_breakdown or []
        if day_breakdown:
            matched_breakdown = False
            for item in day_breakdown:
                raw_date = item.get('date')
                if not raw_date:
                    continue
                try:
                    leave_date = date.fromisoformat(str(raw_date))
                except ValueError:
                    continue
                if leave_date < first_day or leave_date > last_day:
                    continue
                matched_breakdown = True
                status = str(item.get('status') or '').upper()
                if status == 'PAID':
                    paid_days += Decimal('1')
                elif status == 'LOP':
                    unpaid_days += Decimal('1')
            if matched_breakdown:
                continue

        overlap_start = max(lr.start_date, first_day)
        overlap_end = min(lr.end_date, last_day)
        overlap_days = (overlap_end - overlap_start).days + 1
        if overlap_days <= 0:
            continue

        days = Decimal(str(overlap_days))
        if lr.leave_type is not None and lr.leave_type.is_paid:
            paid_days += days
        else:
            unpaid_days += days

    return {
        'paid_days': paid_days,
        'unpaid_days': unpaid_days,
        'requests': request_ids,
    }


# ─── Main computation ─────────────────────────────────────────────────────────

def compute_payable_days(
    employee,
    month: int,
    year: int,
    proration_basis: str = 'CALENDAR_DAYS',
) -> PayableDaysResult:
    """
    Compute payable days for an employee in a given month/year.

    Postconditions:
      - working_days == total_calendar_days - weekly_off_days - holiday_days
      - lop_days == absent_days + leave_days_unpaid
      - payable_days == max(0, working_days - lop_days)
      - 0 <= proration_factor <= 1.0
    """
    warnings = []

    # Step 1: Resolve attendance policy → week_off_days
    week_off_days = _resolve_week_off_days(employee)

    # Step 2: Resolve employee state for holiday lookup
    state = getattr(employee, 'location_state', None)

    # Step 3: Calendar skeleton
    total_calendar, weekly_off_count, holiday_count = get_working_days(
        month, year, week_off_days, state
    )
    working_days = total_calendar - weekly_off_count - holiday_count

    if holiday_count == 0:
        # Check if any calendar exists at all
        from attendance.models import HolidayCalendar
        if not HolidayCalendar.objects.filter(year=year, is_active=True).exists():
            warnings.append(f"No active HolidayCalendar found for year {year}. holiday_days=0.")

    # Step 4: Attendance summary
    att = get_attendance_summary(employee, month, year)
    present_days = att['present']
    absent_days = att['absent']
    has_attendance_data = att['total_records'] > 0

    if not has_attendance_data:
        warnings.append(
            f"No attendance data found for employee {employee.employee_id} "
            f"in {month}/{year}."
        )

    # Step 5: Leave summary
    leave = get_leave_summary(employee, month, year)
    leave_days_paid = leave['paid_days']
    leave_days_unpaid = leave['unpaid_days']

    # Step 6: LOP and payable days
    lop_days = Decimal(str(absent_days)) + leave_days_unpaid
    payable_days = max(Decimal('0'), Decimal(str(working_days)) - lop_days)

    if lop_days > working_days:
        warnings.append(
            f"LOP days ({lop_days}) exceed working days ({working_days}) — "
            "check attendance data."
        )

    # Step 7: Proration factor
    if proration_basis == 'WORKING_DAYS':
        basis = Decimal(str(working_days)) if working_days > 0 else Decimal('1')
    else:
        basis = Decimal(str(total_calendar)) if total_calendar > 0 else Decimal('1')

    proration_factor = (payable_days / basis).quantize(Decimal('0.0001'))
    # Clamp to [0, 1]
    proration_factor = max(Decimal('0'), min(Decimal('1'), proration_factor))

    return PayableDaysResult(
        employee_id=employee.id,
        month=month,
        year=year,
        total_calendar_days=total_calendar,
        weekly_off_days=weekly_off_count,
        holiday_days=holiday_count,
        working_days=working_days,
        present_days=present_days,
        leave_days_paid=leave_days_paid,
        leave_days_unpaid=leave_days_unpaid,
        absent_days=absent_days,
        lop_days=lop_days,
        payable_days=payable_days,
        proration_basis=proration_basis,
        proration_factor=proration_factor,
        has_attendance_data=has_attendance_data,
        warnings=warnings,
    )


def _resolve_week_off_days(employee) -> list:
    """
    Resolve week_off_days from the employee's active EmployeeShiftAssignment → AttendancePolicy.
    Falls back to [5, 6] (Sat+Sun) if none found.
    """
    try:
        from attendance.models import EmployeeShiftAssignment
        today = date.today()
        assignment = (
            EmployeeShiftAssignment.objects
            .filter(employee=employee, is_active=True)
            .select_related('policy')
            .filter(effective_from__lte=today)
            .order_by('-effective_from')
            .first()
        )
        if assignment and assignment.policy and assignment.policy.week_off_days:
            return assignment.policy.week_off_days
    except Exception:
        pass
    return [5, 6]  # default: Saturday + Sunday


# ─── Snapshot management ──────────────────────────────────────────────────────

def create_or_update_snapshot(run_item, result, lop_override_used: bool = False):
    """
    Create or update a PayrollInputSnapshot for the given run_item.

    Guards against modification after LOCKED/RELEASED status.
    """
    from .models import PayrollInputSnapshot

    if run_item.run.status in ('LOCKED', 'RELEASED', 'PAID'):
        raise ValueError(
            f"Cannot modify snapshot for run_item {run_item.id}: "
            f"run is in '{run_item.run.status}' status."
        )

    # result may be None when lop_override is used without attendance data
    if result is None:
        return None

    snapshot, _ = PayrollInputSnapshot.objects.update_or_create(
        run_item=run_item,
        defaults={
            'total_calendar_days': result.total_calendar_days,
            'weekly_off_days': result.weekly_off_days,
            'holiday_days': result.holiday_days,
            'working_days': result.working_days,
            'present_days': result.present_days,
            'leave_days_paid': result.leave_days_paid,
            'leave_days_unpaid': result.leave_days_unpaid,
            'absent_days': result.absent_days,
            'lop_days': result.lop_days,
            'payable_days': result.payable_days,
            'proration_basis': result.proration_basis,
            'proration_factor': result.proration_factor,
            'lop_override_used': lop_override_used,
            'warnings': result.warnings,
        },
    )
    return snapshot


# ─── Active PayrollConfig helper ─────────────────────────────────────────────

def get_active_proration_basis() -> str:
    """Return the active proration basis from PayrollConfig, defaulting to CALENDAR_DAYS."""
    try:
        from payroll_config.models import PayrollConfig
        config = PayrollConfig.objects.filter(is_active=True).order_by('-effective_from').first()
        if config:
            return config.proration_basis
    except Exception:
        pass
    return 'CALENDAR_DAYS'
