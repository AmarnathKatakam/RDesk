from django.db import models
from django.contrib.auth import get_user_model
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
    
    # Salary Components
    basic = models.DecimalField(max_digits=10, decimal_places=2)
    hra = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='House Rent Allowance')
    da = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Dearness Allowance')
    conveyance = models.DecimalField(max_digits=10, decimal_places=2)
    medical = models.DecimalField(max_digits=10, decimal_places=2)
    special_allowance = models.DecimalField(max_digits=10, decimal_places=2)
    pf_employee = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='PF Employee')
    
    # Totals
    total_earnings = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Deductions
    professional_tax = models.DecimalField(max_digits=10, decimal_places=2)
    pf_employer = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='PF Employer')
    other_deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    salary_advance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Final Calculations
    total_deductions = models.DecimalField(max_digits=10, decimal_places=2)
    net_pay = models.DecimalField(max_digits=10, decimal_places=2)
    
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
        """Generate filename for the payslip PDF."""
        clean_name = self.employee.name.lower().replace(' ', '_')
        return f"payslip_{clean_name}_{self.pay_period_month.lower()}.pdf"

    @property
    def file_path(self):
        """Generate full file path for the payslip PDF."""
        return f"payslips/{self.pay_period_year}/{self.pay_period_month}/{self.filename}"


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
    employee_ids = models.JSONField()  # List of employee IDs
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
        
        # Estimate time remaining based on current progress
        elapsed_time = (self.completed_at or models.functions.Now()) - self.started_at
        if self.completed_employees > 0:
            avg_time_per_employee = elapsed_time.total_seconds() / self.completed_employees
            remaining_employees = self.total_employees - self.completed_employees
            return int((remaining_employees * avg_time_per_employee) / 60)  # in minutes
        
        return 0