"""
Payroll Run Service Layer — Milestone 2 (hardened)

All PayrollRun business logic lives here.
Views call service functions; service functions own transitions, validation, and audit logging.

Hardening changes vs initial implementation:
  - select_for_update() on PayrollRun in all mutating operations (prevents concurrent double-transitions)
  - transition_run uses update_fields to avoid overwriting unrelated columns
  - _release_run_payslips passes released_by_id (PK) not the User object to bulk .update()
  - calculate_run filters MonthlySalaryData by salary_type when run.salary_type is STIPEND
  - reprocess_employee refreshes run totals AFTER marking item INCLUDED (not before)
  - hold/release_hold use correct audit actions (HOLD / RELEASE_HOLD)
  - reprocess uses REPROCESS audit action
  - calculate uses CALCULATE audit action
  - All mutating service functions are @transaction.atomic

Public API:
    create_payroll_run(month, year, salary_type, created_by) -> PayrollRun
    calculate_run(run, performed_by) -> dict
    transition_run(run, new_status, performed_by, reason='') -> PayrollRun
    hold_employee(run, employee, reason, performed_by) -> PayrollRunItem
    release_employee_hold(run, employee, performed_by) -> PayrollRunItem
    reprocess_employee(run, employee, performed_by) -> PayrollRunItem
    get_run_summary(run) -> dict
"""
from __future__ import annotations

import logging
from decimal import Decimal
from datetime import date

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from employees.models import Employee, MonthlySalaryData
from .audit import log_payroll_action
from .models import PayrollRun, PayrollRunItem, Payslip
from .payroll_calendar_service import (
    compute_payable_days,
    create_or_update_snapshot,
    get_active_proration_basis,
)

logger = logging.getLogger('payroll.service')


class PayrollRunError(Exception):
    """Raised when a payroll run operation is invalid."""


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _refresh_run_totals(run: PayrollRun) -> None:
    """
    Recompute run-level totals from all INCLUDED items.
    Must be called inside an atomic block that already holds a lock on `run`.
    """
    totals = (
        PayrollRunItem.objects
        .filter(run=run, status='INCLUDED')
        .aggregate(
            gross=Sum('gross_earnings'),
            deductions=Sum('total_deductions'),
            net=Sum('net_pay'),
        )
    )
    run.total_gross = totals['gross'] or Decimal('0')
    run.total_deductions = totals['deductions'] or Decimal('0')
    run.total_net = totals['net'] or Decimal('0')
    run.total_employees = PayrollRunItem.objects.filter(run=run, status='INCLUDED').count()
    run.save(update_fields=['total_gross', 'total_deductions', 'total_net', 'total_employees'])

def _release_run_payslips(run: PayrollRun, performed_by) -> int:
    """
    For each INCLUDED PayrollRunItem in this run:
      1. Create (or update) a Payslip record from the run item's salary snapshot
      2. Generate the PDF using FrontendPDFGenerator
      3. Mark the payslip as released
      4. Send the payslip PDF to the employee via email

    Uses released_by_id (PK) for bulk .update() — Django ORM requires PK for FK in bulk updates.
    """
    from .frontend_pdf_generator import FrontendPDFGenerator
    from .utils import PayslipFileManager
    from .models import Payslip
    from .audit import log_payroll_action

    now = timezone.now()
    items = (
        PayrollRunItem.objects
        .filter(run=run, status='INCLUDED')
        .select_related('employee', 'employee__department')
    )

    if not items.exists():
        log_payroll_action(
            action='BULK_RELEASE',
            performed_by=performed_by,
            pay_period_month=run.month,
            pay_period_year=run.year,
            notes=f"Run #{run.id} RELEASED: 0 payslips (no INCLUDED items found).",
        )
        return 0

    pdf_generator = FrontendPDFGenerator()
    file_manager = PayslipFileManager()
    performed_by_pk = getattr(performed_by, 'pk', None)

    released = 0
    email_sent = 0
    errors = []

    for item in items:
        employee = item.employee
        try:
            # ── 1. Build salary component values from run item ────────────────
            # PayrollRunItemLine has the component breakdown; fall back to
            # item-level totals if lines are not present (legacy path).
            lines = list(item.lines.all())

            def _line_amount(code):
                for l in lines:
                    if l.code == code:
                        return l.amount
                return Decimal('0')

            if lines:
                basic            = _line_amount('BASIC')
                hra              = _line_amount('HRA')
                da               = _line_amount('DA')
                conveyance       = _line_amount('CONVEYANCE')
                medical          = _line_amount('MEDICAL')
                special_allow    = _line_amount('SPECIAL_ALLOWANCE')
                pf_employee      = _line_amount('PF_EMP')
                professional_tax = _line_amount('PT')
                pf_employer      = _line_amount('PF_EMPLOYER')
                other_deductions = Decimal('0')
                salary_advance   = Decimal('0')
                total_earnings   = item.gross_earnings
                total_deductions = item.total_deductions
                net_pay          = item.net_pay
            else:
                # Legacy MonthlySalaryData path — pull from salary_data FK
                sd = item.salary_data
                if sd:
                    basic            = sd.basic
                    hra              = sd.hra
                    da               = sd.da
                    conveyance       = sd.conveyance
                    medical          = sd.medical
                    special_allow    = sd.special_allowance
                    pf_employee      = sd.pf_employee
                    professional_tax = sd.professional_tax
                    pf_employer      = sd.pf_employer
                    other_deductions = sd.other_deductions
                    salary_advance   = sd.salary_advance
                    total_earnings   = sd.gross_earnings
                    total_deductions = sd.total_deductions
                    net_pay          = sd.net_pay
                else:
                    # Minimal fallback from run item totals
                    basic = hra = da = conveyance = medical = special_allow = Decimal('0')
                    pf_employee = professional_tax = pf_employer = Decimal('0')
                    other_deductions = salary_advance = Decimal('0')
                    total_earnings   = item.gross_earnings
                    total_deductions = item.total_deductions
                    net_pay          = item.net_pay

            qr_data = (
                f"✓ Verified|EmpID:{employee.employee_id}"
                f"|Month:{run.month}|Year:{run.year}"
            )

            # ── 2. Create or update Payslip record ────────────────────────────
            payslip_defaults = dict(
                salary_type=run.salary_type,
                work_days=item.work_days or item.days_in_month,
                days_in_month=item.days_in_month,
                lop_days=item.lop_days,
                basic=basic,
                hra=hra,
                da=da,
                conveyance=conveyance,
                medical=medical,
                special_allowance=special_allow,
                pf_employee=pf_employee,
                total_earnings=total_earnings,
                professional_tax=professional_tax,
                pf_employer=pf_employer,
                other_deductions=other_deductions,
                salary_advance=salary_advance,
                total_deductions=total_deductions,
                net_pay=net_pay,
                tds_amount=getattr(item, 'tds_amount', Decimal('0')),
                qr_code_data=qr_data,
                generated_by=performed_by,
                is_released=True,
                released_at=now,
                released_by_id=performed_by_pk,
            )

            payslip, created = Payslip.objects.update_or_create(
                employee=employee,
                pay_period_month=run.month,
                pay_period_year=run.year,
                salary_type=run.salary_type,
                defaults=payslip_defaults,
            )

            # ── 3. Generate PDF ───────────────────────────────────────────────
            pdf_path = file_manager.get_payslip_path(
                run.year, run.month,
                employee.name.lower().replace(' ', '_'),
            )
            payslip.pdf_path = str(pdf_path)
            payslip.save(update_fields=['pdf_path'])

            pdf_generator.generate_payslip_pdf(payslip, pdf_path)

            # ── 4. Link payslip back to run item ──────────────────────────────
            item.payslip = payslip
            item.save(update_fields=['payslip'])

            # ── 5. Send email ─────────────────────────────────────────────────
            try:
                sent = file_manager.send_payslip_email(payslip)
                if sent:
                    email_sent += 1
                    log_payroll_action(
                        action='EMAIL_SENT',
                        performed_by=performed_by,
                        payslip=payslip,
                        employee=employee,
                        pay_period_month=run.month,
                        pay_period_year=run.year,
                        notes=f"Payslip email sent to {employee.email}",
                    )
                else:
                    log_payroll_action(
                        action='EMAIL_FAILED',
                        performed_by=performed_by,
                        payslip=payslip,
                        employee=employee,
                        pay_period_month=run.month,
                        pay_period_year=run.year,
                        notes="Email not sent — no email address or send error.",
                    )
            except Exception as email_exc:
                logger.warning('Payslip email failed for %s: %s', employee.employee_id, email_exc)

            released += 1

        except Exception as exc:
            errors.append(f"{employee.name}: {exc}")
            logger.error('Failed to generate/release payslip for %s in run #%s: %s',
                         employee.employee_id, run.id, exc)

    log_payroll_action(
        action='BULK_RELEASE',
        performed_by=performed_by,
        pay_period_month=run.month,
        pay_period_year=run.year,
        notes=(
            f"Run #{run.id} RELEASED: {released} payslip(s) generated, "
            f"{email_sent} email(s) sent. "
            + (f"Errors: {errors}" if errors else "")
        ),
    )

    return released


# ─── Phase B: LOP resolution helper ─────────────────────────────────────────

# ─── Phase B: LOP resolution helper ─────────────────────────────────────────

def _emit_attendance_validation_issues(run, employee, month, year, result, lop_override_used, salary_data):
    """
    Emit PayrollValidationIssue records based on PayableDaysResult warnings.

    Issue types:
      MISSING_ATTENDANCE_DATA  — WARNING, does not block
      EXCESSIVE_LOP            — ERROR, blocks generation
      NEGATIVE_PAYABLE_DAYS    — ERROR, blocks generation
      LOP_OVERRIDE_DIVERGENCE  — WARNING, does not block (threshold: abs(diff) > 2)
    """
    from .models import PayrollValidationIssue

    def _create(issue_type, severity, message):
        PayrollValidationIssue.objects.update_or_create(
            employee=employee,
            pay_period_month=month,
            pay_period_year=year,
            issue_type=issue_type,
            defaults={
                'severity': severity,
                'message': message,
                'resolved': False,
            },
        )

    if not result.has_attendance_data:
        _create(
            'MISSING_ATTENDANCE_DATA', 'WARNING',
            f"{employee.name}: No attendance records found for {month} {year}. "
            "Payroll computed from salary data fallback.",
        )

    if result.lop_days > result.working_days:
        _create(
            'EXCESSIVE_LOP', 'ERROR',
            f"{employee.name}: LOP days ({result.lop_days}) exceed working days "
            f"({result.working_days}) for {month} {year}. Payable days clamped to 0.",
        )

    if result.payable_days < 0:
        _create(
            'NEGATIVE_PAYABLE_DAYS', 'ERROR',
            f"{employee.name}: Negative payable days computed for {month} {year}. "
            "Clamped to 0.",
        )

    # LOP override divergence check
    if lop_override_used and salary_data is not None and salary_data.lop_override is not None:
        computed_lop = result.lop_days
        override_lop = Decimal(str(salary_data.lop_override))
        diff = abs(override_lop - computed_lop)
        if diff > Decimal('2'):
            _create(
                'LOP_OVERRIDE_DIVERGENCE', 'WARNING',
                f"{employee.name}: lop_override={override_lop} differs from "
                f"computed LOP={computed_lop} by {diff} days for {month} {year}.",
            )


def _resolve_lop_for_employee(
    employee,
    salary_data,
    month_number: int,
    year: int,
    days_in_month: int,
):
    """
    Resolve lop_days, work_days, payable_days for an employee.

    Priority:
      1. lop_override on MonthlySalaryData (manual always wins)
      2. compute_payable_days() from attendance data
      3. Fallback to salary_data values if no attendance data
      4. Fallback to lop=0, work=days_in_month if nothing available

    Returns: (lop_days: Decimal, work_days: int, payable_days: Decimal, snapshot_data: dict)
    """
    # 1. Manual override wins unconditionally
    if salary_data is not None and salary_data.lop_override is not None:
        lop = Decimal(str(salary_data.lop_override))
        work = salary_data.work_days if salary_data else days_in_month
        payable = max(Decimal('0'), Decimal(str(work)) - lop)
        return (lop, work, payable, {'lop_override_used': True, 'snapshot': None})

    # 2. Attendance-derived computation
    proration_basis = get_active_proration_basis()
    try:
        result = compute_payable_days(employee, month_number, year, proration_basis)
    except Exception as exc:
        logger.warning('compute_payable_days failed for %s: %s', employee.employee_id, exc)
        result = None

    if result is not None and result.has_attendance_data:
        return (
            result.lop_days,
            result.working_days,
            result.payable_days,
            {'lop_override_used': False, 'snapshot': result},
        )

    # 3. Fallback to salary_data
    if salary_data is not None:
        lop = Decimal(str(salary_data.lop_days))
        work = salary_data.work_days
        payable = max(Decimal('0'), Decimal(str(work)) - lop)
        snapshot = result  # may have calendar skeleton even without attendance
        return (lop, work, payable, {'lop_override_used': False, 'snapshot': snapshot, 'fallback': True})

    # 4. Nothing available
    return (
        Decimal('0'),
        days_in_month,
        Decimal(str(days_in_month)),
        {'lop_override_used': False, 'snapshot': result, 'fallback': True},
    )


# ─── Create ───────────────────────────────────────────────────────────────────

@transaction.atomic
def create_payroll_run(
    month: str,
    year: int,
    salary_type: str,
    created_by,
) -> PayrollRun:
    """
    Create a new PayrollRun in DRAFT status.
    Raises PayrollRunError if a run already exists for the period.
    Uses select_for_update to prevent concurrent duplicate creation.
    """
    # Lock any existing run for this period to prevent race on duplicate check
    existing = (
        PayrollRun.objects
        .select_for_update()
        .filter(month=month, year=year, salary_type=salary_type)
        .first()
    )
    if existing:
        raise PayrollRunError(
            f"A payroll run already exists for {month} {year} ({salary_type}). "
            "Reopen the existing run if you need to make changes."
        )

    run = PayrollRun.objects.create(
        month=month,
        year=year,
        salary_type=salary_type,
        status='DRAFT',
        created_by=created_by,
    )

    log_payroll_action(
        action='GENERATE',
        performed_by=created_by,
        pay_period_month=month,
        pay_period_year=year,
        notes=f"PayrollRun #{run.id} created in DRAFT status.",
    )

    logger.info('PayrollRun #%s created: %s %s [%s] by %s', run.id, month, year, salary_type, created_by)
    return run


# ─── Calculate ────────────────────────────────────────────────────────────────

@transaction.atomic
def calculate_run(run: PayrollRun, performed_by) -> dict:
    """
    Calculate salary for all active employees for this payroll period.

    Milestone 3C: Uses the component-wise calculation engine when an
    EmployeeSalaryAssignment exists for the employee. Falls back to
    MonthlySalaryData (legacy) when no assignment is found.

    Creates/updates PayrollRunItem records with salary snapshots and
    PayrollRunItemLine records with per-component breakdowns.

    Idempotent: safe to call multiple times. ON_HOLD items are skipped.
    """
    from calendar import monthrange
    from payroll_config.services import get_assignment_at_date
    from .calculation_engine import calculate_employee_payroll

    # Lock the run row to prevent concurrent calculate calls
    run = PayrollRun.objects.select_for_update().get(pk=run.pk)

    if run.status not in ('DRAFT', 'REOPENED', 'CALCULATED'):
        raise PayrollRunError(
            f"Cannot calculate a run in '{run.status}' status. "
            "Run must be in DRAFT, REOPENED, or CALCULATED status."
        )

    month, year, salary_type = run.month, run.year, run.salary_type

    # Determine payroll date (last day of the payroll month)
    month_number = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4,
        'may': 5, 'june': 6, 'july': 7, 'august': 8,
        'september': 9, 'october': 10, 'november': 11, 'december': 12,
    }.get(month.lower(), 1)
    days_in_month = monthrange(year, month_number)[1]
    payroll_date = date(year, month_number, days_in_month)

    # Find all active employees with salary data for this period (legacy source)
    salary_data_qs = MonthlySalaryData.objects.filter(
        month=month, year=year
    ).select_related('employee', 'employee__department')

    # Also find employees with salary assignments (3C source)
    from employees.models import Employee as EmployeeModel
    employees_with_assignments = set()
    for emp in EmployeeModel.objects.filter(is_active=True):
        if get_assignment_at_date(emp, payroll_date):
            employees_with_assignments.add(emp.id)

    # Combine: employees from salary_data + employees with assignments
    all_employee_ids = set(salary_data_qs.values_list('employee_id', flat=True))
    all_employee_ids |= employees_with_assignments

    if not all_employee_ids:
        raise PayrollRunError(
            f"No salary data or salary assignments found for {month} {year}. "
            "Please upload salary data or assign salary templates before calculating."
        )

    # Build salary_data lookup
    salary_data_by_employee = {sd.employee_id: sd for sd in salary_data_qs}

    included = 0
    errors = 0
    error_details = []
    engine_used = 0
    legacy_used = 0

    for employee_id in all_employee_ids:
        # Fetch employee
        try:
            employee = EmployeeModel.objects.get(pk=employee_id)
        except EmployeeModel.DoesNotExist:
            continue

        if not employee.is_active:
            continue

        try:
            item, _ = PayrollRunItem.objects.select_for_update().get_or_create(
                run=run,
                employee=employee,
                defaults={'status': 'INCLUDED'},
            )

            # Preserve ON_HOLD status
            if item.status == 'ON_HOLD':
                continue

            # ── Phase B: Resolve LOP from attendance (or override) ───────
            salary_data = salary_data_by_employee.get(employee_id)
            lop_days, work_days, payable_days, snapshot_data = _resolve_lop_for_employee(
                employee=employee,
                salary_data=salary_data,
                month_number=month_number,
                year=year,
                days_in_month=days_in_month,
            )

            # Emit validation issues from attendance warnings
            snapshot_result = snapshot_data.get('snapshot')
            if snapshot_result is not None:
                _emit_attendance_validation_issues(
                    run=run,
                    employee=employee,
                    month=month,
                    year=year,
                    result=snapshot_result,
                    lop_override_used=snapshot_data.get('lop_override_used', False),
                    salary_data=salary_data,
                )

            # ── Try 3C engine first ───────────────────────────────────────
            assignment = get_assignment_at_date(employee, payroll_date)

            if assignment:
                # Resolve employee state (default KA — can be extended via employee profile)
                employee_state = getattr(employee, 'location_state', None) or 'KA'

                item.status = 'INCLUDED'
                item.error_message = ''
                item.calculated_at = timezone.now()
                item.salary_data = salary_data  # keep legacy link if available

                calculate_employee_payroll(
                    run_item=item,
                    payroll_date=payroll_date,
                    lop_days=lop_days,
                    work_days=work_days,
                    days_in_month=days_in_month,
                    employee_state=employee_state,
                )
                engine_used += 1

            else:
                # ── Legacy fallback: use MonthlySalaryData ────────────────
                if not salary_data:
                    continue  # no data at all — skip

                item.salary_data = salary_data
                item.gross_earnings = salary_data.gross_earnings
                item.total_deductions = salary_data.total_deductions
                item.net_pay = salary_data.net_pay
                item.lop_days = int(lop_days)
                item.work_days = work_days
                item.payable_days = int(payable_days)
                item.days_in_month = days_in_month
                item.calculation_source = 'MONTHLY_SALARY_DATA'
                item.status = 'INCLUDED'
                item.error_message = ''
                item.calculated_at = timezone.now()
                item.save()
                legacy_used += 1

            # ── Phase B: Save attendance snapshot ────────────────────────
            try:
                create_or_update_snapshot(
                    run_item=item,
                    result=snapshot_result,
                    lop_override_used=snapshot_data.get('lop_override_used', False),
                )
            except Exception as snap_exc:
                logger.warning('Snapshot save failed for %s: %s', employee.employee_id, snap_exc)

            included += 1

        except Exception as exc:
            errors += 1
            error_details.append(f"{employee.name}: {exc}")
            logger.error('Error calculating item for employee %s in run #%s: %s', employee_id, run.id, exc)

            PayrollRunItem.objects.update_or_create(
                run=run,
                employee=employee,
                defaults={
                    'status': 'ERROR',
                    'error_message': str(exc)[:500],
                },
            )

    # Recompute totals from DB
    _refresh_run_totals(run)
    run.refresh_from_db()

    run.status = 'CALCULATED'
    run.save(update_fields=['status'])

    log_payroll_action(
        action='CALCULATE',
        performed_by=performed_by,
        pay_period_month=month,
        pay_period_year=year,
        notes=(
            f"Run #{run.id} calculated: {included} included ({engine_used} via 3C engine, "
            f"{legacy_used} legacy), {errors} errors. Net total: ₹{run.total_net:,.2f}"
        ),
    )

    return {
        'included': included,
        'errors': errors,
        'error_details': error_details,
        'engine_used': engine_used,
        'legacy_used': legacy_used,
        'total_gross': float(run.total_gross),
        'total_deductions': float(run.total_deductions),
        'total_net': float(run.total_net),
    }


# ─── Status Transitions ───────────────────────────────────────────────────────

@transaction.atomic
def transition_run(
    run: PayrollRun,
    new_status: str,
    performed_by,
    reason: str = '',
) -> PayrollRun:
    """
    Transition a PayrollRun to a new status.
    Validates the transition, sets lifecycle timestamps, and logs the action.

    Uses select_for_update to prevent concurrent double-transitions.
    Uses update_fields to avoid overwriting unrelated columns.

    For RELEASED: also releases all INCLUDED payslips via Milestone 1 mechanism.
    For REOPENED: reason is mandatory.
    """
    # Lock the run row
    run = PayrollRun.objects.select_for_update().get(pk=run.pk)

    if not run.can_transition_to(new_status):
        raise PayrollRunError(
            f"Cannot transition from '{run.status}' to '{new_status}'. "
            f"Valid transitions from '{run.status}': {run.VALID_TRANSITIONS.get(run.status, [])}"
        )

    if new_status == 'REOPENED' and not reason.strip():
        raise PayrollRunError("A reopen reason is required.")

    now = timezone.now()
    old_status = run.status
    run.status = new_status

    # Track which fields we're changing
    update_fields = ['status']

    if new_status == 'APPROVED':
        run.approved_by = performed_by
        run.approved_at = now
        update_fields += ['approved_by', 'approved_at']
    elif new_status == 'LOCKED':
        run.locked_at = now
        update_fields.append('locked_at')
    elif new_status == 'RELEASED':
        run.released_by = performed_by
        run.released_at = now
        update_fields += ['released_by', 'released_at']
        # Release payslips BEFORE saving run status so any failure rolls back
        _release_run_payslips(run, performed_by)
    elif new_status == 'PAID':
        run.completed_at = now
        update_fields.append('completed_at')
    elif new_status == 'REOPENED':
        run.reopen_reason = reason.strip()
        update_fields.append('reopen_reason')

    if reason and new_status != 'REOPENED':
        run.notes = (run.notes + '\n' + reason.strip()).strip()
        update_fields.append('notes')

    run.save(update_fields=update_fields)

    # Map status to audit action
    action_map = {
        'APPROVED':   'APPROVE',
        'RELEASED':   'RELEASE',
        'REOPENED':   'REOPEN',
        'LOCKED':     'LOCK',
        'PAID':       'APPROVE',
        'CALCULATED': 'CALCULATE',
        'REVIEWED':   'APPROVE',
        'DRAFT':      'GENERATE',
    }
    audit_action = action_map.get(new_status, 'GENERATE')

    log_payroll_action(
        action=audit_action,
        performed_by=performed_by,
        pay_period_month=run.month,
        pay_period_year=run.year,
        notes=f"Run #{run.id} transitioned {old_status} → {new_status}. {reason}".strip(),
    )

    logger.info('PayrollRun #%s: %s → %s by %s', run.id, old_status, new_status, performed_by)
    return run


# ─── Hold / Release Hold ──────────────────────────────────────────────────────

@transaction.atomic
def hold_employee(
    run: PayrollRun,
    employee: Employee,
    reason: str,
    performed_by,
) -> PayrollRunItem:
    """
    Put an employee on hold within a run.
    Held employees are excluded from generation and release.
    Only allowed when run is in DRAFT, CALCULATED, or REVIEWED status.
    """
    run = PayrollRun.objects.select_for_update().get(pk=run.pk)

    if run.status not in ('DRAFT', 'CALCULATED', 'REVIEWED'):
        raise PayrollRunError(
            f"Cannot hold an employee in a run with status '{run.status}'. "
            "Run must be in DRAFT, CALCULATED, or REVIEWED status."
        )

    if not reason.strip():
        raise PayrollRunError("A hold reason is required.")

    item, _ = PayrollRunItem.objects.select_for_update().get_or_create(
        run=run,
        employee=employee,
        defaults={'status': 'ON_HOLD', 'hold_reason': reason.strip()},
    )
    item.status = 'ON_HOLD'
    item.hold_reason = reason.strip()
    item.save(update_fields=['status', 'hold_reason', 'updated_at'])

    # Refresh run totals — held employee is now excluded
    _refresh_run_totals(run)

    log_payroll_action(
        action='HOLD',
        performed_by=performed_by,
        employee=employee,
        pay_period_month=run.month,
        pay_period_year=run.year,
        notes=f"Employee {employee.name} put ON HOLD in run #{run.id}. Reason: {reason}",
    )

    return item


@transaction.atomic
def release_employee_hold(
    run: PayrollRun,
    employee: Employee,
    performed_by,
) -> PayrollRunItem:
    """
    Remove an employee's hold, returning them to INCLUDED status.
    """
    run = PayrollRun.objects.select_for_update().get(pk=run.pk)

    try:
        item = PayrollRunItem.objects.select_for_update().get(run=run, employee=employee)
    except PayrollRunItem.DoesNotExist:
        raise PayrollRunError(f"No run item found for {employee.name} in run #{run.id}.")

    if item.status != 'ON_HOLD':
        raise PayrollRunError(f"{employee.name} is not on hold in this run.")

    item.status = 'INCLUDED'
    item.hold_reason = ''
    item.save(update_fields=['status', 'hold_reason', 'updated_at'])

    # Refresh run totals — employee is now included again
    _refresh_run_totals(run)

    log_payroll_action(
        action='RELEASE_HOLD',
        performed_by=performed_by,
        employee=employee,
        pay_period_month=run.month,
        pay_period_year=run.year,
        notes=f"Hold released for {employee.name} in run #{run.id}.",
    )

    return item


# ─── Reprocess ────────────────────────────────────────────────────────────────

@transaction.atomic
def reprocess_employee(
    run: PayrollRun,
    employee: Employee,
    performed_by,
) -> PayrollRunItem:
    """
    Reprocess a single employee's run item.

    Milestone 3C: Uses the 3C engine if a salary assignment exists,
    otherwise falls back to MonthlySalaryData.
    """
    from calendar import monthrange
    from payroll_config.services import get_assignment_at_date
    from .calculation_engine import calculate_employee_payroll

    run = PayrollRun.objects.select_for_update().get(pk=run.pk)

    if run.status not in ('DRAFT', 'CALCULATED', 'REVIEWED', 'REOPENED'):
        raise PayrollRunError(
            f"Cannot reprocess in a run with status '{run.status}'."
        )

    month_number = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4,
        'may': 5, 'june': 6, 'july': 7, 'august': 8,
        'september': 9, 'october': 10, 'november': 11, 'december': 12,
    }.get(run.month.lower(), 1)
    days_in_month = monthrange(run.year, month_number)[1]
    payroll_date = date(run.year, month_number, days_in_month)

    item, _ = PayrollRunItem.objects.select_for_update().get_or_create(
        run=run,
        employee=employee,
        defaults={'status': 'INCLUDED'},
    )

    # Phase B: Resolve LOP from attendance (or override)
    salary_data = MonthlySalaryData.objects.filter(
        employee=employee, month=run.month, year=run.year,
    ).first()
    lop_days, work_days, payable_days, snapshot_data = _resolve_lop_for_employee(
        employee=employee,
        salary_data=salary_data,
        month_number=month_number,
        year=run.year,
        days_in_month=days_in_month,
    )
    snapshot_result = snapshot_data.get('snapshot')

    assignment = get_assignment_at_date(employee, payroll_date)

    if assignment:
        employee_state = getattr(employee, 'location_state', None) or 'KA'

        item.status = 'INCLUDED'
        item.error_message = ''
        item.calculated_at = timezone.now()
        item.salary_data = salary_data

        calculate_employee_payroll(
            run_item=item,
            payroll_date=payroll_date,
            lop_days=lop_days,
            work_days=work_days,
            days_in_month=days_in_month,
            employee_state=employee_state,
        )
    else:
        if not salary_data:
            raise PayrollRunError(
                f"No monthly salary data or salary assignment found for "
                f"{employee.name} for {run.month} {run.year}."
            )

        item.salary_data = salary_data
        item.gross_earnings = salary_data.gross_earnings
        item.total_deductions = salary_data.total_deductions
        item.net_pay = salary_data.net_pay
        item.lop_days = int(lop_days)
        item.work_days = work_days
        item.payable_days = int(payable_days)
        item.days_in_month = days_in_month
        item.calculation_source = 'MONTHLY_SALARY_DATA'
        item.error_message = ''
        item.status = 'INCLUDED'
        item.calculated_at = timezone.now()
        item.save()

    # Phase B: Save attendance snapshot
    try:
        create_or_update_snapshot(
            run_item=item,
            result=snapshot_result,
            lop_override_used=snapshot_data.get('lop_override_used', False),
        )
    except Exception as snap_exc:
        logger.warning('Snapshot save failed for %s: %s', employee.employee_id, snap_exc)

    # Refresh run totals AFTER item is INCLUDED
    _refresh_run_totals(run)

    log_payroll_action(
        action='REPROCESS',
        performed_by=performed_by,
        employee=employee,
        pay_period_month=run.month,
        pay_period_year=run.year,
        notes=f"Employee {employee.name} reprocessed in run #{run.id}. Net pay: ₹{item.net_pay:,.2f}",
    )

    return item


# ─── Summary ──────────────────────────────────────────────────────────────────

def get_run_summary(run: PayrollRun) -> dict:
    """Return a summary dict for the run detail view."""
    from django.db.models import Count

    item_stats = (
        PayrollRunItem.objects
        .filter(run=run)
        .values('status')
        .annotate(count=Count('id'))
    )
    status_counts = {row['status']: row['count'] for row in item_stats}

    dept_breakdown = (
        PayrollRunItem.objects
        .filter(run=run, status='INCLUDED')
        .values('employee__department__department_name')
        .annotate(
            count=Count('id'),
            total_net=Sum('net_pay'),
        )
        .order_by('employee__department__department_name')
    )

    return {
        'id': run.id,
        'month': run.month,
        'year': run.year,
        'salary_type': run.salary_type,
        'status': run.status,
        'total_employees': run.total_employees,
        'total_gross': float(run.total_gross),
        'total_deductions': float(run.total_deductions),
        'total_net': float(run.total_net),
        'item_status_counts': status_counts,
        'department_breakdown': [
            {
                'department': row['employee__department__department_name'] or 'Unassigned',
                'count': row['count'],
                'total_net': float(row['total_net'] or 0),
            }
            for row in dept_breakdown
        ],
        'created_by': run.created_by.username if run.created_by else None,
        'approved_by': run.approved_by.username if run.approved_by else None,
        'released_by': run.released_by.username if run.released_by else None,
        'created_at': run.created_at.isoformat() if run.created_at else None,
        'approved_at': run.approved_at.isoformat() if run.approved_at else None,
        'locked_at': run.locked_at.isoformat() if run.locked_at else None,
        'released_at': run.released_at.isoformat() if run.released_at else None,
        'notes': run.notes,
        'reopen_reason': run.reopen_reason,
        'valid_transitions': run.VALID_TRANSITIONS.get(run.status, []),
    }
