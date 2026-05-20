"""
payroll_config.models — Milestone 3A: India-Compliant Configurable Payroll Architecture

Models:
  SalaryComponent          — master list of all salary components (earnings, deductions, employer contributions)
  SalaryTemplate           — named salary structure (e.g. "Software Engineer L2", "Intern Stipend")
  SalaryTemplateComponent  — links a template to components with per-template override values
  EmployeeSalaryAssignment — employee's active salary structure with effective-date history

Design principles:
  - No hardcoded percentages or amounts — all values live in SalaryComponent / SalaryTemplateComponent
  - Effective-date history: salary revisions create a new assignment, old one gets effective_to set
  - Statutory flags (is_pf_applicable, is_esi_applicable) drive compliance calculations
  - Component classification (EARNING / DEDUCTION / EMPLOYER_CONTRIBUTION) drives payslip rendering
  - Backward-compatible: existing Payslip / MonthlySalaryData models are untouched in this milestone
"""
from django.db import models
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

User = get_user_model()


# ─── Salary Component Master ──────────────────────────────────────────────────

class SalaryComponent(models.Model):
    """
    Master list of all salary components used across salary templates.

    component_type drives payslip rendering:
      EARNING              — shown in earnings section, adds to gross
      DEDUCTION            — shown in deductions section, reduces net pay
      EMPLOYER_CONTRIBUTION — shown separately (CTC view), not deducted from employee

    calculation_type drives how the value is computed at payroll time:
      FIXED_AMOUNT         — flat rupee amount (e.g. Conveyance ₹1,600)
      PERCENTAGE_OF_BASIC  — % of Basic (e.g. HRA = 40% of Basic)
      PERCENTAGE_OF_GROSS  — % of gross earnings
      PERCENTAGE_OF_CTC    — % of annual CTC / 12
      STATUTORY            — calculated by statutory engine (PF, ESI, PT)
      FORMULA              — evaluated expression stored in `formula` field

    Statutory components (PF, ESI, PT) use calculation_type=STATUTORY and
    the statutory engine reads applicability thresholds from StatutoryConfig (Phase 3B).
    """

    COMPONENT_TYPE_CHOICES = [
        ('EARNING', 'Earning'),
        ('DEDUCTION', 'Deduction'),
        ('EMPLOYER_CONTRIBUTION', 'Employer Contribution'),
    ]

    CALCULATION_TYPE_CHOICES = [
        ('FIXED_AMOUNT', 'Fixed Amount'),
        ('PERCENTAGE_OF_BASIC', 'Percentage of Basic'),
        ('PERCENTAGE_OF_GROSS', 'Percentage of Gross'),
        ('PERCENTAGE_OF_CTC', 'Percentage of CTC'),
        ('STATUTORY', 'Statutory (PF / ESI / PT)'),
        ('FORMULA', 'Formula'),
    ]

    # Identity
    code = models.CharField(
        max_length=30, unique=True,
        help_text='Unique code used in formulas and reports (e.g. BASIC, HRA, PF_EMP)',
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default='')

    # Classification
    component_type = models.CharField(max_length=25, choices=COMPONENT_TYPE_CHOICES)
    calculation_type = models.CharField(max_length=25, choices=CALCULATION_TYPE_CHOICES)

    # Value — meaning depends on calculation_type:
    #   FIXED_AMOUNT        → rupee amount
    #   PERCENTAGE_OF_*     → percentage (e.g. 40.00 means 40%)
    #   STATUTORY / FORMULA → ignored (computed at runtime)
    default_value = models.DecimalField(
        max_digits=10, decimal_places=4, default=0,
        help_text='Amount (for FIXED_AMOUNT) or percentage (for PERCENTAGE_OF_* types)',
    )

    # Formula — only used when calculation_type=FORMULA
    # Variables available: BASIC, GROSS, CTC_MONTHLY, and any other component code
    formula = models.TextField(
        blank=True, default='',
        help_text='Python-safe expression evaluated at payroll time. '
                  'Available vars: BASIC, GROSS, CTC_MONTHLY, and other component codes.',
    )

    # Payslip / compliance flags
    is_taxable = models.BooleanField(
        default=False,
        help_text='Whether this component is taxable under income tax',
    )
    affects_gross = models.BooleanField(
        default=False,
        help_text='Whether this component is included in gross earnings',
    )
    affects_net = models.BooleanField(
        default=True,
        help_text='Whether this component affects net pay (earnings add, deductions subtract)',
    )
    affects_ctc = models.BooleanField(
        default=False,
        help_text='Whether this component is counted in CTC',
    )

    # Statutory applicability flags
    is_pf_applicable = models.BooleanField(
        default=False,
        help_text='Whether this component is included in PF wage calculation',
    )
    is_esi_applicable = models.BooleanField(
        default=False,
        help_text='Whether this component is included in ESI wage calculation',
    )
    is_statutory = models.BooleanField(
        default=False,
        help_text='True for PF, ESI, PT — statutory components cannot be freely removed from templates',
    )

    # Behaviour flags
    is_recurring = models.BooleanField(
        default=True,
        help_text='Monthly recurring vs one-time payment',
    )
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(
        default=0,
        help_text='Order in which this component appears on the payslip',
    )

    class Meta:
        db_table = 'salary_components'
        verbose_name = 'Salary Component'
        verbose_name_plural = 'Salary Components'
        ordering = ['display_order', 'name']

    def __str__(self):
        return f"{self.code} — {self.name} [{self.component_type}]"

    def clean(self):
        if self.calculation_type == 'FORMULA' and not self.formula.strip():
            raise ValidationError({'formula': 'Formula is required when calculation_type is FORMULA.'})


# ─── Salary Template ──────────────────────────────────────────────────────────

class SalaryTemplate(models.Model):
    """
    Named salary structure template.
    Examples: "Software Engineer L1", "Manager Grade A", "Intern Stipend"

    A template defines WHICH components are included and at WHAT values.
    Multiple employees can share the same template.
    When a template is updated, existing EmployeeSalaryAssignments are NOT auto-updated
    — the change takes effect only when a new assignment is created.
    """
    code = models.CharField(
        max_length=30, unique=True,
        help_text='Short unique code (e.g. SWE_L1, MGR_A, INTERN)',
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_salary_templates',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'salary_templates'
        verbose_name = 'Salary Template'
        verbose_name_plural = 'Salary Templates'
        ordering = ['name']

    def __str__(self):
        return f"{self.code} — {self.name}"


# ─── Salary Template Component ────────────────────────────────────────────────

class SalaryTemplateComponent(models.Model):
    """
    Links a SalaryTemplate to a SalaryComponent with per-template override values.

    The `calculation_type` and `value` here override the component's defaults.
    This allows the same component (e.g. HRA) to be 40% of Basic in one template
    and 50% of Basic in another.
    """
    template = models.ForeignKey(
        SalaryTemplate, on_delete=models.CASCADE, related_name='components',
    )
    component = models.ForeignKey(
        SalaryComponent, on_delete=models.PROTECT, related_name='template_usages',
    )

    # Override the component's default calculation_type and value for this template
    # If left as None, the component's own defaults are used
    calculation_type_override = models.CharField(
        max_length=25,
        choices=SalaryComponent.CALCULATION_TYPE_CHOICES,
        blank=True, null=True,
        help_text='Override the component default calculation type for this template',
    )
    value = models.DecimalField(
        max_digits=10, decimal_places=4, default=0,
        help_text='Amount or percentage for this component in this template',
    )
    formula_override = models.TextField(
        blank=True, default='',
        help_text='Override formula for this template (only used if calculation_type is FORMULA)',
    )

    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'salary_template_components'
        verbose_name = 'Salary Template Component'
        verbose_name_plural = 'Salary Template Components'
        unique_together = ['template', 'component']
        ordering = ['display_order', 'component__display_order']

    def __str__(self):
        return f"{self.template.code} / {self.component.code}"

    @property
    def effective_calculation_type(self):
        """Return the calculation type to use — template override takes priority."""
        return self.calculation_type_override or self.component.calculation_type

    @property
    def effective_value(self):
        """Return the value to use — template value takes priority over component default."""
        return self.value if self.value != 0 else self.component.default_value

    @property
    def effective_formula(self):
        """Return the formula to use — template override takes priority."""
        return self.formula_override or self.component.formula


# ─── Employee Salary Assignment ───────────────────────────────────────────────

class EmployeeSalaryAssignment(models.Model):
    """
    Assigns a SalaryTemplate + annual CTC to an employee with effective-date history.

    Rules:
      - Only one assignment per employee can be active at a time (is_active=True)
      - When a salary revision happens, the current assignment gets effective_to set
        and a new assignment is created with the new CTC and effective_from
      - effective_to=None means the assignment is currently active
      - The service layer enforces the single-active constraint

    This model replaces the hardcoded SalaryStructure model for new payroll runs.
    SalaryStructure is kept for backward compatibility with existing payslips.
    """
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='salary_assignments',
    )
    template = models.ForeignKey(
        SalaryTemplate,
        on_delete=models.PROTECT,
        related_name='employee_assignments',
    )

    # CTC — the annual cost to company for this assignment
    annual_ctc = models.DecimalField(
        max_digits=14, decimal_places=2,
        help_text='Annual CTC in rupees (e.g. 600000 for 6 LPA)',
    )

    # Effective date range
    effective_from = models.DateField(
        help_text='Date from which this salary structure is effective',
    )
    effective_to = models.DateField(
        null=True, blank=True,
        help_text='Date until which this assignment is effective. Null = currently active.',
    )

    # Status
    is_active = models.BooleanField(
        default=True,
        help_text='Only one active assignment per employee at a time',
    )

    # Metadata
    notes = models.TextField(
        blank=True, default='',
        help_text='Reason for revision or any notes (e.g. "Annual increment FY 2025-26")',
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_salary_assignments',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_salary_assignments'
        verbose_name = 'Employee Salary Assignment'
        verbose_name_plural = 'Employee Salary Assignments'
        ordering = ['-effective_from']
        indexes = [
            models.Index(fields=['employee', 'is_active'], name='esa_employee_active_idx'),
            models.Index(fields=['employee', 'effective_from'], name='esa_employee_eff_from_idx'),
        ]

    def __str__(self):
        status = 'ACTIVE' if self.is_active else f'until {self.effective_to}'
        return f"{self.employee.name} — {self.template.code} @ ₹{self.annual_ctc:,.0f} ({status})"

    def clean(self):
        if self.effective_to and self.effective_from and self.effective_to < self.effective_from:
            raise ValidationError({'effective_to': 'effective_to must be after effective_from.'})

    @property
    def monthly_ctc(self):
        """Monthly CTC = annual_ctc / 12."""
        from decimal import Decimal
        return self.annual_ctc / Decimal('12')


# ─── Milestone 3B: Statutory Configuration ───────────────────────────────────

# Indian state codes — used across StatutoryConfig and ProfessionalTaxSlab
INDIAN_STATE_CHOICES = [
    ('AP', 'Andhra Pradesh'),
    ('AR', 'Arunachal Pradesh'),
    ('AS', 'Assam'),
    ('BR', 'Bihar'),
    ('CG', 'Chhattisgarh'),
    ('GA', 'Goa'),
    ('GJ', 'Gujarat'),
    ('HR', 'Haryana'),
    ('HP', 'Himachal Pradesh'),
    ('JH', 'Jharkhand'),
    ('KA', 'Karnataka'),
    ('KL', 'Kerala'),
    ('MP', 'Madhya Pradesh'),
    ('MH', 'Maharashtra'),
    ('MN', 'Manipur'),
    ('ML', 'Meghalaya'),
    ('MZ', 'Mizoram'),
    ('NL', 'Nagaland'),
    ('OD', 'Odisha'),
    ('PB', 'Punjab'),
    ('RJ', 'Rajasthan'),
    ('SK', 'Sikkim'),
    ('TN', 'Tamil Nadu'),
    ('TG', 'Telangana'),
    ('TR', 'Tripura'),
    ('UP', 'Uttar Pradesh'),
    ('UK', 'Uttarakhand'),
    ('WB', 'West Bengal'),
    ('DL', 'Delhi'),
    ('OTHER', 'Other / Union Territory'),
]

FINANCIAL_YEAR_CHOICES = [
    ('2023-24', 'FY 2023-24'),
    ('2024-25', 'FY 2024-25'),
    ('2025-26', 'FY 2025-26'),
    ('2026-27', 'FY 2026-27'),
    ('2027-28', 'FY 2027-28'),
]

PF_ROUNDING_CHOICES = [
    ('ROUND', 'Round to nearest rupee'),
    ('FLOOR', 'Floor (round down)'),
    ('CEIL', 'Ceiling (round up)'),
]


class StatutoryConfig(models.Model):
    """
    Company-level statutory payroll configuration, scoped by financial year and state.

    Design:
      - One active config per (financial_year, state) combination at a time
      - Rates and thresholds are configurable — not hardcoded in business logic
      - The payroll engine resolves the applicable config by (state, payroll_date)
      - Defaults reflect Indian statutory rules as of FY 2025-26 but are fully editable

    PF rules (as of FY 2025-26):
      - Employee contribution: 12% of PF wage (Basic + DA)
      - Employer contribution: 12% of PF wage (split: 3.67% EPF + 8.33% EPS)
      - PF wage ceiling: ₹15,000/month — contributions capped at this wage
      - Employees earning Basic > ₹15,000 can opt out of statutory PF

    ESI rules (as of FY 2025-26):
      - Employee contribution: 0.75% of gross wages
      - Employer contribution: 3.25% of gross wages
      - Applicability threshold: gross wages ≤ ₹21,000/month
      - Once an employee crosses ₹21,000 gross, ESI stops for that contribution period

    PT rules:
      - State-dependent — see ProfessionalTaxSlab model
      - Maximum PT per year: ₹2,500 (constitutional limit)

    LWF rules:
      - State-dependent — amount and applicable months vary
      - Placeholder fields here; detailed LWF slabs can be added in a future model
    """

    # Scope
    financial_year = models.CharField(
        max_length=10,
        choices=FINANCIAL_YEAR_CHOICES,
        help_text='Financial year this config applies to (e.g. 2025-26)',
    )
    state = models.CharField(
        max_length=10,
        choices=INDIAN_STATE_CHOICES,
        help_text='State this config applies to. Use the state where the company/branch is registered.',
    )

    # ── PF Settings ──────────────────────────────────────────────────────────
    pf_enabled = models.BooleanField(
        default=True,
        help_text='Whether PF deductions are enabled for this config',
    )
    pf_employee_rate = models.DecimalField(
        max_digits=5, decimal_places=4, default='0.1200',
        help_text='Employee PF contribution rate (e.g. 0.1200 = 12%)',
    )
    pf_employer_rate = models.DecimalField(
        max_digits=5, decimal_places=4, default='0.1200',
        help_text='Employer PF contribution rate (e.g. 0.1200 = 12%)',
    )
    pf_wage_ceiling = models.DecimalField(
        max_digits=10, decimal_places=2, default='15000.00',
        help_text='Monthly PF wage ceiling in rupees. PF is calculated on min(actual_pf_wage, ceiling).',
    )
    pf_rounding = models.CharField(
        max_length=10, choices=PF_ROUNDING_CHOICES, default='ROUND',
        help_text='How to round PF contribution amounts',
    )
    pf_include_employer_in_ctc = models.BooleanField(
        default=True,
        help_text='Whether employer PF contribution is included in CTC calculation',
    )

    # ── ESI Settings ─────────────────────────────────────────────────────────
    esi_enabled = models.BooleanField(
        default=True,
        help_text='Whether ESI deductions are enabled for this config',
    )
    esi_employee_rate = models.DecimalField(
        max_digits=5, decimal_places=4, default='0.0075',
        help_text='Employee ESI contribution rate (e.g. 0.0075 = 0.75%)',
    )
    esi_employer_rate = models.DecimalField(
        max_digits=5, decimal_places=4, default='0.0325',
        help_text='Employer ESI contribution rate (e.g. 0.0325 = 3.25%)',
    )
    esi_wage_threshold = models.DecimalField(
        max_digits=10, decimal_places=2, default='21000.00',
        help_text='Monthly gross wage threshold. Employees earning above this are NOT ESI-covered.',
    )

    # ── PT Settings ───────────────────────────────────────────────────────────
    pt_enabled = models.BooleanField(
        default=True,
        help_text='Whether Professional Tax is enabled. PT slabs are defined in ProfessionalTaxSlab.',
    )

    # ── LWF Settings ─────────────────────────────────────────────────────────
    lwf_enabled = models.BooleanField(
        default=False,
        help_text='Whether Labour Welfare Fund deductions are enabled',
    )
    lwf_employee_amount = models.DecimalField(
        max_digits=8, decimal_places=2, default='0.00',
        help_text='Employee LWF contribution amount per applicable period',
    )
    lwf_employer_amount = models.DecimalField(
        max_digits=8, decimal_places=2, default='0.00',
        help_text='Employer LWF contribution amount per applicable period',
    )
    lwf_applicable_months = models.JSONField(
        default=list, blank=True,
        help_text='List of month numbers (1-12) when LWF is deducted. Empty = every month.',
    )

    # ── TDS Settings (placeholder for Phase 3C+) ─────────────────────────────
    tds_enabled = models.BooleanField(
        default=False,
        help_text='Whether TDS deductions are enabled. Full TDS engine is a future phase.',
    )

    # ── Effective dates ───────────────────────────────────────────────────────
    effective_from = models.DateField(
        help_text='Date from which this config is effective',
    )
    effective_to = models.DateField(
        null=True, blank=True,
        help_text='Date until which this config is effective. Null = currently active.',
    )
    is_active = models.BooleanField(default=True)

    # ── Metadata ──────────────────────────────────────────────────────────────
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_statutory_configs',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'statutory_configs'
        verbose_name = 'Statutory Config'
        verbose_name_plural = 'Statutory Configs'
        ordering = ['-financial_year', 'state']
        unique_together = ['financial_year', 'state', 'is_active']
        indexes = [
            models.Index(fields=['state', 'is_active'], name='sc_state_active_idx'),
            models.Index(fields=['financial_year', 'state'], name='sc_fy_state_idx'),
        ]

    def __str__(self):
        status = 'ACTIVE' if self.is_active else 'INACTIVE'
        return f"StatutoryConfig [{self.state}] FY {self.financial_year} [{status}]"

    def clean(self):
        if self.effective_to and self.effective_from and self.effective_to < self.effective_from:
            raise ValidationError({'effective_to': 'effective_to must be after effective_from.'})

    @property
    def pf_employee_rate_pct(self):
        """PF employee rate as a percentage string for display."""
        return f"{float(self.pf_employee_rate) * 100:.2f}%"

    @property
    def esi_employee_rate_pct(self):
        """ESI employee rate as a percentage string for display."""
        return f"{float(self.esi_employee_rate) * 100:.2f}%"


class ProfessionalTaxSlab(models.Model):
    """
    State-wise Professional Tax slabs for a given financial year.

    Each slab defines:
      - The income range (min_monthly_wage to max_monthly_wage)
      - The monthly PT amount for that range
      - Optional: which months this slab applies (for states like Karnataka
        where Feb/Mar have different PT amounts)

    Resolution logic (in statutory_service.py):
      1. Find all active slabs for (state, financial_year)
      2. Find the slab where min_monthly_wage <= employee_gross <= max_monthly_wage
      3. If applicable_months is set, only apply in those months
      4. Return pt_amount (0 if no slab matches)

    Example — Karnataka FY 2025-26:
      Slab 1: 0 – 14,999 → ₹0/month
      Slab 2: 15,000 – 29,999 → ₹150/month (Apr–Feb), ₹200 in March
      Slab 3: 30,000+ → ₹200/month

    Example — Maharashtra FY 2025-26:
      Slab 1: 0 – 7,499 → ₹0/month
      Slab 2: 7,500 – 9,999 → ₹175 in Feb, ₹0 other months
      Slab 3: 10,000+ → ₹200/month

    Note: PT is deducted from the employee's salary. Max ₹2,500/year (constitutional limit).
    """
    statutory_config = models.ForeignKey(
        StatutoryConfig,
        on_delete=models.CASCADE,
        related_name='pt_slabs',
        help_text='The statutory config this slab belongs to',
    )

    # Income range — monthly gross wage
    min_monthly_wage = models.DecimalField(
        max_digits=10, decimal_places=2, default='0.00',
        help_text='Minimum monthly gross wage for this slab (inclusive)',
    )
    max_monthly_wage = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text='Maximum monthly gross wage for this slab (inclusive). Null = no upper limit (top slab).',
    )

    # PT amount for this slab
    pt_amount = models.DecimalField(
        max_digits=8, decimal_places=2, default='0.00',
        help_text='Monthly PT amount in rupees for employees in this wage range',
    )

    # Optional month restriction — for states with month-specific PT rules
    applicable_months = models.JSONField(
        default=list, blank=True,
        help_text=(
            'List of month numbers (1=Jan … 12=Dec) when this slab applies. '
            'Empty list = applies to all months. '
            'Use this for states like Karnataka where March has a different PT amount.'
        ),
    )

    # Gender-based PT (rare but exists in some states)
    gender = models.CharField(
        max_length=10,
        choices=[('ALL', 'All'), ('MALE', 'Male'), ('FEMALE', 'Female')],
        default='ALL',
        help_text='Gender applicability. Most states use ALL.',
    )

    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'professional_tax_slabs'
        verbose_name = 'Professional Tax Slab'
        verbose_name_plural = 'Professional Tax Slabs'
        ordering = ['statutory_config', 'display_order', 'min_monthly_wage']

    def __str__(self):
        cfg = self.statutory_config
        upper = f"– ₹{self.max_monthly_wage:,.0f}" if self.max_monthly_wage else "+"
        return f"PT [{cfg.state}] FY {cfg.financial_year}: ₹{self.min_monthly_wage:,.0f}{upper} → ₹{self.pt_amount}/mo"

    def clean(self):
        if (self.max_monthly_wage is not None and
                self.max_monthly_wage < self.min_monthly_wage):
            raise ValidationError({'max_monthly_wage': 'max_monthly_wage must be >= min_monthly_wage.'})

    def applies_to_month(self, month_number: int) -> bool:
        """Return True if this slab applies to the given month (1-12)."""
        if not self.applicable_months:
            return True
        return month_number in self.applicable_months

    def wage_in_range(self, monthly_wage) -> bool:
        """Return True if monthly_wage falls within this slab's range."""
        from decimal import Decimal
        wage = Decimal(str(monthly_wage))
        if wage < self.min_monthly_wage:
            return False
        if self.max_monthly_wage is not None and wage > self.max_monthly_wage:
            return False
        return True


# ─── Phase B: Payroll Configuration ──────────────────────────────────────────

class PayrollConfig(models.Model):
    """
    Company-level payroll configuration.
    Controls proration basis used when computing payable days.

    proration_basis:
      CALENDAR_DAYS — proration_factor = payable_days / days_in_month  (default, most common in India)
      WORKING_DAYS  — proration_factor = payable_days / working_days
    """
    PRORATION_BASIS_CHOICES = [
        ('CALENDAR_DAYS', 'Calendar Days (payable / days_in_month)'),
        ('WORKING_DAYS',  'Working Days (payable / working_days)'),
    ]

    proration_basis = models.CharField(
        max_length=20,
        choices=PRORATION_BASIS_CHOICES,
        default='CALENDAR_DAYS',
        help_text='Basis for salary proration when employee has LOP days.',
    )
    is_active = models.BooleanField(default=True)
    effective_from = models.DateField(
        help_text='Date from which this configuration is effective.',
    )
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_payroll_configs',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payroll_configs'
        verbose_name = 'Payroll Config'
        verbose_name_plural = 'Payroll Configs'
        ordering = ['-effective_from']

    def __str__(self):
        return f"PayrollConfig [{self.proration_basis}] from {self.effective_from}"


# ─── Phase C: TDS / Income Tax Engine ────────────────────────────────────────

class TaxRegimeConfig(models.Model):
    """
    Tax regime parameters for a financial year.
    One active record per (financial_year, regime) combination.

    Covers:
      - Standard deduction amount
      - Section 87A rebate threshold and amount
      - Surcharge slabs (JSON) for high-income earners
      - Health + Education cess rate (4%)

    Phase 1: model + seed data only.
    Phase 2: computation logic in tds_service.py.
    """
    REGIME_CHOICES = [
        ('OLD', 'Old Tax Regime'),
        ('NEW', 'New Tax Regime (Default from FY 2023-24)'),
    ]

    financial_year = models.CharField(
        max_length=10,
        choices=FINANCIAL_YEAR_CHOICES,
        help_text='Financial year this config applies to (e.g. 2025-26)',
    )
    regime = models.CharField(
        max_length=5,
        choices=REGIME_CHOICES,
        help_text='OLD = pre-2023 regime with deductions; NEW = simplified slab regime',
    )

    # Standard deduction (Section 16)
    standard_deduction = models.DecimalField(
        max_digits=10, decimal_places=2, default='50000.00',
        help_text='Standard deduction from salary income (₹50,000 old / ₹75,000 new as of FY 2025-26)',
    )

    # Section 87A rebate
    rebate_87a_limit = models.DecimalField(
        max_digits=12, decimal_places=2, default='500000.00',
        help_text='Taxable income ceiling below which full 87A rebate applies',
    )
    rebate_87a_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default='12500.00',
        help_text='Maximum rebate amount under Section 87A',
    )

    # Surcharge slabs — list of {from, to, rate} dicts
    # e.g. [{"from": 5000000, "to": 10000000, "rate": 0.10}, ...]
    surcharge_slabs = models.JSONField(
        default=list, blank=True,
        help_text='Surcharge slabs: [{from, to, rate}]. to=null means no upper limit.',
    )

    # Health + Education cess
    cess_rate = models.DecimalField(
        max_digits=5, decimal_places=4, default='0.0400',
        help_text='Health and Education cess rate (4% = 0.0400)',
    )

    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_tax_regime_configs',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tax_regime_configs'
        verbose_name = 'Tax Regime Config'
        verbose_name_plural = 'Tax Regime Configs'
        unique_together = [('financial_year', 'regime')]
        ordering = ['-financial_year', 'regime']

    def __str__(self):
        return f"TaxRegime [{self.regime}] FY {self.financial_year}"


class TaxSlab(models.Model):
    """
    Individual income tax slab for a TaxRegimeConfig.

    Example — New Regime FY 2025-26:
      0 – 3,00,000       → 0%
      3,00,001 – 7,00,000 → 5%
      7,00,001 – 10,00,000 → 10%
      10,00,001 – 12,00,000 → 15%
      12,00,001 – 15,00,000 → 20%
      15,00,001+           → 30%

    income_to=None means the top (open-ended) slab.
    """
    regime_config = models.ForeignKey(
        TaxRegimeConfig,
        on_delete=models.CASCADE,
        related_name='slabs',
    )
    income_from = models.DecimalField(
        max_digits=14, decimal_places=2, default='0.00',
        help_text='Lower bound of this slab (inclusive), in rupees',
    )
    income_to = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        help_text='Upper bound of this slab (inclusive), in rupees. Null = no upper limit.',
    )
    rate = models.DecimalField(
        max_digits=5, decimal_places=4,
        help_text='Tax rate for this slab (e.g. 0.0500 = 5%)',
    )
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'tax_slabs'
        verbose_name = 'Tax Slab'
        verbose_name_plural = 'Tax Slabs'
        ordering = ['regime_config', 'display_order', 'income_from']

    def __str__(self):
        upper = f"– ₹{self.income_to:,.0f}" if self.income_to else "+"
        return (
            f"[{self.regime_config.regime}] FY {self.regime_config.financial_year}: "
            f"₹{self.income_from:,.0f}{upper} @ {float(self.rate)*100:.1f}%"
        )

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.income_to is not None and self.income_to <= self.income_from:
            raise ValidationError({'income_to': 'income_to must be greater than income_from.'})


class EmployeeYTDRecord(models.Model):
    """
    Year-to-date tax accumulator for one employee, one month of a financial year.

    Written by the payroll engine after each run.
    Immutable once the associated PayrollRun reaches LOCKED status.

    Cumulative fields cover April through the current month (inclusive).
    Projection fields are recomputed each month based on actuals + remaining months.

    Phase 1: model only.
    Phase 2: populated by tds_service.compute_tds_for_employee().
    """
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='ytd_records',
    )
    financial_year = models.CharField(
        max_length=10,
        choices=FINANCIAL_YEAR_CHOICES,
        help_text='Financial year (e.g. 2025-26)',
    )
    month = models.PositiveSmallIntegerField(
        help_text='Calendar month number (1=Jan … 12=Dec)',
    )
    year = models.PositiveSmallIntegerField(
        help_text='Calendar year (e.g. 2026)',
    )
    payroll_run = models.ForeignKey(
        'payslip_generation.PayrollRun',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ytd_records',
        help_text='The payroll run that wrote this record',
    )

    # ── Cumulative actuals (April → this month) ───────────────────────────────
    ytd_gross_earnings = models.DecimalField(
        max_digits=14, decimal_places=2, default='0.00',
        help_text='Sum of gross earnings from April to this month',
    )
    ytd_taxable_earnings = models.DecimalField(
        max_digits=14, decimal_places=2, default='0.00',
        help_text='Sum of taxable component earnings (is_taxable=True) from April to this month',
    )
    ytd_deductions_80c = models.DecimalField(
        max_digits=14, decimal_places=2, default='0.00',
        help_text='Sum of 80C-eligible deductions (PF employee, ELSS, etc.) from April to this month',
    )
    ytd_other_deductions = models.DecimalField(
        max_digits=14, decimal_places=2, default='0.00',
        help_text='Sum of other declared deductions (HRA exemption, NPS, etc.) from April to this month',
    )
    ytd_tds_deducted = models.DecimalField(
        max_digits=14, decimal_places=2, default='0.00',
        help_text='Sum of TDS actually deducted from April to this month',
    )

    # ── Projections (computed at this month's payroll run) ────────────────────
    projected_annual_taxable = models.DecimalField(
        max_digits=14, decimal_places=2, default='0.00',
        help_text='Projected full-year taxable income based on actuals + remaining months',
    )
    projected_annual_tax = models.DecimalField(
        max_digits=14, decimal_places=2, default='0.00',
        help_text='Projected full-year income tax liability (before cess)',
    )
    projected_annual_tax_with_cess = models.DecimalField(
        max_digits=14, decimal_places=2, default='0.00',
        help_text='Projected full-year tax including surcharge and cess',
    )
    remaining_months = models.PositiveSmallIntegerField(
        default=1,
        help_text='Number of FY months remaining including this month',
    )
    monthly_tds = models.DecimalField(
        max_digits=10, decimal_places=2, default='0.00',
        help_text='TDS to deduct this month = (projected_tax - ytd_tds) / remaining_months',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_ytd_records'
        verbose_name = 'Employee YTD Record'
        verbose_name_plural = 'Employee YTD Records'
        unique_together = [('employee', 'financial_year', 'month', 'year')]
        ordering = ['-year', '-month', 'employee__name']
        indexes = [
            models.Index(fields=['employee', 'financial_year'], name='ytd_emp_fy_idx'),
            models.Index(fields=['financial_year', 'month', 'year'], name='ytd_fy_period_idx'),
        ]

    def __str__(self):
        return (
            f"YTD {self.employee.employee_id} "
            f"FY {self.financial_year} "
            f"{self.month}/{self.year} "
            f"TDS=₹{self.monthly_tds}"
        )


# ─── Form 16 ──────────────────────────────────────────────────────────────────

class Form16PartA(models.Model):
    """
    Form 16 Part A — TDS certificate issued by employer.
    Contains TAN, PAN, quarterly TDS deducted and deposited.
    One record per (employee, financial_year).
    """
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='form16_part_a',
    )
    financial_year = models.CharField(max_length=10, choices=FINANCIAL_YEAR_CHOICES)

    # Employer details
    employer_tan = models.CharField(max_length=10, help_text='Employer TAN number')
    employer_pan = models.CharField(max_length=10, help_text='Employer PAN number')
    employer_name = models.CharField(max_length=200)
    employer_address = models.TextField(blank=True, default='')

    # Employee details (snapshot at time of generation)
    employee_pan = models.CharField(max_length=10)
    employee_name = models.CharField(max_length=200)

    # Quarterly TDS (Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar)
    q1_tds_deducted  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    q1_tds_deposited = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    q2_tds_deducted  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    q2_tds_deposited = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    q3_tds_deducted  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    q3_tds_deposited = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    q4_tds_deducted  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    q4_tds_deposited = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Totals
    total_tds_deducted  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_tds_deposited = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Status
    is_generated = models.BooleanField(default=False)
    generated_at = models.DateTimeField(null=True, blank=True)
    generated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='generated_form16_part_a',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'form16_part_a'
        unique_together = [('employee', 'financial_year')]
        ordering = ['-financial_year', 'employee__name']

    def __str__(self):
        return f"Form16A [{self.employee.employee_id}] FY {self.financial_year}"

    @property
    def total_tds(self):
        return (self.q1_tds_deducted + self.q2_tds_deducted +
                self.q3_tds_deducted + self.q4_tds_deducted)


class Form16PartB(models.Model):
    """
    Form 16 Part B — Salary details and deduction breakdown.
    One record per (employee, financial_year).
    """
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='form16_part_b',
    )
    financial_year = models.CharField(max_length=10, choices=FINANCIAL_YEAR_CHOICES)
    part_a = models.OneToOneField(
        Form16PartA,
        on_delete=models.CASCADE,
        related_name='part_b',
        null=True, blank=True,
    )

    # Gross salary components
    gross_salary            = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    hra_received            = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    hra_exemption           = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_exemptions        = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Net salary after exemptions
    net_salary              = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    # Standard deduction (Sec 16)
    standard_deduction      = models.DecimalField(max_digits=10, decimal_places=2, default=50000)
    professional_tax        = models.DecimalField(max_digits=8,  decimal_places=2, default=0)

    # Income from salary (after Sec 16)
    income_from_salary      = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    # Chapter VI-A deductions
    deduction_80c           = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deduction_80ccd1b       = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deduction_80d           = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deduction_80e           = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deduction_80g           = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deduction_24b           = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_chapter_via       = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Tax computation
    taxable_income          = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax_on_income           = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    surcharge               = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cess                    = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_tax_payable       = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    rebate_87a              = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    relief_89               = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    net_tax_payable         = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tds_deducted            = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Regime
    regime = models.CharField(max_length=5, choices=[('OLD', 'Old'), ('NEW', 'New')], default='NEW')

    is_generated = models.BooleanField(default=False)
    generated_at = models.DateTimeField(null=True, blank=True)
    generated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='generated_form16_part_b',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'form16_part_b'
        unique_together = [('employee', 'financial_year')]
        ordering = ['-financial_year', 'employee__name']

    def __str__(self):
        return f"Form16B [{self.employee.employee_id}] FY {self.financial_year}"


class TaxAuditLog(models.Model):
    """
    Immutable audit trail for all TDS-related changes.
    Records who changed what, when, and what the old/new values were.
    """
    ACTION_CHOICES = [
        ('DECLARATION_SUBMITTED',  'Declaration Submitted'),
        ('DECLARATION_APPROVED',   'Declaration Approved'),
        ('DECLARATION_REJECTED',   'Declaration Rejected'),
        ('REGIME_CHANGED',         'Tax Regime Changed'),
        ('TDS_OVERRIDE_SET',       'TDS Override Set'),
        ('TDS_OVERRIDE_CLEARED',   'TDS Override Cleared'),
        ('FORM16_GENERATED',       'Form 16 Generated'),
        ('YTD_UPDATED',            'YTD Record Updated'),
        ('EXEMPT_STATUS_CHANGED',  'Exempt Status Changed'),
    ]

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='tax_audit_logs',
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    financial_year = models.CharField(max_length=10, blank=True, default='')
    field_changed = models.CharField(max_length=60, blank=True, default='')
    old_value = models.TextField(blank=True, default='')
    new_value = models.TextField(blank=True, default='')
    performed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='tax_audit_actions',
    )
    notes = models.TextField(blank=True, default='')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tax_audit_logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['employee', 'financial_year'], name='tal_emp_fy_idx'),
            models.Index(fields=['action', 'timestamp'], name='tal_action_ts_idx'),
        ]

    def __str__(self):
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {self.action} — {self.employee.employee_id}"
