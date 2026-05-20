from django.db import models
from django.core.validators import RegexValidator, FileExtensionValidator
from django.utils import timezone
from departments.models import Department
from decimal import Decimal
import secrets
import hashlib


class Employee(models.Model):
    """
    Employee model for storing employee information.
    """
    PAY_MODE_CHOICES = [
        ('Bank Transfer', 'Bank Transfer'),
        ('NEFT', 'NEFT'),
        ('Cheque', 'Cheque'),
        ('Cash', 'Cash'),
    ]

    # Basic Information
    employee_id = models.CharField(
        max_length=20, 
        unique=True,
        validators=[RegexValidator(
            regex=r'^[A-Z0-9]+$',
            message='Employee ID must contain only uppercase letters and numbers.'
        )]
    )
    name = models.CharField(max_length=100)
    position = models.CharField(max_length=100)
    department = models.ForeignKey(
        Department, 
        on_delete=models.CASCADE,
        related_name='employees'
    )
    
    # Personal Information
    dob = models.DateField(verbose_name='Date of Birth')
    doj = models.DateField(verbose_name='Date of Joining')
    
    # Financial Information
    pan = models.CharField(
        max_length=10,
        validators=[RegexValidator(
            regex=r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$',
            message='PAN must be in format: ABCDE1234F'
        )]
    )
    pf_number = models.CharField(max_length=30, verbose_name='PF Number', blank=True, null=True)
    bank_account = models.CharField(max_length=30, verbose_name='Bank Account Number')
    bank_ifsc = models.CharField(
        max_length=15,
        validators=[RegexValidator(
            regex=r'^[A-Z]{4}0[A-Z0-9]{6}$',
            message='IFSC must be in format: ABCD0123456'
        )]
    )
    pay_mode = models.CharField(max_length=20, choices=PAY_MODE_CHOICES, default='NEFT')
    
    # Additional Information
    location = models.CharField(max_length=100)
    shift = models.ForeignKey(
        'attendance.Shift',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees',
        help_text='Currently assigned shift'
    )
    health_card_no = models.CharField(max_length=50, blank=True, null=True)
    email = models.CharField(max_length=255, blank=True, null=True, help_text='Employee email for system login')
    personal_email = models.CharField(max_length=255, blank=True, null=True, help_text='Personal email for welcome emails and communication')
    
    # Login Credentials
    password = models.CharField(
        max_length=255, 
        blank=True, 
        null=True,
        help_text="Temporary password for system access"
    )
    password_changed = models.BooleanField(
        default=False,
        help_text="Whether employee has changed their initial password"
    )
    password_set_date = models.DateTimeField(
        auto_now_add=True,
        null=True,
        blank=True,
        help_text="When the password was set"
    )
    
    # Salary Information
    lpa = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        verbose_name='LPA (Lakhs Per Annum)',
        help_text='Annual salary in lakhs (e.g., 4.5 for 4.5 LPA)',
        null=True,
        blank=True
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    account_activated = models.BooleanField(
        default=False,
        help_text="Whether employee has activated their account via invitation"
    )
    onboarding_completed = models.BooleanField(
        default=False,
        help_text="Whether employee has completed the onboarding form"
    )
    account_activated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the employee activated their account"
    )

    # ── Reporting hierarchy ──────────────────────────────────────────────────
    reporting_manager = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='direct_reports',
        help_text='Direct reporting manager for this employee',
    )
    is_top_level_manager = models.BooleanField(
        default=False,
        help_text='Marks this employee as a top-level manager node in the org chart',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employees'
        verbose_name = 'Employee'
        verbose_name_plural = 'Employees'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.employee_id})"

    @property
    def full_name(self):
        return self.name

    @property
    def department_name(self):
        return self.department.department_name


class SalaryStructure(models.Model):
    """
    Salary structure model for storing employee salary information.
    """
    SALARY_TYPE_CHOICES = [
        ('SALARY', 'Salary'),
        ('STIPEND', 'Stipend'),
    ]

    employee = models.ForeignKey(
        Employee, 
        on_delete=models.CASCADE,
        related_name='salary_structures'
    )
    salary_type = models.CharField(max_length=20, choices=SALARY_TYPE_CHOICES)
    annual_ctc = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='Annual CTC')
    effective_from = models.DateField(default=models.functions.Now)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'salary_structures'
        verbose_name = 'Salary Structure'
        verbose_name_plural = 'Salary Structures'
        ordering = ['-effective_from']

    def __str__(self):
        return f"{self.employee.name} - {self.salary_type} ({self.annual_ctc})"

    @property
    def monthly_salary(self):
        return self.annual_ctc / 12

    @property
    def basic_salary(self):
        return self.monthly_salary * 0.4

    @property
    def hra(self):
        return self.basic_salary * 0.2

    @property
    def da(self):
        return self.basic_salary * 0.1

    @property
    def conveyance(self):
        return 1600  # Fixed amount

    @property
    def medical(self):
        return 1250  # Fixed amount

    @property
    def pf_employee(self):
        return self.basic_salary * 0.12

    @property
    def pf_employer(self):
        return self.basic_salary * 0.12

    @property
    def professional_tax(self):
        return 200  # Fixed amount

    @property
    def special_allowance(self):
        return self.monthly_salary - (
            self.basic_salary + self.da + self.hra + 
            self.medical + self.conveyance + self.pf_employer
        )


class MonthlySalaryData(models.Model):
    """
    Model for storing monthly salary data uploaded via Excel or entered manually.
    Extended in Milestone 3E to support manual entry, one-time adjustments, and salary_type.
    """
    SALARY_TYPE_CHOICES = [
        ('SALARY', 'Salary'),
        ('STIPEND', 'Stipend'),
    ]
    SOURCE_CHOICES = [
        ('EXCEL_IMPORT', 'Excel Import'),
        ('MANUAL_ENTRY', 'Manual Entry'),
    ]

    employee = models.ForeignKey(
        Employee, 
        on_delete=models.CASCADE,
        related_name='monthly_salaries'
    )
    month = models.CharField(max_length=20)
    year = models.IntegerField()
    salary_type = models.CharField(
        max_length=20, choices=SALARY_TYPE_CHOICES, default='SALARY',
        help_text='Salary type for this monthly data record',
    )

    # Salary Components
    basic = models.DecimalField(max_digits=10, decimal_places=2)
    hra = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='House Rent Allowance')
    da = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Dearness Allowance')
    conveyance = models.DecimalField(max_digits=10, decimal_places=2)
    medical = models.DecimalField(max_digits=10, decimal_places=2)
    special_allowance = models.DecimalField(max_digits=10, decimal_places=2)
    pf_employee = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='PF Employee')

    # Deductions
    professional_tax = models.DecimalField(max_digits=10, decimal_places=2)
    pf_employer = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='PF Employer')
    other_deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    salary_advance = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Work Days Information
    work_days = models.IntegerField()
    days_in_month = models.IntegerField()
    lop_days = models.IntegerField(default=0, verbose_name='Loss of Pay Days')
    lop_override = models.IntegerField(
        null=True, blank=True,
        help_text='Manual LOP override. If set, overrides attendance-derived LOP.',
    )

    # One-time earning adjustments (3E)
    bonus = models.DecimalField(max_digits=10, decimal_places=2, default=0,
        help_text='One-time bonus for this month')
    incentive = models.DecimalField(max_digits=10, decimal_places=2, default=0,
        help_text='Performance incentive for this month')
    arrears = models.DecimalField(max_digits=10, decimal_places=2, default=0,
        help_text='Salary arrears (backdated revision payment)')
    reimbursement = models.DecimalField(max_digits=10, decimal_places=2, default=0,
        help_text='Expense reimbursements for this month')
    other_earning_adjustment = models.DecimalField(max_digits=10, decimal_places=2, default=0,
        help_text='Any other one-time earning adjustment')
    other_deduction_adjustment = models.DecimalField(max_digits=10, decimal_places=2, default=0,
        help_text='Any other one-time deduction adjustment')

    # Notes / audit
    remarks = models.TextField(blank=True, default='', help_text='HR notes for this month')
    source = models.CharField(
        max_length=20, choices=SOURCE_CHOICES, default='EXCEL_IMPORT',
        help_text='How this record was created',
    )

    # Metadata
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        'authentication.AdminUser', 
        on_delete=models.CASCADE,
        related_name='uploaded_salaries'
    )
    updated_by = models.ForeignKey(
        'authentication.AdminUser',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='updated_monthly_salaries',
    )
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'monthly_salary_data'
        verbose_name = 'Monthly Salary Data'
        verbose_name_plural = 'Monthly Salary Data'
        ordering = ['-year', '-month']
        unique_together = [('employee', 'month', 'year', 'salary_type')]

    def __str__(self):
        return f"{self.employee.name} - {self.month} {self.year} ({self.salary_type})"

    @property
    def gross_earnings(self):
        """Gross earnings = base components + one-time earning adjustments."""
        base = self.basic + self.hra + self.da + self.conveyance + self.medical + self.special_allowance
        one_time = self.bonus + self.incentive + self.arrears + self.reimbursement + self.other_earning_adjustment
        return base + one_time

    @property
    def total_earnings(self):
        return self.gross_earnings

    @property
    def total_deductions(self):
        """Total employee-side deductions including one-time deduction adjustments."""
        return (
            self.pf_employee + self.professional_tax
            + self.other_deductions + self.salary_advance
            + self.other_deduction_adjustment
        )

    @property
    def net_pay(self):
        """Net pay = gross earnings - employee deductions."""
        return self.total_earnings - self.total_deductions

    @property
    def effective_lop(self):
        """Returns lop_override if set, otherwise lop_days."""
        return self.lop_override if self.lop_override is not None else self.lop_days


class PayrollInputAdjustment(models.Model):
    """
    Normalized one-time payroll adjustment for a specific employee/month/year.
    These become line items in the payroll snapshot during calculation.
    """
    ADJUSTMENT_TYPE_CHOICES = [
        ('EARNING', 'Earning'),
        ('DEDUCTION', 'Deduction'),
        ('REIMBURSEMENT', 'Reimbursement'),
        ('ARREAR', 'Arrear'),
        ('BONUS', 'Bonus'),
        ('INCENTIVE', 'Incentive'),
        ('LOAN', 'Loan Deduction'),
        ('OTHER', 'Other'),
    ]
    SALARY_TYPE_CHOICES = [
        ('SALARY', 'Salary'),
        ('STIPEND', 'Stipend'),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='payroll_adjustments',
    )
    month = models.CharField(max_length=20)
    year = models.IntegerField()
    salary_type = models.CharField(
        max_length=20, choices=SALARY_TYPE_CHOICES, default='SALARY',
    )
    adjustment_type = models.CharField(max_length=20, choices=ADJUSTMENT_TYPE_CHOICES)
    component = models.ForeignKey(
        'payroll_config.SalaryComponent',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='payroll_adjustments',
        help_text='Optional link to a SalaryComponent for classification',
    )
    label = models.CharField(
        max_length=100,
        help_text='Human-readable label (e.g. "Diwali Bonus", "Laptop Reimbursement")',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    is_taxable = models.BooleanField(default=False)
    is_recurring = models.BooleanField(
        default=False,
        help_text='If True, carries forward to next month automatically',
    )
    remarks = models.TextField(blank=True, default='')
    is_active = models.BooleanField(
        default=True,
        help_text='Inactive adjustments are excluded from payroll calculation',
    )
    created_by = models.ForeignKey(
        'authentication.AdminUser',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_payroll_adjustments',
    )
    updated_by = models.ForeignKey(
        'authentication.AdminUser',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='updated_payroll_adjustments',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_input_adjustments'
        verbose_name = 'Payroll Input Adjustment'
        verbose_name_plural = 'Payroll Input Adjustments'
        ordering = ['-year', '-month', 'employee__name']
        indexes = [
            models.Index(fields=['employee', 'month', 'year', 'salary_type'], name='pia_emp_period_idx'),
            models.Index(fields=['month', 'year', 'salary_type', 'is_active'], name='pia_period_active_idx'),
        ]

    def __str__(self):
        return f"{self.employee.name} — {self.label} ({self.month} {self.year})"


class ActualSalaryCredited(models.Model):
    """
    Model for storing actual salary credited to employees for a month.
    """
    employee = models.ForeignKey(
        Employee, 
        on_delete=models.CASCADE,
        related_name='actual_salaries'
    )
    month = models.CharField(max_length=20)
    year = models.IntegerField()
    
    # Actual salary credited
    actual_salary_credited = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Metadata
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        'authentication.AdminUser', 
        on_delete=models.CASCADE,
        related_name='uploaded_actual_salaries'
    )
    
    class Meta:
        db_table = 'actual_salary_credited'
        verbose_name = 'Actual Salary Credited'
        verbose_name_plural = 'Actual Salaries Credited'
        ordering = ['-year', '-month']
        unique_together = ['employee', 'month', 'year']

    def __str__(self):
        return f"{self.employee.name} - {self.month} {self.year} - ₹{self.actual_salary_credited}"


class EmailLog(models.Model):
    """
    Model to track email sending history.
    """
    EMAIL_TYPE_CHOICES = [
        ('WELCOME', 'Welcome Email'),
        ('PAYSLIP', 'Payslip Email'),
        ('BULK_WELCOME', 'Bulk Welcome Email'),
        ('RELIEVING', 'Relieving Letter'),
        ('EXPERIENCE', 'Experience Letter'),
    ]
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SENT', 'Sent'),
        ('FAILED', 'Failed'),
    ]

    employee = models.ForeignKey(
        Employee, 
        on_delete=models.CASCADE,
        related_name='email_logs',
        null=True,
        blank=True
    )
    email_type = models.CharField(max_length=20, choices=EMAIL_TYPE_CHOICES)
    recipient_email = models.EmailField()
    subject = models.CharField(max_length=255)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    message = models.TextField(blank=True, null=True)
    sent_at = models.DateTimeField(auto_now_add=True)
    error_message = models.TextField(blank=True, null=True)
    
    class Meta:
        db_table = 'email_logs'
        verbose_name = 'Email Log'
        verbose_name_plural = 'Email Logs'
        ordering = ['-sent_at']

    def __str__(self):
        return f"Email Log: {self.email_type} to {self.recipient_email}"


class EmployeeProfile(models.Model):
    """
    Extended employee profile information for onboarding.
    """
    employee = models.OneToOneField(
        Employee,
        on_delete=models.CASCADE,
        related_name='profile'
    )
    phone = models.CharField(max_length=15, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    emergency_contact = models.CharField(max_length=100, blank=True, null=True)
    bank_account = models.CharField(max_length=30, blank=True, null=True)
    ifsc_code = models.CharField(max_length=15, blank=True, null=True)
    pan_number = models.CharField(max_length=10, blank=True, null=True)
    profile_photo = models.ImageField(
        upload_to='employee_photos/',
        blank=True,
        null=True,
        validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png'])]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_profiles'
        verbose_name = 'Employee Profile'
        verbose_name_plural = 'Employee Profiles'

    def __str__(self):
        return f"Profile of {self.employee.name}"


class EmployeeInvitation(models.Model):
    """
    Stores employee invitation tokens for account activation.
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('ACTIVATED', 'Activated'),
        ('EXPIRED', 'Expired'),
    ]

    employee = models.OneToOneField(
        Employee,
        on_delete=models.CASCADE,
        related_name='invitation'
    )
    email = models.EmailField()
    token = models.CharField(max_length=255, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    activated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'employee_invitations'
        verbose_name = 'Employee Invitation'
        verbose_name_plural = 'Employee Invitations'

    def __str__(self):
        return f"Invitation for {self.employee.name} ({self.email})"

    @staticmethod
    def generate_token():
        """Generate a secure random token."""
        return secrets.token_urlsafe(32)

    @property
    def is_expired(self):
        """Check if invitation token has expired."""
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        """Check if invitation is valid for activation."""
        return self.status == 'PENDING' and not self.is_expired


class EmployeeAttendance(models.Model):
    """
    Tracks employee sign-in and sign-out times.
    """
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    date = models.DateField()
    sign_in_time = models.DateTimeField(null=True, blank=True)
    sign_out_time = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_attendance'
        verbose_name = 'Employee Attendance'
        verbose_name_plural = 'Employee Attendance'
        unique_together = ['employee', 'date']
        ordering = ['-date']

    def __str__(self):
        return f"{self.employee.name} - {self.date}"

    @property
    def total_hours(self):
        """Calculate total working hours."""
        if self.sign_in_time and self.sign_out_time:
            duration = self.sign_out_time - self.sign_in_time
            return duration.total_seconds() / 3600
        return 0


class LeaveType(models.Model):
    """
    Pre-defined leave types in the system.
    is_paid=True  → paid leave, no LOP deduction
    is_paid=False → unpaid leave, counts as LOP in payroll
    """
    name = models.CharField(max_length=50, unique=True)
    max_days_per_year = models.IntegerField(default=10)
    is_paid = models.BooleanField(
        default=True,
        help_text='Paid leave does not deduct from salary. Unpaid leave becomes LOP.',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'leave_types'
        verbose_name = 'Leave Type'
        verbose_name_plural = 'Leave Types'

    def __str__(self):
        return self.name


class LeavePolicy(models.Model):
    """
    Configurable leave policy aligned to the active leave cycle.
    The system currently assumes a financial-year leave cycle (Apr-Mar).
    """
    name = models.CharField(max_length=100, default="RDesk Policy")
    earned_leave_per_year = models.IntegerField(default=18)
    casual_leave_per_year = models.IntegerField(default=6)
    sick_leave_per_year = models.IntegerField(default=6)
    el_carry_forward_limit = models.IntegerField(default=30)
    el_encashment_limit = models.IntegerField(default=30)
    accrual_enabled = models.BooleanField(default=True)
    accrual_rate_per_month = models.DecimalField(max_digits=4, decimal_places=1, default=Decimal("1.5"))
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'leave_policies'
        verbose_name = 'Leave Policy'
        verbose_name_plural = 'Leave Policies'
        ordering = ['-is_active', '-updated_at']

    def __str__(self):
        return self.name


class LeaveRequest(models.Model):
    """
    Leave request model for employee leave applications.
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='leave_requests'
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.SET_NULL,
        null=True,
        related_name='leave_requests'
    )
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    approved_by = models.ForeignKey(
        'authentication.AdminUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_leaves'
    )
    approved_date = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, null=True)
    paid_days = models.DecimalField(
        max_digits=5, decimal_places=1, default=0,
        help_text='Paid leave days approved against available balance.',
    )
    lop_days = models.DecimalField(
        max_digits=5, decimal_places=1, default=0,
        help_text='Approved leave days treated as Loss of Pay.',
    )
    lop_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text='Estimated payroll deduction for LOP days in this request.',
    )
    day_breakdown = models.JSONField(
        default=list, blank=True,
        help_text='Per-day approval breakdown. Each row contains date and PAID/LOP status.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'leave_requests'
        verbose_name = 'Leave Request'
        verbose_name_plural = 'Leave Requests'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.employee.name} - {self.leave_type.name if self.leave_type else 'N/A'} ({self.start_date} to {self.end_date})"

    @property
    def number_of_days(self):
        """Calculate the number of days for this leave request."""
        return (self.end_date - self.start_date).days + 1


class EmployeeDocument(models.Model):
    """
    Document storage for employees and admin-uploaded documents.
    """
    DOC_TYPE_CHOICES = [
        ('PAN', 'PAN Card'),
        ('AADHAAR', 'Aadhaar'),
        ('BANK_DOC', 'Bank Document'),
        ('CERTIFICATE', 'Certificate'),
        ('OFFER_LETTER', 'Offer Letter'),
        ('APPOINTMENT_LETTER', 'Appointment Letter'),
        ('PROMOTION_LETTER', 'Promotion Letter'),
        ('PAYSLIP', 'Payslip'),
        ('OTHER', 'Other'),
    ]

    VISIBILITY_CHOICES = [
        ('EMPLOYEE_ONLY', 'Employee Only'),
        ('ADMIN_ONLY', 'Admin Only'),
        ('BOTH', 'Both'),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='documents'
    )
    document_type = models.CharField(max_length=20, choices=DOC_TYPE_CHOICES)
    document_name = models.CharField(max_length=255)
    file = models.FileField(
        upload_to='employee_documents/',
        validators=[FileExtensionValidator(allowed_extensions=['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'])]
    )
    uploaded_by = models.ForeignKey(
        'authentication.AdminUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_documents'
    )
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default='BOTH')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_verified = models.BooleanField(default=True)

    class Meta:
        db_table = 'employee_documents'
        verbose_name = 'Employee Document'
        verbose_name_plural = 'Employee Documents'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.employee.name} - {self.document_name}"


class Notification(models.Model):
    """
    In-app notification system for employees.
    """
    NOTIFICATION_TYPE_CHOICES = [
        ('PAYSLIP_RELEASED', 'Payslip Released'),
        ('LEAVE_APPROVED', 'Leave Approved'),
        ('LEAVE_REJECTED', 'Leave Rejected'),
        ('DOCUMENT_UPLOADED', 'Document Uploaded'),
        ('ANNOUNCEMENT', 'Announcement'),
        ('ATTENDANCE_ALERT', 'Attendance Alert'),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    related_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.employee.name}"
        return f"{self.email_type} to {self.recipient_email} - {self.status}"


class Announcement(models.Model):
    """
    Mass communication / announcement sent by admin to all or filtered employees.
    Each send creates one Announcement + per-employee AnnouncementRecipient records.
    """
    CATEGORY_CHOICES = [
        ('GENERAL', 'General'),
        ('HR', 'HR'),
        ('PAYROLL', 'Payroll'),
        ('POLICY', 'Policy Update'),
        ('EVENT', 'Event'),
        ('URGENT', 'Urgent'),
    ]

    title = models.CharField(max_length=255)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='GENERAL')
    subject = models.CharField(max_length=255)
    body = models.TextField()
    sent_by = models.ForeignKey(
        'authentication.AdminUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='announcements',
    )
    recipient_filter = models.CharField(
        max_length=50, default='ALL',
        help_text='ALL or department_id or employee_id list'
    )
    total_recipients = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'announcements'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.subject} ({self.created_at.date()})"


class AnnouncementRecipient(models.Model):
    """Per-employee delivery record for an Announcement."""
    announcement = models.ForeignKey(
        Announcement,
        on_delete=models.CASCADE,
        related_name='recipients',
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='announcement_receipts',
    )
    is_read = models.BooleanField(default=False)
    delivered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'announcement_recipients'
        unique_together = ['announcement', 'employee']
        ordering = ['-delivered_at']

    def __str__(self):
        return f"{self.announcement.subject} → {self.employee.name}"


# ─── Phase C: TDS / Income Tax Engine ────────────────────────────────────────

class EmployeeTaxProfile(models.Model):
    """
    Per-employee income tax settings.
    One record per employee (OneToOne).

    Controls:
      - Which tax regime the employee has opted for (OLD / NEW)
      - Whether TDS should be skipped entirely (e.g. interns, exempt employees)
      - Manual monthly TDS override (escape hatch, same pattern as lop_override)

    Phase 1: model only.
    Phase 2: read by tds_service.compute_tds_for_employee().

    If no EmployeeTaxProfile exists for an employee, the engine defaults to:
      - regime = NEW (default from FY 2023-24 onwards)
      - is_tds_exempt = False
      - tds_override = None
    """
    REGIME_CHOICES = [
        ('OLD', 'Old Tax Regime'),
        ('NEW', 'New Tax Regime'),
    ]

    employee = models.OneToOneField(
        Employee,
        on_delete=models.CASCADE,
        related_name='tax_profile',
    )
    regime = models.CharField(
        max_length=5,
        choices=REGIME_CHOICES,
        default='NEW',
        help_text='Tax regime chosen by the employee. Defaults to NEW regime.',
    )
    is_tds_exempt = models.BooleanField(
        default=False,
        help_text='If True, TDS computation is skipped for this employee entirely.',
    )
    tds_override = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        help_text=(
            'Manual monthly TDS override in rupees. '
            'If set, overrides the computed TDS for every payroll run. '
            'Use as an escape hatch for edge cases.'
        ),
    )
    notes = models.TextField(
        blank=True, default='',
        help_text='HR notes about this employee\'s tax situation.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_tax_profiles'
        verbose_name = 'Employee Tax Profile'
        verbose_name_plural = 'Employee Tax Profiles'

    def __str__(self):
        status = 'EXEMPT' if self.is_tds_exempt else self.regime
        override = f' override=₹{self.tds_override}' if self.tds_override is not None else ''
        return f"TaxProfile [{self.employee.employee_id}] {status}{override}"


# ─── Tax Declaration System ───────────────────────────────────────────────────

class TaxDeclaration(models.Model):
    """
    Employee's annual tax-saving investment declaration for a financial year.

    One record per (employee, financial_year). Employee submits once and can
    edit until the admin-set deadline. Admin approves or rejects.

    Sections covered:
      80C  — LIC, PF (auto-filled), ELSS, PPF, NSC, home loan principal, etc.
      80D  — Medical insurance premiums (self + parents)
      HRA  — Rent paid details for HRA exemption calculation
      80E  — Education loan interest
      80G  — Donations
      Other — NPS (80CCD), home loan interest (24b), etc.

    The TDS engine reads approved declarations to reduce projected taxable income.
    """
    STATUS_CHOICES = [
        ('DRAFT',    'Draft — not yet submitted'),
        ('SUBMITTED','Submitted — awaiting admin review'),
        ('APPROVED', 'Approved — used in TDS calculation'),
        ('REJECTED', 'Rejected — employee must revise'),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='tax_declarations',
    )
    financial_year = models.CharField(
        max_length=10,
        help_text='e.g. 2025-26',
    )
    status = models.CharField(
        max_length=12, choices=STATUS_CHOICES, default='DRAFT',
    )

    # ── Section 80C (max ₹1,50,000) ──────────────────────────────────────────
    lic_premium          = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    elss_investment      = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    ppf_investment       = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    nsc_investment       = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    home_loan_principal  = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tuition_fees         = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    other_80c            = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # ── Section 80D (medical insurance) ──────────────────────────────────────
    medical_insurance_self    = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    medical_insurance_parents = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    parents_senior_citizen    = models.BooleanField(
        default=False,
        help_text='If True, parents 80D cap is ₹50,000 instead of ₹25,000',
    )

    # ── HRA exemption details ─────────────────────────────────────────────────
    rent_paid_monthly    = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    landlord_name        = models.CharField(max_length=120, blank=True, default='')
    landlord_pan         = models.CharField(max_length=10, blank=True, default='')
    city_type            = models.CharField(
        max_length=10,
        choices=[('METRO', 'Metro'), ('NON_METRO', 'Non-Metro')],
        default='NON_METRO',
        help_text='Metro = 50% of Basic for HRA exemption; Non-Metro = 40%',
    )

    # ── Section 80E (education loan interest) ────────────────────────────────
    education_loan_interest = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # ── Section 80G (donations) ───────────────────────────────────────────────
    donations_80g = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    donation_type = models.CharField(
        max_length=20,
        choices=[
            ('100_PCT',          '100% deduction (no limit)'),
            ('50_PCT',           '50% deduction (no limit)'),
            ('100_PCT_WITH_LIMIT','100% deduction (with 10% of income limit)'),
            ('50_PCT_WITH_LIMIT', '50% deduction (with 10% of income limit)'),
        ],
        default='50_PCT',
        help_text='Category of donation for 80G deduction calculation',
    )

    # ── Section 80CCD(1B) — NPS additional ───────────────────────────────────
    nps_additional = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text='Additional NPS contribution beyond employer contribution (max ₹50,000)',
    )

    # ── Section 24(b) — Home loan interest ───────────────────────────────────
    home_loan_interest = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text='Interest on home loan for self-occupied property (max ₹2,00,000)',
    )

    # ── Admin review ──────────────────────────────────────────────────────────
    admin_remarks = models.TextField(blank=True, default='')
    reviewed_by = models.ForeignKey(
        'authentication.AdminUser',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reviewed_tax_declarations',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # ── Proof documents (stored as JSON list of file paths) ───────────────────
    proof_documents = models.JSONField(
        default=list, blank=True,
        help_text='List of uploaded proof document paths',
    )

    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tax_declarations'
        verbose_name = 'Tax Declaration'
        verbose_name_plural = 'Tax Declarations'
        unique_together = [('employee', 'financial_year')]
        ordering = ['-financial_year', 'employee__name']

    def __str__(self):
        return f"TaxDecl [{self.employee.employee_id}] FY {self.financial_year} [{self.status}]"

    @property
    def total_80c(self):
        """Sum of all 80C components (before ₹1.5L cap)."""
        return (
            self.lic_premium + self.elss_investment + self.ppf_investment +
            self.nsc_investment + self.home_loan_principal + self.tuition_fees +
            self.other_80c
        )

    @property
    def total_80d(self):
        cap_self    = Decimal('25000')
        cap_parents = Decimal('50000') if self.parents_senior_citizen else Decimal('25000')
        return (
            min(Decimal(str(self.medical_insurance_self)),    cap_self) +
            min(Decimal(str(self.medical_insurance_parents)), cap_parents)
        )

    @property
    def total_declared_deductions(self):
        """Total declared deductions across all sections (after statutory caps)."""
        # 80C cap ₹1.5L
        capped_80c = min(self.total_80c, Decimal('150000'))
        # 80D already capped in property
        capped_80d = self.total_80d
        # 80CCD(1B) NPS cap ₹50k
        capped_nps = min(Decimal(str(self.nps_additional)), Decimal('50000'))
        # 24(b) home loan interest cap ₹2L
        capped_hl  = min(Decimal(str(self.home_loan_interest)), Decimal('200000'))
        # 80E education loan — no cap
        edu = Decimal(str(self.education_loan_interest))
        # 80G — computed by donation_type
        g = self._compute_80g()
        return capped_80c + capped_80d + capped_nps + capped_hl + edu + g

    def _compute_80g(self) -> Decimal:
        """Compute 80G deduction based on donation_type."""
        amt = Decimal(str(self.donations_80g))
        if amt <= 0:
            return Decimal('0')
        if self.donation_type == '100_PCT':
            return amt
        if self.donation_type == '50_PCT':
            return amt * Decimal('0.5')
        # WITH_LIMIT types: capped at 10% of gross income — we store the raw amount
        # and apply the 10% cap in tds_service where gross income is known.
        # Here we return the pre-cap amount for display purposes.
        if self.donation_type == '100_PCT_WITH_LIMIT':
            return amt
        # 50_PCT_WITH_LIMIT
        return amt * Decimal('0.5')


class EmployeeLeaveBalance(models.Model):
    """
    Tracks allocated and used leave days per employee, per leave type, per year.
    Created automatically when a leave type is first used or via admin seeding.
    Updated atomically on leave approval.
    """
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='leave_balances',
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name='balances',
    )
    year = models.PositiveSmallIntegerField(
        help_text='Leave cycle start year this balance applies to (e.g. 2026 for FY 2026-27)',
    )
    opening_balance = models.DecimalField(
        max_digits=6, decimal_places=1, default=0,
        help_text='Opening balance created at leave-cycle start, including EL carry-forward.',
    )
    allocated = models.DecimalField(
        max_digits=5, decimal_places=1, default=0,
        help_text='Total days allocated for the leave cycle, including monthly accruals.',
    )
    used = models.DecimalField(
        max_digits=5, decimal_places=1, default=0,
        help_text='Days consumed by approved leave requests',
    )
    encashed = models.DecimalField(
        max_digits=5, decimal_places=1, default=0,
        help_text='Earned leave days already encashed in the cycle.',
    )
    last_accrual_processed_on = models.DateField(
        null=True, blank=True,
        help_text='First day of the latest month for which EL accrual was processed.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_leave_balances'
        unique_together = [('employee', 'leave_type', 'year')]
        ordering = ['-year', 'employee__name', 'leave_type__name']
        indexes = [
            models.Index(fields=['employee', 'year'], name='elb_emp_year_idx'),
        ]

    def __str__(self):
        return (
            f"{self.employee.employee_id} | {self.leave_type.name} | "
            f"{self.year}: {self.remaining}/{self.allocated}"
        )

    @property
    def remaining(self):
        return max(self.allocated - self.used - self.encashed, Decimal('0'))


class LeaveEncashment(models.Model):
    """
    Records earned leave encashment processed for an employee.
    The current flow auto-approves encashment once all policy checks pass.
    """
    STATUS_CHOICES = [
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='leave_encashments',
    )
    leave_balance = models.ForeignKey(
        EmployeeLeaveBalance,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='encashments',
    )
    leave_year = models.PositiveSmallIntegerField(
        help_text='Leave cycle start year against which the encashment was processed.',
    )
    requested_days = models.DecimalField(max_digits=5, decimal_places=1)
    encashed_days = models.DecimalField(max_digits=5, decimal_places=1)
    basic_salary_snapshot = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    encash_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='APPROVED')
    remarks = models.TextField(blank=True, default='')
    processed_by = models.ForeignKey(
        'authentication.AdminUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='processed_leave_encashments',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'leave_encashments'
        verbose_name = 'Leave Encashment'
        verbose_name_plural = 'Leave Encashments'
        ordering = ['-processed_at']

    def __str__(self):
        return f"{self.employee.employee_id} | EL Encashment | {self.encashed_days} days"
