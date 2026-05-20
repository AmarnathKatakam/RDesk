from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from decimal import Decimal
from employees.models import Employee

User = get_user_model()


class Payslip(models.Model):
    """
    Payslip model for storing generated payslip information.
    """
    SALARY_TYPE_CHOICES = [
        ('SALARY', 'Salary'),
        ('STIPEND', 'Stipend'),
    ]

    # Employee and Period Information
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='payslips'
    )
    pay_period_month = models.CharField(max_length=20)
    pay_period_year = models.IntegerField()
    salary_type = models.CharField(max_length=20, choices=SALARY_TYPE_CHOICES)

    # Work Days Information
    work_days = models.IntegerField()
    days_in_month = models.IntegerField()
    lop_days = models.IntegerField(default=0, verbose_name='Loss of Pay Days')

    # Salary Components (earnings)
    basic = models.DecimalField(max_digits=10, decimal_places=2)
    hra = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='House Rent Allowance')
    da = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Dearness Allowance')
    conveyance = models.DecimalField(max_digits=10, decimal_places=2)
    medical = models.DecimalField(max_digits=10, decimal_places=2)
    special_allowance = models.DecimalField(max_digits=10, decimal_places=2)

    # Employee-side deduction components
    pf_employee = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='PF Employee Contribution')

    # Totals
    total_earnings = models.DecimalField(max_digits=10, decimal_places=2)

    # Deductions
    professional_tax = models.DecimalField(max_digits=10, decimal_places=2)
    pf_employer = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='PF Employer Contribution')
    other_deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    salary_advance = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Final Calculations
    total_deductions = models.DecimalField(max_digits=10, decimal_places=2)
    net_pay = models.DecimalField(max_digits=10, decimal_places=2)
    tds_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text='Income tax (TDS) deducted this month',
    )

    # File Information
    pdf_path = models.CharField(max_length=255)
    qr_code_data = models.TextField()

    # Release Information
    is_released = models.BooleanField(
        default=False,
        help_text="Whether payslip is released and visible to employee"
    )
    released_at = models.DateTimeField(null=True, blank=True)
    released_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='released_payslips'
    )

    # Metadata
    generated_at = models.DateTimeField(auto_now_add=True)
    generated_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='generated_payslips'
    )

    class Meta:
        db_table = 'payslips'
        verbose_name = 'Payslip'
        verbose_name_plural = 'Payslips'
        ordering = ['-generated_at']
        unique_together = ['employee', 'pay_period_month', 'pay_period_year', 'salary_type']

    def __str__(self):
        return f"{self.employee.name} - {self.pay_period_month} {self.pay_period_year}"

    @property
    def filename(self):
        clean_name = self.employee.name.lower().replace(' ', '_')
        return f"payslip_{clean_name}_{self.pay_period_month.lower()}.pdf"

    @property
    def file_path(self):
        return f"payslips/{self.pay_period_year}/{self.pay_period_month}/{self.filename}"

    def recalculate(self, save=True):
        """
        Recompute total_earnings, total_deductions, and net_pay from stored components.

        Correct three-bucket model:
          gross_earnings      = basic + hra + da + conveyance + medical + special_allowance
          employee_deductions = pf_employee + professional_tax + other_deductions + salary_advance
          employer_cost       = pf_employer  (stored for reference, NOT deducted from employee)
          net_pay             = gross_earnings - employee_deductions
        """
        gross = (
            self.basic + self.hra + self.da +
            self.conveyance + self.medical + self.special_allowance
        )
        deductions = (
            self.pf_employee + self.professional_tax +
            self.other_deductions + self.salary_advance
        )
        self.total_earnings = gross
        self.total_deductions = deductions
        self.net_pay = gross - deductions
        if save:
            self.save(update_fields=['total_earnings', 'total_deductions', 'net_pay'])
        return self


class PayslipGenerationTask(models.Model):
    """
    Model to track bulk payslip generation tasks.
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]

    task_id = models.CharField(max_length=100, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    # Task Parameters
    employee_ids = models.JSONField()
    pay_period_month = models.CharField(max_length=20)
    pay_period_year = models.IntegerField()
    salary_type = models.CharField(max_length=20)

    # Progress Tracking
    total_employees = models.IntegerField()
    completed_employees = models.IntegerField(default=0)
    failed_employees = models.IntegerField(default=0)

    # Batch Information
    current_batch = models.IntegerField(default=0)
    total_batches = models.IntegerField(default=0)
    batch_size = models.IntegerField(default=25)

    # Error Information
    errors = models.JSONField(default=list, blank=True)

    # Metadata
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='payslip_tasks'
    )

    class Meta:
        db_table = 'payslip_generation_tasks'
        verbose_name = 'Payslip Generation Task'
        verbose_name_plural = 'Payslip Generation Tasks'
        ordering = ['-started_at']

    def __str__(self):
        return f"Task {self.task_id} - {self.status}"

    @property
    def progress_percentage(self):
        if self.total_employees == 0:
            return 0
        return (self.completed_employees / self.total_employees) * 100

    @property
    def is_complete(self):
        return self.status in ['COMPLETED', 'FAILED']

    @property
    def time_remaining(self):
        if self.completed_employees == 0:
            return 0
        elapsed_time = (self.completed_at or timezone.now()) - self.started_at
        if self.completed_employees > 0:
            avg_time_per_employee = elapsed_time.total_seconds() / self.completed_employees
            remaining_employees = self.total_employees - self.completed_employees
            return int((remaining_employees * avg_time_per_employee) / 60)
        return 0


# ─── Milestone 1: Audit Logging ───────────────────────────────────────────────

class PayrollAuditLog(models.Model):
    """
    Immutable audit trail for all payroll actions.
    Never update or delete records from this table.
    """
    ACTION_CHOICES = [
        ('GENERATE', 'Payslip Generated'),
        ('RELEASE', 'Payslip Released'),
        ('BULK_RELEASE', 'Bulk Release'),
        ('DOWNLOAD', 'Payslip Downloaded'),
        ('EMAIL_SENT', 'Email Sent'),
        ('EMAIL_FAILED', 'Email Failed'),
        ('VALIDATE', 'Validation Run'),
        ('DELETE', 'Payslip Deleted'),
        ('REOPEN', 'Payroll Reopened'),
        ('APPROVE', 'Payroll Approved'),
        ('HOLD', 'Employee Held'),
        ('RELEASE_HOLD', 'Employee Hold Released'),
        ('REPROCESS', 'Employee Reprocessed'),
        ('CALCULATE', 'Payroll Calculated'),
        ('LOCK', 'Payroll Locked'),
    ]

    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payroll_audit_logs',
    )
    # Optional: link to a specific payslip
    payslip = models.ForeignKey(
        Payslip,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
    )
    # Optional: link to a specific employee (for bulk actions)
    employee = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payroll_audit_logs',
    )
    pay_period_month = models.CharField(max_length=20, blank=True, null=True)
    pay_period_year = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payroll_audit_logs'
        verbose_name = 'Payroll Audit Log'
        verbose_name_plural = 'Payroll Audit Logs'
        ordering = ['-timestamp']

    def __str__(self):
        actor = self.performed_by.username if self.performed_by else 'system'
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {self.action} by {actor}"


# ─── Milestone 1: Validation Engine ──────────────────────────────────────────

class PayrollValidationIssue(models.Model):
    """
    Validation issues found during pre-generation checks.
    ERROR issues block generation; WARNING issues allow generation after acknowledgement.
    """
    SEVERITY_CHOICES = [
        ('ERROR', 'Error'),
        ('WARNING', 'Warning'),
    ]
    ISSUE_TYPE_CHOICES = [
        ('MISSING_SALARY_DATA', 'Missing Monthly Salary Data'),
        ('MISSING_BANK_DETAILS', 'Missing Bank Details'),
        ('MISSING_PF_DETAILS', 'Missing PF Details'),
        ('NEGATIVE_NET_PAY', 'Negative Net Pay'),
        ('DUPLICATE_PAYSLIP', 'Duplicate Payslip Exists'),
        ('MISSING_SALARY_STRUCTURE', 'Missing Salary Structure'),
        ('INACTIVE_EMPLOYEE', 'Employee Inactive'),
        # Phase B: Attendance proration issues
        ('MISSING_ATTENDANCE_DATA', 'Missing Attendance Data'),
        ('EXCESSIVE_LOP', 'Excessive LOP Days'),
        ('NEGATIVE_PAYABLE_DAYS', 'Negative Payable Days'),
        ('LOP_OVERRIDE_DIVERGENCE', 'LOP Override Divergence'),
        ('OTHER', 'Other'),
    ]

    # Link to the generation task that triggered this validation
    generation_task = models.ForeignKey(
        PayslipGenerationTask,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='validation_issues',
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='payroll_validation_issues',
    )
    pay_period_month = models.CharField(max_length=20)
    pay_period_year = models.IntegerField()
    issue_type = models.CharField(max_length=40, choices=ISSUE_TYPE_CHOICES)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='ERROR')
    message = models.TextField()
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payroll_validation_issues'
        verbose_name = 'Payroll Validation Issue'
        verbose_name_plural = 'Payroll Validation Issues'
        ordering = ['-created_at', 'severity']

    def __str__(self):
        return f"[{self.severity}] {self.employee.name} — {self.issue_type} ({self.pay_period_month} {self.pay_period_year})"


# ─── Milestone 2: Payroll Run Lifecycle ──────────────────────────────────────

class PayrollRun(models.Model):
    """
    Represents one payroll cycle for a given month/year/salary_type.
    Acts as the operational parent for all payslips in that period.

    Status transitions (enforced in service layer):
      DRAFT → CALCULATED → REVIEWED → APPROVED → LOCKED → RELEASED → PAID
      Any status → REOPENED (with mandatory reason)
    """
    SALARY_TYPE_CHOICES = [
        ('SALARY', 'Salary'),
        ('STIPEND', 'Stipend'),
    ]

    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('CALCULATED', 'Calculated'),
        ('REVIEWED', 'Reviewed'),
        ('APPROVED', 'Approved'),
        ('LOCKED', 'Locked'),
        ('RELEASED', 'Released'),
        ('PAID', 'Paid'),
        ('REOPENED', 'Reopened'),
    ]

    # Valid forward transitions — enforced by service layer
    VALID_TRANSITIONS = {
        'DRAFT':      ['CALCULATED'],
        'CALCULATED': ['REVIEWED', 'DRAFT'],
        'REVIEWED':   ['APPROVED', 'CALCULATED'],
        'APPROVED':   ['LOCKED', 'REVIEWED'],
        'LOCKED':     ['RELEASED'],
        'RELEASED':   ['PAID', 'REOPENED'],
        'PAID':       ['REOPENED'],
        'REOPENED':   ['DRAFT'],
    }

    month = models.CharField(max_length=20)
    year = models.IntegerField()
    salary_type = models.CharField(max_length=20, choices=SALARY_TYPE_CHOICES, default='SALARY')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')

    # Totals — populated during CALCULATE action
    total_employees = models.IntegerField(default=0)
    total_gross = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_deductions = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_net = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    # Lifecycle actors
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_payroll_runs',
    )
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approved_payroll_runs',
    )
    released_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='released_payroll_runs',
    )

    # Lifecycle timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Notes
    notes = models.TextField(blank=True, default='')
    reopen_reason = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'payroll_runs'
        verbose_name = 'Payroll Run'
        verbose_name_plural = 'Payroll Runs'
        ordering = ['-year', '-month']
        unique_together = ['month', 'year', 'salary_type']

    def __str__(self):
        return f"PayrollRun {self.month} {self.year} [{self.salary_type}] — {self.status}"

    def can_transition_to(self, new_status: str) -> bool:
        """Check if the transition from current status to new_status is valid."""
        return new_status in self.VALID_TRANSITIONS.get(self.status, [])


class PayrollRunItem(models.Model):
    """
    One record per employee within a PayrollRun.
    Captures the salary snapshot at calculation time and links to the generated Payslip.

    Milestone 3C additions:
      - payable_days / proration_factor for LOP proration support
      - employer_contributions bucket (separate from employee deductions)
      - salary_assignment_snapshot_id: FK to EmployeeSalaryAssignment used at calc time
      - calculation_source: 'SALARY_ASSIGNMENT' (3C engine) or 'MONTHLY_SALARY_DATA' (legacy)
      - calculation_notes: warnings/info from the calculation engine
    """
    ITEM_STATUS_CHOICES = [
        ('INCLUDED', 'Included'),
        ('ON_HOLD', 'On Hold'),
        ('REPROCESSING', 'Reprocessing'),
        ('ERROR', 'Error'),
    ]

    CALCULATION_SOURCE_CHOICES = [
        ('SALARY_ASSIGNMENT', 'Salary Assignment (3C Engine)'),
        ('MONTHLY_SALARY_DATA', 'Monthly Salary Data (Legacy)'),
    ]

    run = models.ForeignKey(
        PayrollRun, on_delete=models.CASCADE, related_name='items',
    )
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name='payroll_run_items',
    )
    status = models.CharField(max_length=20, choices=ITEM_STATUS_CHOICES, default='INCLUDED')

    # Input reference — the MonthlySalaryData used for this item (legacy path)
    salary_data = models.ForeignKey(
        'employees.MonthlySalaryData',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='payroll_run_items',
    )

    # 3C: salary assignment used at calculation time (snapshot reference)
    salary_assignment = models.ForeignKey(
        'payroll_config.EmployeeSalaryAssignment',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='payroll_run_items',
    )

    # Output reference — the generated Payslip
    payslip = models.OneToOneField(
        Payslip,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='run_item',
    )

    # Salary snapshot — stored at calculation time so the run is immutable after locking
    gross_earnings = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    employer_contributions = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text='Total employer-side contributions (PF employer, ESI employer, LWF employer). '
                  'Not deducted from employee net pay.',
    )
    net_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Attendance / proration fields
    lop_days = models.IntegerField(default=0)
    work_days = models.IntegerField(default=0)
    payable_days = models.IntegerField(
        default=0,
        help_text='Actual days payable after LOP (work_days - lop_days)',
    )
    days_in_month = models.IntegerField(
        default=0,
        help_text='Total calendar days in the payroll month',
    )
    proration_factor = models.DecimalField(
        max_digits=6, decimal_places=4, default=1,
        help_text='payable_days / days_in_month. 1.0 = full month, <1 = prorated.',
    )
    tds_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0'),
        help_text='Income tax (TDS) deducted for this payroll period.',
    )

    # Calculation metadata
    calculation_source = models.CharField(
        max_length=25,
        choices=CALCULATION_SOURCE_CHOICES,
        default='MONTHLY_SALARY_DATA',
    )
    calculation_notes = models.TextField(
        blank=True, default='',
        help_text='Warnings or informational notes from the calculation engine.',
    )

    # Hold / error tracking
    hold_reason = models.TextField(blank=True, default='')
    error_message = models.TextField(blank=True, default='')

    # Timestamps
    calculated_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_run_items'
        verbose_name = 'Payroll Run Item'
        verbose_name_plural = 'Payroll Run Items'
        unique_together = ['run', 'employee']
        ordering = ['employee__name']

    def __str__(self):
        return f"{self.run} — {self.employee.name} [{self.status}]"


# ─── Milestone 3C: PayrollRunItemLine ────────────────────────────────────────

class PayrollRunItemLine(models.Model):
    """
    One line per salary component for a PayrollRunItem.

    Stores a complete snapshot of each component's calculation at payroll time.
    This is the audit-safe, immutable breakdown that drives payslip rendering.

    Design:
      - All master-table values (code, name, type, calc_type) are snapshotted at calc time
      - Changing a SalaryComponent master after a run is calculated does NOT affect past runs
      - Lines are deleted and recreated on reprocess (safe — run is not yet locked)
      - After LOCKED status, lines must not be modified

    Classification:
      - EARNING lines contribute to gross_earnings
      - DEDUCTION lines reduce net_pay (employee-side)
      - EMPLOYER_CONTRIBUTION lines are informational (CTC view), do not reduce net_pay
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
        ('STATUTORY', 'Statutory'),
        ('FORMULA', 'Formula'),
        ('MANUAL', 'Manual Override'),
    ]

    run_item = models.ForeignKey(
        PayrollRunItem,
        on_delete=models.CASCADE,
        related_name='lines',
    )

    # FK to master component — nullable so lines survive component deletion
    component = models.ForeignKey(
        'payroll_config.SalaryComponent',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='payroll_run_lines',
    )

    # ── Snapshots (captured at calculation time) ──────────────────────────────
    code = models.CharField(max_length=30, help_text='Component code snapshot')
    name = models.CharField(max_length=100, help_text='Component name snapshot')
    component_type = models.CharField(
        max_length=25, choices=COMPONENT_TYPE_CHOICES,
        help_text='Component type snapshot',
    )
    calculation_type = models.CharField(
        max_length=25, choices=CALCULATION_TYPE_CHOICES,
        help_text='Calculation type snapshot',
    )

    # Rate/value snapshot — the configured rate used for this calculation
    rate = models.DecimalField(
        max_digits=10, decimal_places=4, default=0,
        help_text='Rate used: rupee amount for FIXED_AMOUNT, percentage for PERCENTAGE_OF_* types',
    )

    # Quantity — for future use (e.g. overtime hours, days)
    quantity = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        help_text='Optional quantity multiplier (e.g. days, hours)',
    )

    # The computed amount for this line
    amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text='Final computed amount for this component in this payroll period',
    )

    # Compliance / classification flags (snapshotted)
    is_statutory = models.BooleanField(default=False)
    is_taxable = models.BooleanField(default=False)
    affects_gross = models.BooleanField(default=False)
    affects_net_pay = models.BooleanField(default=True)
    affects_ctc = models.BooleanField(default=False)

    # Display
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'payroll_run_item_lines'
        verbose_name = 'Payroll Run Item Line'
        verbose_name_plural = 'Payroll Run Item Lines'
        ordering = ['display_order', 'component_type', 'code']
        indexes = [
            models.Index(fields=['run_item', 'component_type'], name='pril_item_type_idx'),
            models.Index(fields=['run_item', 'code'], name='pril_item_code_idx'),
        ]

    def __str__(self):
        return f"{self.run_item} / {self.code} = ₹{self.amount}"


# ─── Phase B: Payroll Input Snapshot ─────────────────────────────────────────

class PayrollInputSnapshot(models.Model):
    """
    Locks the attendance/leave inputs used for a specific PayrollRunItem at calculation time.

    Created when compute_payable_days() is called during calculate_run().
    Immutable once the PayrollRun reaches LOCKED status.

    This provides a complete audit trail of exactly what attendance data drove
    each employee's payroll calculation, independent of any subsequent changes
    to AttendanceRecord or LeaveRequest.
    """
    run_item = models.OneToOneField(
        PayrollRunItem,
        on_delete=models.CASCADE,
        related_name='input_snapshot',
    )

    # Calendar skeleton
    total_calendar_days = models.PositiveSmallIntegerField(default=0)
    weekly_off_days = models.PositiveSmallIntegerField(default=0)
    holiday_days = models.PositiveSmallIntegerField(default=0)
    working_days = models.PositiveSmallIntegerField(default=0)

    # Attendance summary
    present_days = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0'))
    leave_days_paid = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0'))
    leave_days_unpaid = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0'))
    absent_days = models.PositiveSmallIntegerField(default=0)

    # Computed payroll values
    lop_days = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0'))
    payable_days = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0'))

    # Proration
    proration_basis = models.CharField(max_length=20, default='CALENDAR_DAYS')
    proration_factor = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal('1'))

    # Override tracking
    lop_override_used = models.BooleanField(
        default=False,
        help_text='True if MonthlySalaryData.lop_override was applied instead of computed LOP.',
    )

    # Audit
    snapshot_at = models.DateTimeField(auto_now_add=True)
    warnings = models.JSONField(
        default=list, blank=True,
        help_text='List of warning strings from compute_payable_days().',
    )

    class Meta:
        db_table = 'payroll_input_snapshots'
        verbose_name = 'Payroll Input Snapshot'
        verbose_name_plural = 'Payroll Input Snapshots'

    def __str__(self):
        return (
            f"Snapshot for {self.run_item.employee.name} "
            f"[{self.run_item.run.month} {self.run_item.run.year}] "
            f"payable={self.payable_days}"
        )
