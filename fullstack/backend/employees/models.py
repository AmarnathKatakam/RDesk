from django.db import models
from django.core.validators import RegexValidator, FileExtensionValidator
from django.utils import timezone
from departments.models import Department
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
    Model for storing monthly salary data uploaded via Excel.
    """
    employee = models.ForeignKey(
        Employee, 
        on_delete=models.CASCADE,
        related_name='monthly_salaries'
    )
    month = models.CharField(max_length=20)
    year = models.IntegerField()
    
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
    
    # Metadata
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        'authentication.AdminUser', 
        on_delete=models.CASCADE,
        related_name='uploaded_salaries'
    )
    
    class Meta:
        db_table = 'monthly_salary_data'
        verbose_name = 'Monthly Salary Data'
        verbose_name_plural = 'Monthly Salary Data'
        ordering = ['-year', '-month']
        unique_together = ['employee', 'month', 'year']

    def __str__(self):
        return f"{self.employee.name} - {self.month} {self.year}"

    @property
    def total_earnings(self):
        return self.basic + self.hra + self.da + self.conveyance + self.medical + self.special_allowance + self.pf_employee

    @property
    def total_deductions(self):
        return self.professional_tax + self.pf_employer + self.other_deductions + self.salary_advance

    @property
    def net_pay(self):
        return self.total_earnings - self.total_deductions


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
    """
    name = models.CharField(max_length=50, unique=True)
    max_days_per_year = models.IntegerField(default=10)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'leave_types'
        verbose_name = 'Leave Type'
        verbose_name_plural = 'Leave Types'

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
