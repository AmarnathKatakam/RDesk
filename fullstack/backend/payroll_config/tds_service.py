"""
payroll_config.tds_service — TDS / Income Tax Engine (Full Indian Compliance)

Deduction caps (FY 2025-26):
  80C                → ₹1,50,000
  80CCD(1B) NPS      → ₹50,000
  80D self           → ₹25,000
  80D parents        → ₹25,000 (₹50,000 if senior citizen)
  24(b) home loan    → ₹2,00,000
  80E education loan → no cap
  80G                → 100%/50%/with 10%-of-income limit (by donation_type)
  HRA                → min(HRA received, rent - 10% basic, 50%/40% basic)

Public API:
    compute_tds_for_employee(...) -> TDSResult
    compute_hra_exemption(hra_received, basic_salary, rent_paid_annual, is_metro) -> Decimal
    validate_declaration(data) -> list[str]
    get_ytd_record(employee, financial_year, month, year) -> EmployeeYTDRecord | None
    write_ytd_record(...) -> None
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from datetime import date

logger = logging.getLogger('payroll.tds_service')

ZERO = Decimal('0')

# ── Statutory caps ────────────────────────────────────────────────────────────
CAP_80C            = Decimal('150000')
CAP_NPS_80CCD1B    = Decimal('50000')
CAP_80D_SELF       = Decimal('25000')
CAP_80D_PARENTS    = Decimal('25000')
CAP_80D_PARENTS_SR = Decimal('50000')
CAP_24B_HL         = Decimal('200000')


# ─── Result dataclass ─────────────────────────────────────────────────────────

@dataclass
class TDSResult:
    employee_id: int
    financial_year: str
    month: int
    year: int
    regime: str
    gross_taxable_this_month: Decimal
    pf_employee_this_month: Decimal
    ytd_taxable_prior: Decimal
    ytd_80c_prior: Decimal
    ytd_tds_prior: Decimal
    projected_annual_taxable: Decimal
    projected_80c: Decimal
    projected_net_taxable: Decimal
    projected_annual_tax: Decimal
    projected_surcharge: Decimal
    projected_cess: Decimal
    projected_total_tax: Decimal
    hra_exemption: Decimal = ZERO
    declaration_80c_extra: Decimal = ZERO
    declaration_80d: Decimal = ZERO
    declaration_nps: Decimal = ZERO
    declaration_hl_interest: Decimal = ZERO
    declaration_edu: Decimal = ZERO
    declaration_80g: Decimal = ZERO
    total_declaration_deductions: Decimal = ZERO
    remaining_months: int = 1
    monthly_tds: Decimal = ZERO
    tds_override_used: bool = False
    is_exempt: bool = False
    warnings: list = field(default_factory=list)


# ─── Financial year helpers ───────────────────────────────────────────────────

def _get_financial_year(payroll_date: date) -> str:
    if payroll_date.month >= 4:
        start = payroll_date.year
    else:
        start = payroll_date.year - 1
    return f"{start}-{(start + 1) % 100:02d}"


def _remaining_fy_months(month: int, year: int) -> int:
    if month >= 4:
        return 12 - (month - 4)
    return 4 - month


# ─── HRA exemption ────────────────────────────────────────────────────────────

def compute_hra_exemption(
    hra_received: Decimal,
    basic_salary: Decimal,
    rent_paid_annual: Decimal,
    is_metro: bool,
) -> Decimal:
    """
    HRA exemption = min of:
      1. Actual HRA received (annual)
      2. Rent paid - 10% of basic salary (annual)
      3. 50% of basic (metro) or 40% of basic (non-metro)
    Returns 0 if no rent paid or HRA received.
    """
    if rent_paid_annual <= ZERO or hra_received <= ZERO:
        return ZERO
    limit_1 = hra_received
    limit_2 = max(ZERO, rent_paid_annual - basic_salary * Decimal('0.10'))
    limit_3 = basic_salary * (Decimal('0.50') if is_metro else Decimal('0.40'))
    return min(limit_1, limit_2, limit_3).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


# ─── Tax computation helpers ──────────────────────────────────────────────────

def _compute_slab_tax(taxable_income: Decimal, slabs) -> Decimal:
    tax = ZERO
    for slab in slabs:
        income_from = Decimal(str(slab.income_from))
        income_to   = Decimal(str(slab.income_to)) if slab.income_to is not None else None
        rate        = Decimal(str(slab.rate))
        if taxable_income <= income_from:
            break
        upper = income_to if income_to is not None else taxable_income
        taxable_in_slab = min(taxable_income, upper) - income_from
        if taxable_in_slab > ZERO:
            tax += taxable_in_slab * rate
    return tax.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def _compute_surcharge(tax: Decimal, taxable_income: Decimal, surcharge_slabs: list) -> Decimal:
    if not surcharge_slabs:
        return ZERO
    applicable_rate = ZERO
    for slab in surcharge_slabs:
        from_val = Decimal(str(slab.get('from', 0)))
        to_val   = Decimal(str(slab['to'])) if slab.get('to') else None
        rate     = Decimal(str(slab.get('rate', 0)))
        if taxable_income > from_val:
            if to_val is None or taxable_income <= to_val:
                applicable_rate = rate
                break
    return (tax * applicable_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def _compute_80g(donations: Decimal, donation_type: str, projected_gross: Decimal) -> Decimal:
    """80G deduction based on donation category."""
    if donations <= ZERO:
        return ZERO
    if donation_type == '100_PCT':
        return donations
    if donation_type == '50_PCT':
        return (donations * Decimal('0.5')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    limit = (projected_gross * Decimal('0.10')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    if donation_type == '100_PCT_WITH_LIMIT':
        return min(donations, limit)
    return min(donations * Decimal('0.5'), limit).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


# ─── Validation ───────────────────────────────────────────────────────────────

class DeclarationValidationError(Exception):
    def __init__(self, errors: list):
        self.errors = errors
        super().__init__('; '.join(errors))


def validate_declaration(data: dict) -> list:
    """Validate declaration input. Returns list of error strings (empty = valid)."""
    errors = []
    DECIMAL_FIELDS = [
        'lic_premium', 'elss_investment', 'ppf_investment', 'nsc_investment',
        'home_loan_principal', 'tuition_fees', 'other_80c',
        'medical_insurance_self', 'medical_insurance_parents',
        'rent_paid_monthly', 'education_loan_interest', 'donations_80g',
        'nps_additional', 'home_loan_interest',
    ]
    INPUT_CAPS = {
        'lic_premium': Decimal('500000'), 'elss_investment': Decimal('500000'),
        'ppf_investment': Decimal('150000'), 'nsc_investment': Decimal('500000'),
        'home_loan_principal': Decimal('5000000'), 'tuition_fees': Decimal('500000'),
        'other_80c': Decimal('500000'), 'medical_insurance_self': Decimal('100000'),
        'medical_insurance_parents': Decimal('100000'), 'rent_paid_monthly': Decimal('200000'),
        'education_loan_interest': Decimal('1000000'), 'donations_80g': Decimal('10000000'),
        'nps_additional': Decimal('200000'), 'home_loan_interest': Decimal('500000'),
    }
    for f in DECIMAL_FIELDS:
        val = data.get(f, 0)
        try:
            d = Decimal(str(val or 0))
        except Exception:
            errors.append(f"{f}: invalid number")
            continue
        if d < ZERO:
            errors.append(f"{f}: cannot be negative")
        cap = INPUT_CAPS.get(f)
        if cap and d > cap:
            errors.append(f"{f}: exceeds maximum allowed input of ₹{cap:,.0f}")

    rent_monthly = Decimal(str(data.get('rent_paid_monthly', 0) or 0))
    if rent_monthly * 12 > Decimal('100000'):
        pan = (data.get('landlord_pan') or '').strip()
        if not pan or len(pan) != 10:
            errors.append("landlord_pan: required when annual rent exceeds ₹1,00,000")
    return errors


# ─── Payroll lock check ───────────────────────────────────────────────────────

def _is_payroll_locked_for_fy(employee, financial_year: str) -> bool:
    """Return True if any payroll run for this employee's FY is LOCKED or beyond."""
    try:
        from payslip_generation.models import PayrollRunItem
        fy_start_year = int(financial_year.split('-')[0])
        return PayrollRunItem.objects.filter(
            employee=employee,
            run__status__in=['LOCKED', 'RELEASED', 'PAID'],
            run__year__in=[fy_start_year, fy_start_year + 1],
        ).exists()
    except Exception:
        return False


# ─── Main computation ─────────────────────────────────────────────────────────

def compute_tds_for_employee(
    employee,
    month: int,
    year: int,
    payroll_date: date,
    gross_taxable_this_month: Decimal,
    pf_employee_this_month: Decimal = ZERO,
    hra_received_this_month: Decimal = ZERO,
    basic_this_month: Decimal = ZERO,
) -> TDSResult:
    from employees.models import EmployeeTaxProfile
    from payroll_config.models import TaxRegimeConfig, TaxSlab, EmployeeYTDRecord

    warnings: list = []
    financial_year = _get_financial_year(payroll_date)
    remaining_months = _remaining_fy_months(month, year)
    months_remaining_after = remaining_months - 1

    # 1. Tax profile
    try:
        profile = EmployeeTaxProfile.objects.get(employee=employee)
        regime = profile.regime
        is_exempt = profile.is_tds_exempt
        tds_override = profile.tds_override
    except EmployeeTaxProfile.DoesNotExist:
        regime = 'NEW'
        is_exempt = False
        tds_override = None

    if is_exempt:
        return _exempt_result(employee.id, financial_year, month, year, regime,
                              gross_taxable_this_month, pf_employee_this_month, remaining_months)

    # 2. YTD prior
    prior_ytd = (
        EmployeeYTDRecord.objects
        .filter(employee=employee, financial_year=financial_year)
        .exclude(month=month, year=year)
        .order_by('-year', '-month')
        .first()
    )
    ytd_taxable_prior = Decimal(str(prior_ytd.ytd_taxable_earnings)) if prior_ytd else ZERO
    ytd_80c_prior     = Decimal(str(prior_ytd.ytd_deductions_80c))   if prior_ytd else ZERO
    ytd_tds_prior     = Decimal(str(prior_ytd.ytd_tds_deducted))     if prior_ytd else ZERO

    # 3. Regime config + slabs
    try:
        regime_config = TaxRegimeConfig.objects.get(
            financial_year=financial_year, regime=regime, is_active=True
        )
    except TaxRegimeConfig.DoesNotExist:
        warnings.append(f"No TaxRegimeConfig for FY {financial_year} regime {regime}. TDS=0.")
        return _zero_result(employee.id, financial_year, month, year, regime,
                            gross_taxable_this_month, pf_employee_this_month,
                            ytd_taxable_prior, ytd_80c_prior, ytd_tds_prior,
                            remaining_months, warnings)

    slabs = list(TaxSlab.objects.filter(regime_config=regime_config)
                 .order_by('display_order', 'income_from'))
    if not slabs:
        warnings.append(f"No TaxSlabs for FY {financial_year} regime {regime}. TDS=0.")
        return _zero_result(employee.id, financial_year, month, year, regime,
                            gross_taxable_this_month, pf_employee_this_month,
                            ytd_taxable_prior, ytd_80c_prior, ytd_tds_prior,
                            remaining_months, warnings)

    std_deduction   = Decimal(str(regime_config.standard_deduction))
    rebate_limit    = Decimal(str(regime_config.rebate_87a_limit))
    rebate_amount   = Decimal(str(regime_config.rebate_87a_amount))
    cess_rate       = Decimal(str(regime_config.cess_rate))
    surcharge_slabs = regime_config.surcharge_slabs or []

    # 4. Project annual gross
    ytd_including_this = ytd_taxable_prior + gross_taxable_this_month
    projected_annual_gross = (
        ytd_including_this + gross_taxable_this_month * Decimal(str(months_remaining_after))
    )

    # 5. Standard deduction
    projected_annual_taxable = max(ZERO, projected_annual_gross - std_deduction)

    # 6-8. OLD regime deductions
    projected_80c = ZERO
    hra_exemption = ZERO
    decl_80c_extra = decl_80d = decl_nps = decl_hl = decl_edu = decl_80g = ZERO

    if regime == 'OLD':
        # 6a. 80C from PF
        ytd_80c_this = ytd_80c_prior + pf_employee_this_month
        projected_pf_80c = ytd_80c_this + pf_employee_this_month * Decimal(str(months_remaining_after))
        projected_80c = min(projected_pf_80c, CAP_80C)
        projected_annual_taxable = max(ZERO, projected_annual_taxable - projected_80c)

        # 6b. HRA exemption
        if hra_received_this_month > ZERO and basic_this_month > ZERO:
            hra_annual   = hra_received_this_month * 12
            basic_annual = basic_this_month * 12
            try:
                from employees.models import TaxDeclaration
                dh = TaxDeclaration.objects.filter(
                    employee=employee, financial_year=financial_year, status='APPROVED'
                ).first()
                rent_annual = Decimal(str(dh.rent_paid_monthly)) * 12 if dh else ZERO
                is_metro    = (dh.city_type == 'METRO') if dh else False
            except Exception:
                rent_annual = ZERO
                is_metro = False
            hra_exemption = compute_hra_exemption(hra_annual, basic_annual, rent_annual, is_metro)
            projected_annual_taxable = max(ZERO, projected_annual_taxable - hra_exemption)

        # 7. Approved declaration deductions
        try:
            from employees.models import TaxDeclaration
            decl = TaxDeclaration.objects.filter(
                employee=employee, financial_year=financial_year, status='APPROVED'
            ).first()
            if decl:
                declared_total_80c = min(Decimal(str(decl.total_80c)), CAP_80C)
                decl_80c_extra = max(ZERO, declared_total_80c - projected_80c)

                cap_parents = CAP_80D_PARENTS_SR if decl.parents_senior_citizen else CAP_80D_PARENTS
                decl_80d = (
                    min(Decimal(str(decl.medical_insurance_self)),    CAP_80D_SELF) +
                    min(Decimal(str(decl.medical_insurance_parents)), cap_parents)
                )
                decl_nps = min(Decimal(str(decl.nps_additional)), CAP_NPS_80CCD1B)
                decl_hl  = min(Decimal(str(decl.home_loan_interest)), CAP_24B_HL)
                decl_edu = Decimal(str(decl.education_loan_interest))
                decl_80g = _compute_80g(
                    Decimal(str(decl.donations_80g)), decl.donation_type, projected_annual_gross
                )
                total_decl = decl_80c_extra + decl_80d + decl_nps + decl_hl + decl_edu + decl_80g
                projected_annual_taxable = max(ZERO, projected_annual_taxable - total_decl)
                if total_decl > ZERO:
                    warnings.append(f"Approved declaration applied: ₹{total_decl:,.0f} deductions.")
        except Exception as e:
            warnings.append(f"Declaration lookup skipped: {e}")

    projected_net_taxable = projected_annual_taxable

    # 9. Slab tax
    annual_tax = _compute_slab_tax(projected_net_taxable, slabs)

    # 10. 87A rebate
    if projected_net_taxable <= rebate_limit:
        annual_tax = max(ZERO, annual_tax - min(annual_tax, rebate_amount))

    # 11. Surcharge + cess
    surcharge = _compute_surcharge(annual_tax, projected_net_taxable, surcharge_slabs)
    cess = ((annual_tax + surcharge) * cess_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    total_annual_tax = annual_tax + surcharge + cess

    # 12. Equalise
    remaining_tax = max(ZERO, total_annual_tax - ytd_tds_prior)
    if remaining_months > 0:
        monthly_tds = (remaining_tax / Decimal(str(remaining_months))).quantize(
            Decimal('1'), rounding=ROUND_HALF_UP
        )
    else:
        monthly_tds = remaining_tax

    # 13. Manual override
    override_used = False
    if tds_override is not None:
        monthly_tds = Decimal(str(tds_override))
        override_used = True
        warnings.append(f"TDS override applied: ₹{monthly_tds}")

    total_decl_deductions = decl_80c_extra + decl_80d + decl_nps + decl_hl + decl_edu + decl_80g

    return TDSResult(
        employee_id=employee.id,
        financial_year=financial_year,
        month=month, year=year, regime=regime,
        gross_taxable_this_month=gross_taxable_this_month,
        pf_employee_this_month=pf_employee_this_month,
        ytd_taxable_prior=ytd_taxable_prior,
        ytd_80c_prior=ytd_80c_prior,
        ytd_tds_prior=ytd_tds_prior,
        projected_annual_taxable=projected_annual_taxable,
        projected_80c=projected_80c,
        projected_net_taxable=projected_net_taxable,
        projected_annual_tax=annual_tax,
        projected_surcharge=surcharge,
        projected_cess=cess,
        projected_total_tax=total_annual_tax,
        hra_exemption=hra_exemption,
        declaration_80c_extra=decl_80c_extra,
        declaration_80d=decl_80d,
        declaration_nps=decl_nps,
        declaration_hl_interest=decl_hl,
        declaration_edu=decl_edu,
        declaration_80g=decl_80g,
        total_declaration_deductions=total_decl_deductions,
        remaining_months=remaining_months,
        monthly_tds=monthly_tds,
        tds_override_used=override_used,
        is_exempt=False,
        warnings=warnings,
    )


def _exempt_result(employee_id, financial_year, month, year, regime,
                   gross_taxable, pf_emp, remaining_months) -> TDSResult:
    return TDSResult(
        employee_id=employee_id, financial_year=financial_year,
        month=month, year=year, regime=regime,
        gross_taxable_this_month=gross_taxable, pf_employee_this_month=pf_emp,
        ytd_taxable_prior=ZERO, ytd_80c_prior=ZERO, ytd_tds_prior=ZERO,
        projected_annual_taxable=ZERO, projected_80c=ZERO,
        projected_net_taxable=ZERO, projected_annual_tax=ZERO,
        projected_surcharge=ZERO, projected_cess=ZERO, projected_total_tax=ZERO,
        remaining_months=remaining_months, monthly_tds=ZERO, is_exempt=True,
    )


def _zero_result(employee_id, financial_year, month, year, regime,
                 gross_taxable, pf_emp, ytd_taxable, ytd_80c, ytd_tds,
                 remaining_months, warnings) -> TDSResult:
    return TDSResult(
        employee_id=employee_id, financial_year=financial_year,
        month=month, year=year, regime=regime,
        gross_taxable_this_month=gross_taxable, pf_employee_this_month=pf_emp,
        ytd_taxable_prior=ytd_taxable, ytd_80c_prior=ytd_80c, ytd_tds_prior=ytd_tds,
        projected_annual_taxable=ZERO, projected_80c=ZERO,
        projected_net_taxable=ZERO, projected_annual_tax=ZERO,
        projected_surcharge=ZERO, projected_cess=ZERO, projected_total_tax=ZERO,
        remaining_months=remaining_months, monthly_tds=ZERO, warnings=warnings,
    )


# ─── YTD helpers ─────────────────────────────────────────────────────────────

def get_ytd_record(employee, financial_year: str, month: int, year: int):
    from payroll_config.models import EmployeeYTDRecord
    return EmployeeYTDRecord.objects.filter(
        employee=employee, financial_year=financial_year, month=month, year=year
    ).first()


def write_ytd_record(
    employee,
    financial_year: str,
    month: int,
    year: int,
    result: TDSResult,
    gross_earnings_this_month: Decimal = ZERO,
    payroll_run=None,
) -> None:
    from payroll_config.models import EmployeeYTDRecord
    ytd_gross = result.ytd_taxable_prior + result.gross_taxable_this_month
    ytd_80c   = result.ytd_80c_prior + result.pf_employee_this_month
    ytd_tds   = result.ytd_tds_prior + result.monthly_tds

    EmployeeYTDRecord.objects.update_or_create(
        employee=employee,
        financial_year=financial_year,
        month=month,
        year=year,
        defaults={
            'payroll_run': payroll_run,
            'ytd_gross_earnings': gross_earnings_this_month,
            'ytd_taxable_earnings': ytd_gross,
            'ytd_deductions_80c': ytd_80c,
            'ytd_other_deductions': result.total_declaration_deductions,
            'ytd_tds_deducted': ytd_tds,
            'projected_annual_taxable': result.projected_annual_taxable,
            'projected_annual_tax': result.projected_annual_tax,
            'projected_annual_tax_with_cess': result.projected_total_tax,
            'remaining_months': result.remaining_months,
            'monthly_tds': result.monthly_tds,
        },
    )
