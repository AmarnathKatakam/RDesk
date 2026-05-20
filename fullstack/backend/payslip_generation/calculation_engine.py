"""
payslip_generation.calculation_engine — Milestone 3C

Component-wise payroll calculation engine.

Connects:
  - payroll_config.EmployeeSalaryAssignment  (which template + CTC)
  - payroll_config.SalaryTemplate / SalaryTemplateComponent  (which components + rates)
  - payroll_config.statutory_service  (PF / ESI / PT / LWF)
  - payslip_generation.PayrollRunItem  (output: totals)
  - payslip_generation.PayrollRunItemLine  (output: per-component breakdown)

Calculation order:
  1. Load active EmployeeSalaryAssignment for the payroll date
  2. Resolve monthly CTC
  3. Calculate FIXED_AMOUNT and PERCENTAGE_OF_CTC components first
  4. Calculate BASIC (needed for PERCENTAGE_OF_BASIC)
  5. Calculate PERCENTAGE_OF_BASIC components
  6. Calculate gross (sum of all EARNING components so far)
  7. Calculate PERCENTAGE_OF_GROSS components
  8. Apply proration factor to all earnings if LOP > 0
  9. Recompute gross after proration
  10. Compute statutory deductions via statutory_service
  11. Build PayrollRunItemLine records
  12. Compute totals and update PayrollRunItem

Public API:
    calculate_employee_payroll(run_item, payroll_date, lop_days, work_days, days_in_month)
        -> dict with totals and line items

    build_line_items_from_assignment(assignment, payroll_date, lop_days, work_days, days_in_month, employee_state)
        -> list[dict]  (not saved — pure calculation)
"""
from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from typing import Optional

from django.db import transaction

logger = logging.getLogger('payroll.calculation_engine')

ZERO = Decimal('0')
ONE = Decimal('1')


# ─── Month helpers ────────────────────────────────────────────────────────────

MONTH_NAME_TO_NUMBER = {
    'january': 1, 'february': 2, 'march': 3, 'april': 4,
    'may': 5, 'june': 6, 'july': 7, 'august': 8,
    'september': 9, 'october': 10, 'november': 11, 'december': 12,
}

MONTH_DAYS = {
    1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30,
    7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
}


def _month_number(month_str: str) -> int:
    """Convert month name string to number (1-12). Returns 1 on failure."""
    return MONTH_NAME_TO_NUMBER.get(month_str.lower().strip(), 1)


def _days_in_month(month_str: str, year: int) -> int:
    """Return calendar days in the given month/year."""
    import calendar
    mn = _month_number(month_str)
    return calendar.monthrange(year, mn)[1]


def _round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def _round0(value: Decimal) -> Decimal:
    return value.quantize(Decimal('1'), rounding=ROUND_HALF_UP)


# ─── Core calculation ─────────────────────────────────────────────────────────

def build_line_items_from_assignment(
    assignment,
    payroll_date: date,
    lop_days: int = 0,
    work_days: int = 0,
    days_in_month: int = 0,
    employee_state: str = 'KA',
    employee_gender: str = 'ALL',
) -> dict:
    """
    Pure calculation — builds line item dicts from a salary assignment.
    Does NOT touch the database.

    Returns:
        {
            'lines': list[dict],           # one dict per component
            'gross_earnings': Decimal,
            'total_deductions': Decimal,
            'employer_contributions': Decimal,
            'net_pay': Decimal,
            'payable_days': int,
            'proration_factor': Decimal,
            'notes': list[str],
        }
    """
    from payroll_config.statutory_service import compute_all_statutory

    notes = []
    lines = []

    # ── 1. Resolve template components ───────────────────────────────────────
    template = assignment.template
    monthly_ctc = assignment.monthly_ctc  # Decimal

    template_components = list(
        template.components
        .select_related('component')
        .filter(component__is_active=True)
        .order_by('display_order', 'component__display_order')
    )

    if not template_components:
        notes.append(f'Template {template.code} has no active components.')

    # ── 2. Proration factor ───────────────────────────────────────────────────
    if days_in_month <= 0:
        days_in_month = 30  # safe fallback
        notes.append('days_in_month not provided; defaulting to 30.')

    payable_days = max(0, days_in_month - lop_days)
    proration_factor = (
        Decimal(str(payable_days)) / Decimal(str(days_in_month))
        if days_in_month > 0 else ONE
    )

    # ── 3. First pass: compute non-statutory earnings ─────────────────────────
    # We need BASIC before we can compute PERCENTAGE_OF_BASIC components.
    # Pass 1: FIXED_AMOUNT + PERCENTAGE_OF_CTC (these don't depend on other components)
    component_values: dict[str, Decimal] = {}

    for tc in template_components:
        comp = tc.component
        if comp.component_type != 'EARNING':
            continue
        calc_type = tc.effective_calculation_type
        value = tc.effective_value

        if calc_type == 'FIXED_AMOUNT':
            component_values[comp.code] = _round2(Decimal(str(value)))
        elif calc_type == 'PERCENTAGE_OF_CTC':
            pct = Decimal(str(value)) / Decimal('100')
            component_values[comp.code] = _round2(monthly_ctc * pct)

    # Pass 2: PERCENTAGE_OF_BASIC (BASIC must be resolved first)
    basic_amount = component_values.get('BASIC', ZERO)
    for tc in template_components:
        comp = tc.component
        if comp.component_type != 'EARNING':
            continue
        if comp.code in component_values:
            continue  # already computed
        calc_type = tc.effective_calculation_type
        value = tc.effective_value

        if calc_type == 'PERCENTAGE_OF_BASIC':
            pct = Decimal(str(value)) / Decimal('100')
            component_values[comp.code] = _round2(basic_amount * pct)

    # Pass 3: PERCENTAGE_OF_GROSS (need gross from passes 1+2)
    pre_gross = sum(component_values.values(), ZERO)
    for tc in template_components:
        comp = tc.component
        if comp.component_type != 'EARNING':
            continue
        if comp.code in component_values:
            continue
        calc_type = tc.effective_calculation_type
        value = tc.effective_value

        if calc_type == 'PERCENTAGE_OF_GROSS':
            pct = Decimal(str(value)) / Decimal('100')
            component_values[comp.code] = _round2(pre_gross * pct)
        elif calc_type in ('STATUTORY', 'FORMULA'):
            # Earnings that are statutory/formula — skip for now, handled below
            pass
        else:
            notes.append(f'Component {comp.code}: unsupported calc_type {calc_type} for EARNING — skipped.')

    # ── 4. Apply proration to all earnings ────────────────────────────────────
    if proration_factor < ONE:
        prorated = {}
        for code, amt in component_values.items():
            prorated[code] = _round2(amt * proration_factor)
        component_values = prorated
        notes.append(
            f'Proration applied: {payable_days}/{days_in_month} days '
            f'(factor={float(proration_factor):.4f})'
        )

    # ── 5. Compute gross after proration ─────────────────────────────────────
    gross_earnings = sum(component_values.values(), ZERO)
    basic_amount = component_values.get('BASIC', ZERO)

    # ── 6. Compute PF wage (sum of is_pf_applicable components) ──────────────
    pf_wage = ZERO
    for tc in template_components:
        comp = tc.component
        if comp.component_type == 'EARNING' and comp.is_pf_applicable:
            pf_wage += component_values.get(comp.code, ZERO)

    # ── 7. Statutory deductions ───────────────────────────────────────────────
    month_number = payroll_date.month
    statutory = compute_all_statutory(
        pf_wage=pf_wage,
        gross_wage=gross_earnings,
        state=employee_state,
        payroll_date=payroll_date,
        month_number=month_number,
        gender=employee_gender,
    )

    if not statutory['config_found']:
        notes.append(
            f'No StatutoryConfig found for state={employee_state}, date={payroll_date}. '
            'Statutory deductions set to zero.'
        )

    # ── 8. Build earning lines ────────────────────────────────────────────────
    for tc in template_components:
        comp = tc.component
        if comp.component_type != 'EARNING':
            continue
        amount = component_values.get(comp.code, ZERO)
        lines.append({
            'component': comp,
            'code': comp.code,
            'name': comp.name,
            'component_type': 'EARNING',
            'calculation_type': tc.effective_calculation_type,
            'rate': tc.effective_value,
            'amount': amount,
            'is_statutory': comp.is_statutory,
            'is_taxable': comp.is_taxable,
            'affects_gross': comp.affects_gross,
            'affects_net_pay': comp.affects_net,
            'affects_ctc': comp.affects_ctc,
            'display_order': tc.display_order or comp.display_order,
        })

    # ── 9. Build deduction lines (non-statutory first) ────────────────────────
    for tc in template_components:
        comp = tc.component
        if comp.component_type != 'DEDUCTION' or comp.is_statutory:
            continue
        calc_type = tc.effective_calculation_type
        value = tc.effective_value
        amount = ZERO

        if calc_type == 'FIXED_AMOUNT':
            amount = _round2(Decimal(str(value)) * proration_factor)
        elif calc_type == 'PERCENTAGE_OF_BASIC':
            pct = Decimal(str(value)) / Decimal('100')
            amount = _round2(basic_amount * pct)
        elif calc_type == 'PERCENTAGE_OF_GROSS':
            pct = Decimal(str(value)) / Decimal('100')
            amount = _round2(gross_earnings * pct)
        elif calc_type == 'PERCENTAGE_OF_CTC':
            pct = Decimal(str(value)) / Decimal('100')
            amount = _round2(monthly_ctc * pct * proration_factor)
        else:
            notes.append(f'Deduction {comp.code}: unsupported calc_type {calc_type} — skipped.')

        lines.append({
            'component': comp,
            'code': comp.code,
            'name': comp.name,
            'component_type': 'DEDUCTION',
            'calculation_type': calc_type,
            'rate': value,
            'amount': amount,
            'is_statutory': False,
            'is_taxable': comp.is_taxable,
            'affects_gross': False,
            'affects_net_pay': True,
            'affects_ctc': comp.affects_ctc,
            'display_order': tc.display_order or comp.display_order,
        })

    # ── 10. Inject statutory deduction lines ─────────────────────────────────
    statutory_deduction_lines = [
        {
            'code': 'PF_EMP',
            'name': 'PF Employee Contribution',
            'component_type': 'DEDUCTION',
            'calculation_type': 'STATUTORY',
            'rate': ZERO,
            'amount': statutory['pf_employee'],
            'is_statutory': True,
            'is_taxable': False,
            'affects_gross': False,
            'affects_net_pay': True,
            'affects_ctc': True,
            'display_order': 200,
        },
        {
            'code': 'ESI_EMP',
            'name': 'ESI Employee Contribution',
            'component_type': 'DEDUCTION',
            'calculation_type': 'STATUTORY',
            'rate': ZERO,
            'amount': statutory['esi_employee'],
            'is_statutory': True,
            'is_taxable': False,
            'affects_gross': False,
            'affects_net_pay': True,
            'affects_ctc': True,
            'display_order': 210,
        },
        {
            'code': 'PT',
            'name': 'Professional Tax',
            'component_type': 'DEDUCTION',
            'calculation_type': 'STATUTORY',
            'rate': ZERO,
            'amount': statutory['pt_amount'],
            'is_statutory': True,
            'is_taxable': False,
            'affects_gross': False,
            'affects_net_pay': True,
            'affects_ctc': False,
            'display_order': 220,
        },
        {
            'code': 'LWF_EMP',
            'name': 'LWF Employee Contribution',
            'component_type': 'DEDUCTION',
            'calculation_type': 'STATUTORY',
            'rate': ZERO,
            'amount': statutory['lwf_employee'],
            'is_statutory': True,
            'is_taxable': False,
            'affects_gross': False,
            'affects_net_pay': True,
            'affects_ctc': False,
            'display_order': 230,
        },
    ]

    # Only include statutory lines with non-zero amounts (or always include PF/PT for clarity)
    for line in statutory_deduction_lines:
        # Resolve component FK if it exists
        line['component'] = _get_component_by_code(line['code'])
        lines.append(line)

    # ── 11. Compute TDS and inject as deduction line ─────────────────────────
    tds_amount = ZERO
    try:
        from payroll_config.tds_service import compute_tds_for_employee

        # Sum taxable earnings for this month
        gross_taxable = sum(
            line['amount'] for line in lines
            if line['component_type'] == 'EARNING' and line.get('is_taxable', False)
        )
        pf_emp_amount = statutory.get('pf_employee', ZERO)

        tds_result = compute_tds_for_employee(
            employee=assignment.employee,
            month=payroll_date.month,
            year=payroll_date.year,
            payroll_date=payroll_date,
            gross_taxable_this_month=gross_taxable,
            pf_employee_this_month=pf_emp_amount,
        )
        tds_amount = tds_result.monthly_tds
        if tds_result.warnings:
            notes.extend(tds_result.warnings)
    except Exception as tds_exc:
        notes.append(f'TDS computation skipped: {tds_exc}')

    if tds_amount > ZERO:
        lines.append({
            'component': _get_component_by_code('TDS'),
            'code': 'TDS',
            'name': 'Income Tax (TDS)',
            'component_type': 'DEDUCTION',
            'calculation_type': 'STATUTORY',
            'rate': ZERO,
            'amount': tds_amount,
            'is_statutory': True,
            'is_taxable': False,
            'affects_gross': False,
            'affects_net_pay': True,
            'affects_ctc': False,
            'display_order': 240,
        })

    # ── 12. Employer contribution lines ──────────────────────────────────────
    employer_lines = [
        {
            'code': 'PF_EMPLOYER',
            'name': 'PF Employer Contribution',
            'component_type': 'EMPLOYER_CONTRIBUTION',
            'calculation_type': 'STATUTORY',
            'rate': ZERO,
            'amount': statutory['pf_employer'],
            'is_statutory': True,
            'is_taxable': False,
            'affects_gross': False,
            'affects_net_pay': False,
            'affects_ctc': True,
            'display_order': 300,
        },
        {
            'code': 'ESI_EMPLOYER',
            'name': 'ESI Employer Contribution',
            'component_type': 'EMPLOYER_CONTRIBUTION',
            'calculation_type': 'STATUTORY',
            'rate': ZERO,
            'amount': statutory['esi_employer'],
            'is_statutory': True,
            'is_taxable': False,
            'affects_gross': False,
            'affects_net_pay': False,
            'affects_ctc': True,
            'display_order': 310,
        },
        {
            'code': 'LWF_EMPLOYER',
            'name': 'LWF Employer Contribution',
            'component_type': 'EMPLOYER_CONTRIBUTION',
            'calculation_type': 'STATUTORY',
            'rate': ZERO,
            'amount': statutory['lwf_employer'],
            'is_statutory': True,
            'is_taxable': False,
            'affects_gross': False,
            'affects_net_pay': False,
            'affects_ctc': True,
            'display_order': 320,
        },
    ]
    for line in employer_lines:
        line['component'] = _get_component_by_code(line['code'])
        lines.append(line)

    # ── 13. Compute totals from lines ─────────────────────────────────────────
    total_deductions = sum(
        line['amount'] for line in lines
        if line['component_type'] == 'DEDUCTION' and line['affects_net_pay']
    )
    employer_contributions = sum(
        line['amount'] for line in lines
        if line['component_type'] == 'EMPLOYER_CONTRIBUTION'
    )
    net_pay = gross_earnings - total_deductions

    return {
        'lines': lines,
        'gross_earnings': _round2(gross_earnings),
        'total_deductions': _round2(total_deductions),
        'employer_contributions': _round2(employer_contributions),
        'net_pay': _round2(net_pay),
        'payable_days': payable_days,
        'days_in_month': days_in_month,
        'proration_factor': proration_factor,
        'notes': notes,
        'statutory': statutory,
        'tds_amount': tds_amount,
    }


def _get_component_by_code(code: str):
    """Fetch SalaryComponent by code, return None if not found."""
    try:
        from payroll_config.models import SalaryComponent
        return SalaryComponent.objects.filter(code=code).first()
    except Exception:
        return None


# ─── DB write: save line items ────────────────────────────────────────────────

@transaction.atomic
def save_line_items(run_item, calc_result: dict) -> None:
    """
    Delete existing lines for this run_item and create new ones from calc_result.
    Must be called inside an atomic block.
    """
    from .models import PayrollRunItemLine

    # Delete old lines (safe — run is not yet locked when this is called)
    PayrollRunItemLine.objects.filter(run_item=run_item).delete()

    lines_to_create = []
    for line in calc_result['lines']:
        lines_to_create.append(PayrollRunItemLine(
            run_item=run_item,
            component=line.get('component'),
            code=line['code'],
            name=line['name'],
            component_type=line['component_type'],
            calculation_type=line['calculation_type'],
            rate=line.get('rate', ZERO),
            amount=line['amount'],
            is_statutory=line.get('is_statutory', False),
            is_taxable=line.get('is_taxable', False),
            affects_gross=line.get('affects_gross', False),
            affects_net_pay=line.get('affects_net_pay', True),
            affects_ctc=line.get('affects_ctc', False),
            display_order=line.get('display_order', 0),
        ))

    PayrollRunItemLine.objects.bulk_create(lines_to_create)


# ─── Main entry point ─────────────────────────────────────────────────────────

@transaction.atomic
def calculate_employee_payroll(
    run_item,
    payroll_date: date,
    lop_days: int = 0,
    work_days: int = 0,
    days_in_month: int = 0,
    employee_state: str = 'KA',
    employee_gender: str = 'ALL',
) -> dict:
    """
    Calculate payroll for one employee run_item using the 3C engine.

    Loads the active EmployeeSalaryAssignment, runs the calculation,
    injects PayrollInputAdjustment records as additional line items (3E),
    saves line items, and updates the run_item totals.

    Returns the calc_result dict (same as build_line_items_from_assignment).
    Raises ValueError if no active salary assignment found.
    """
    from payroll_config.services import get_assignment_at_date

    employee = run_item.employee

    # Resolve assignment at payroll date
    assignment = get_assignment_at_date(employee, payroll_date)
    if not assignment:
        raise ValueError(
            f'No salary assignment found for {employee.name} on {payroll_date}. '
            'Assign a salary template before running payroll.'
        )

    calc_result = build_line_items_from_assignment(
        assignment=assignment,
        payroll_date=payroll_date,
        lop_days=lop_days,
        work_days=work_days,
        days_in_month=days_in_month,
        employee_state=employee_state,
        employee_gender=employee_gender,
    )

    # ── 3E: Inject PayrollInputAdjustment records ─────────────────────────────
    # Determine month name from payroll_date
    month_name = payroll_date.strftime('%B')  # e.g. "March"
    year = payroll_date.year

    # Determine salary_type from the run (via run_item.run)
    salary_type = 'SALARY'
    try:
        salary_type = run_item.run.salary_type
    except Exception:
        pass

    calc_result = _inject_adjustments(
        calc_result=calc_result,
        employee=employee,
        month=month_name,
        year=year,
        salary_type=salary_type,
    )

    # Save line items
    save_line_items(run_item, calc_result)

    # Update run_item totals
    run_item.salary_assignment = assignment
    run_item.gross_earnings = calc_result['gross_earnings']
    run_item.total_deductions = calc_result['total_deductions']
    run_item.employer_contributions = calc_result['employer_contributions']
    run_item.net_pay = calc_result['net_pay']
    run_item.lop_days = lop_days
    run_item.work_days = work_days
    run_item.payable_days = calc_result['payable_days']
    run_item.days_in_month = calc_result['days_in_month']
    run_item.proration_factor = calc_result['proration_factor']
    run_item.calculation_source = 'SALARY_ASSIGNMENT'
    run_item.calculation_notes = '\n'.join(calc_result['notes'])
    run_item.tds_amount = calc_result.get('tds_amount', ZERO)
    run_item.save()

    # Write YTD record for TDS audit trail
    try:
        from payroll_config.tds_service import (
            compute_tds_for_employee, write_ytd_record, _get_financial_year
        )
        from payroll_config.tds_service import _get_financial_year as _fy
        financial_year = _fy(payroll_date)
        gross_taxable = sum(
            line['amount'] for line in calc_result['lines']
            if line['component_type'] == 'EARNING' and line.get('is_taxable', False)
        )
        pf_emp = calc_result['statutory'].get('pf_employee', ZERO)
        tds_result = compute_tds_for_employee(
            employee=employee,
            month=payroll_date.month,
            year=payroll_date.year,
            payroll_date=payroll_date,
            gross_taxable_this_month=gross_taxable,
            pf_employee_this_month=pf_emp,
        )
        payroll_run = getattr(run_item, 'run', None)
        write_ytd_record(
            employee=employee,
            financial_year=financial_year,
            month=payroll_date.month,
            year=payroll_date.year,
            result=tds_result,
            gross_earnings_this_month=calc_result['gross_earnings'],
            payroll_run=payroll_run,
        )
    except Exception as ytd_exc:
        logger.warning('YTD record write failed for %s: %s', employee.name, ytd_exc)

    logger.info(
        'Calculated payroll for %s: gross=₹%s, deductions=₹%s, net=₹%s [assignment=%s]',
        employee.name,
        calc_result['gross_earnings'],
        calc_result['total_deductions'],
        calc_result['net_pay'],
        assignment.id,
    )

    return calc_result


def _inject_adjustments(
    calc_result: dict,
    employee,
    month: str,
    year: int,
    salary_type: str = 'SALARY',
) -> dict:
    """
    Fetch active PayrollInputAdjustment records for this employee/period and
    inject them as additional line items into calc_result.

    EARNING / BONUS / INCENTIVE / ARREAR / REIMBURSEMENT → add to gross_earnings
    DEDUCTION / LOAN / OTHER → add to total_deductions (reduce net_pay)
    """
    try:
        from employees.models import PayrollInputAdjustment
    except ImportError:
        return calc_result  # graceful fallback if model not yet migrated

    adjustments = list(
        PayrollInputAdjustment.objects.filter(
            employee=employee,
            month=month,
            year=year,
            salary_type=salary_type,
            is_active=True,
        ).select_related('component')
    )

    if not adjustments:
        return calc_result

    EARNING_TYPES = {'EARNING', 'BONUS', 'INCENTIVE', 'ARREAR', 'REIMBURSEMENT'}
    DEDUCTION_TYPES = {'DEDUCTION', 'LOAN', 'OTHER'}

    extra_gross = ZERO
    extra_deductions = ZERO
    notes = list(calc_result.get('notes', []))
    lines = list(calc_result.get('lines', []))

    for adj in adjustments:
        adj_type = adj.adjustment_type
        amount = Decimal(str(adj.amount))

        if adj_type in EARNING_TYPES:
            component_type = 'EARNING'
            affects_gross = True
            affects_net_pay = True
            extra_gross += amount
        else:
            component_type = 'DEDUCTION'
            affects_gross = False
            affects_net_pay = True
            extra_deductions += amount

        lines.append({
            'component': adj.component,
            'code': f'ADJ_{adj.id}',
            'name': adj.label,
            'component_type': component_type,
            'calculation_type': 'ADJUSTMENT',
            'rate': ZERO,
            'amount': _round2(amount),
            'is_statutory': False,
            'is_taxable': adj.is_taxable,
            'affects_gross': affects_gross,
            'affects_net_pay': affects_net_pay,
            'affects_ctc': False,
            'display_order': 500,
        })
        notes.append(f'Adjustment: {adj.label} ₹{amount} ({adj_type})')

    new_gross = _round2(calc_result['gross_earnings'] + extra_gross)
    new_deductions = _round2(calc_result['total_deductions'] + extra_deductions)
    new_net = _round2(new_gross - new_deductions)

    return {
        **calc_result,
        'lines': lines,
        'gross_earnings': new_gross,
        'total_deductions': new_deductions,
        'net_pay': new_net,
        'notes': notes,
    }
