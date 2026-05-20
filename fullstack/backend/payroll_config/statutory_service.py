"""
payroll_config.statutory_service — Milestone 3B

Statutory applicability resolution helpers.
These are the functions the payroll engine will call to determine:
  - Which StatutoryConfig applies for a given state + date
  - Whether PF applies for an employee given their PF wage
  - Whether ESI applies for an employee given their gross wage
  - What PT amount applies for an employee given their state + gross wage + month

Design:
  - All thresholds and rates come from StatutoryConfig — nothing is hardcoded here
  - Functions are pure (no side effects) — safe to call from payroll calculation loops
  - All monetary inputs/outputs are Decimal for precision

Public API:
    get_statutory_config(state, payroll_date) -> StatutoryConfig | None
    get_financial_year(payroll_date) -> str
    is_pf_applicable(pf_wage, config) -> bool
    compute_pf(pf_wage, config) -> dict[str, Decimal]
    is_esi_applicable(gross_wage, config) -> bool
    compute_esi(gross_wage, config) -> dict[str, Decimal]
    resolve_pt_amount(gross_wage, state, payroll_date, month_number) -> Decimal
    compute_lwf(config, month_number) -> dict[str, Decimal]
"""
from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP, ROUND_DOWN, ROUND_UP
from datetime import date

logger = logging.getLogger('payroll_config.statutory')


# ─── Financial Year Helpers ───────────────────────────────────────────────────

def get_financial_year(payroll_date: date) -> str:
    """
    Return the Indian financial year string for a given date.
    Indian FY runs April 1 to March 31.

    Examples:
      date(2025, 4, 1)  → '2025-26'
      date(2026, 3, 31) → '2025-26'
      date(2026, 4, 1)  → '2026-27'
    """
    if payroll_date.month >= 4:
        start = payroll_date.year
    else:
        start = payroll_date.year - 1
    end = (start + 1) % 100  # last two digits
    return f"{start}-{end:02d}"


def get_financial_year_range(financial_year: str) -> tuple[date, date]:
    """
    Return (start_date, end_date) for a financial year string like '2025-26'.
    """
    start_year = int(financial_year.split('-')[0])
    return date(start_year, 4, 1), date(start_year + 1, 3, 31)


# ─── Config Resolution ────────────────────────────────────────────────────────

def get_statutory_config(state: str, payroll_date: date):
    """
    Return the active StatutoryConfig for a given state and payroll date.

    Resolution order:
      1. Find active configs for the state + financial year of payroll_date
      2. Filter by effective_from <= payroll_date <= effective_to (or effective_to is null)
      3. Return the most recently effective one

    Returns None if no config found — caller should handle gracefully.
    """
    from .models import StatutoryConfig

    fy = get_financial_year(payroll_date)

    qs = StatutoryConfig.objects.filter(
        state=state,
        financial_year=fy,
        is_active=True,
        effective_from__lte=payroll_date,
    ).filter(
        # effective_to is null (still active) OR effective_to >= payroll_date
        effective_to__isnull=True,
    )

    config = qs.order_by('-effective_from').first()

    if not config:
        # Try with effective_to set
        config = StatutoryConfig.objects.filter(
            state=state,
            financial_year=fy,
            is_active=True,
            effective_from__lte=payroll_date,
            effective_to__gte=payroll_date,
        ).order_by('-effective_from').first()

    if not config:
        logger.warning(
            'No active StatutoryConfig found for state=%s, date=%s (FY %s). '
            'Statutory deductions will be skipped.',
            state, payroll_date, fy,
        )

    return config


# ─── PF Helpers ───────────────────────────────────────────────────────────────

def is_pf_applicable(pf_wage: Decimal, config) -> bool:
    """
    Return True if PF should be deducted for an employee with the given PF wage.

    PF is applicable when:
      - config.pf_enabled is True
      - pf_wage > 0

    Note: Employees earning Basic > ₹15,000 can voluntarily opt out of PF.
    That opt-out is an employee-level flag (not yet implemented — Phase 3C).
    For now, PF applies to all employees with pf_wage > 0 when pf_enabled.

    The wage ceiling is applied in compute_pf(), not here.
    """
    if not config or not config.pf_enabled:
        return False
    return pf_wage > Decimal('0')


def _apply_pf_rounding(amount: Decimal, rounding_mode: str) -> Decimal:
    if rounding_mode == 'FLOOR':
        return amount.quantize(Decimal('1'), rounding=ROUND_DOWN)
    elif rounding_mode == 'CEIL':
        return amount.quantize(Decimal('1'), rounding=ROUND_UP)
    else:  # ROUND (default)
        return amount.quantize(Decimal('1'), rounding=ROUND_HALF_UP)


def compute_pf(pf_wage: Decimal, config) -> dict:
    """
    Compute PF employee and employer contributions.

    pf_wage = sum of all components where is_pf_applicable=True (typically Basic + DA).
    The contribution is calculated on min(pf_wage, config.pf_wage_ceiling).

    Returns:
        {
            'pf_wage_used': Decimal,       # actual wage used (after ceiling)
            'pf_employee': Decimal,        # employee contribution
            'pf_employer': Decimal,        # employer contribution
            'ceiling_applied': bool,       # whether ceiling was applied
        }
    """
    if not config or not config.pf_enabled or pf_wage <= Decimal('0'):
        return {
            'pf_wage_used': Decimal('0'),
            'pf_employee': Decimal('0'),
            'pf_employer': Decimal('0'),
            'ceiling_applied': False,
        }

    ceiling = config.pf_wage_ceiling
    ceiling_applied = pf_wage > ceiling
    wage_used = min(pf_wage, ceiling)

    emp_contribution = _apply_pf_rounding(
        wage_used * config.pf_employee_rate,
        config.pf_rounding,
    )
    employer_contribution = _apply_pf_rounding(
        wage_used * config.pf_employer_rate,
        config.pf_rounding,
    )

    return {
        'pf_wage_used': wage_used,
        'pf_employee': emp_contribution,
        'pf_employer': employer_contribution,
        'ceiling_applied': ceiling_applied,
    }


# ─── ESI Helpers ──────────────────────────────────────────────────────────────

def is_esi_applicable(gross_wage: Decimal, config) -> bool:
    """
    Return True if ESI should be deducted for an employee with the given gross wage.

    ESI is applicable when:
      - config.esi_enabled is True
      - gross_wage <= config.esi_wage_threshold (₹21,000 by default)

    Once an employee's gross exceeds the threshold, ESI stops for that contribution period.
    """
    if not config or not config.esi_enabled:
        return False
    return gross_wage <= config.esi_wage_threshold


def compute_esi(gross_wage: Decimal, config) -> dict:
    """
    Compute ESI employee and employer contributions.

    Returns:
        {
            'esi_employee': Decimal,
            'esi_employer': Decimal,
            'applicable': bool,
        }
    """
    if not is_esi_applicable(gross_wage, config):
        return {
            'esi_employee': Decimal('0'),
            'esi_employer': Decimal('0'),
            'applicable': False,
        }

    emp = (gross_wage * config.esi_employee_rate).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    employer = (gross_wage * config.esi_employer_rate).quantize(Decimal('1'), rounding=ROUND_HALF_UP)

    return {
        'esi_employee': emp,
        'esi_employer': employer,
        'applicable': True,
    }


# ─── PT Helpers ───────────────────────────────────────────────────────────────

def resolve_pt_amount(
    gross_wage: Decimal,
    state: str,
    payroll_date: date,
    month_number: int,
    gender: str = 'ALL',
) -> Decimal:
    """
    Resolve the Professional Tax amount for an employee.

    Resolution:
      1. Get active StatutoryConfig for (state, payroll_date)
      2. If PT not enabled, return 0
      3. Find matching ProfessionalTaxSlab by wage range + month + gender
      4. Return pt_amount from the matching slab (0 if no slab matches)

    month_number: 1=January … 12=December (calendar month of the payroll period)
    gender: 'ALL', 'MALE', or 'FEMALE' — most states use 'ALL'
    """
    from .models import ProfessionalTaxSlab

    config = get_statutory_config(state, payroll_date)
    if not config or not config.pt_enabled:
        return Decimal('0')

    slabs = (
        ProfessionalTaxSlab.objects
        .filter(statutory_config=config, is_active=True)
        .filter(gender__in=['ALL', gender])
        .order_by('display_order', 'min_monthly_wage')
    )

    for slab in slabs:
        if not slab.wage_in_range(gross_wage):
            continue
        if not slab.applies_to_month(month_number):
            continue
        return slab.pt_amount

    return Decimal('0')


# ─── LWF Helpers ─────────────────────────────────────────────────────────────

def compute_lwf(config, month_number: int) -> dict:
    """
    Compute LWF employee and employer contributions for a given month.

    Returns zero amounts if LWF is not enabled or month is not applicable.
    """
    if not config or not config.lwf_enabled:
        return {'lwf_employee': Decimal('0'), 'lwf_employer': Decimal('0'), 'applicable': False}

    applicable_months = config.lwf_applicable_months
    if applicable_months and month_number not in applicable_months:
        return {'lwf_employee': Decimal('0'), 'lwf_employer': Decimal('0'), 'applicable': False}

    return {
        'lwf_employee': config.lwf_employee_amount,
        'lwf_employer': config.lwf_employer_amount,
        'applicable': True,
    }


# ─── Convenience: full statutory deductions for one employee ─────────────────

def compute_all_statutory(
    pf_wage: Decimal,
    gross_wage: Decimal,
    state: str,
    payroll_date: date,
    month_number: int,
    gender: str = 'ALL',
) -> dict:
    """
    Compute all statutory deductions for one employee in one payroll period.

    Returns a flat dict with all statutory amounts — ready to be used by the
    payroll calculation engine in Phase 3C.

    Args:
        pf_wage:      Sum of PF-applicable components (Basic + DA typically)
        gross_wage:   Total gross earnings (all EARNING components)
        state:        Employee's work state code (e.g. 'KA', 'MH')
        payroll_date: Any date within the payroll month (e.g. last day of month)
        month_number: Calendar month number (1-12)
        gender:       Employee gender for PT resolution ('ALL', 'MALE', 'FEMALE')

    Returns:
        {
            'pf_wage_used':    Decimal,
            'pf_employee':     Decimal,
            'pf_employer':     Decimal,
            'pf_ceiling_applied': bool,
            'esi_employee':    Decimal,
            'esi_employer':    Decimal,
            'esi_applicable':  bool,
            'pt_amount':       Decimal,
            'lwf_employee':    Decimal,
            'lwf_employer':    Decimal,
            'lwf_applicable':  bool,
            'config_found':    bool,
        }
    """
    config = get_statutory_config(state, payroll_date)

    pf_result = compute_pf(pf_wage, config)
    esi_result = compute_esi(gross_wage, config)
    pt_amount = resolve_pt_amount(gross_wage, state, payroll_date, month_number, gender)
    lwf_result = compute_lwf(config, month_number)

    return {
        'pf_wage_used': pf_result['pf_wage_used'],
        'pf_employee': pf_result['pf_employee'],
        'pf_employer': pf_result['pf_employer'],
        'pf_ceiling_applied': pf_result['ceiling_applied'],
        'esi_employee': esi_result['esi_employee'],
        'esi_employer': esi_result['esi_employer'],
        'esi_applicable': esi_result['applicable'],
        'pt_amount': pt_amount,
        'lwf_employee': lwf_result['lwf_employee'],
        'lwf_employer': lwf_result['lwf_employer'],
        'lwf_applicable': lwf_result['applicable'],
        'config_found': config is not None,
    }
