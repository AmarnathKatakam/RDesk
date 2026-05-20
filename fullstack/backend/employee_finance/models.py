from django.db import models
from employees.models import Employee, EmployeeDocument


# ─── Bank Master ──────────────────────────────────────────────────────────────

class BankMaster(models.Model):
    name = models.CharField(max_length=120, unique=True)
    code = models.CharField(max_length=20, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bank_master'
        ordering = ['name']

    def __str__(self):
        return self.name


class BankBranchMaster(models.Model):
    bank = models.ForeignKey(BankMaster, on_delete=models.CASCADE, related_name='branches')
    branch_name = models.CharField(max_length=120)
    ifsc_code = models.CharField(max_length=15)
    city = models.CharField(max_length=80, blank=True, null=True)
    state = models.CharField(max_length=80, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bank_branch_master'
        ordering = ['branch_name']
        unique_together = ['bank', 'ifsc_code']

    def __str__(self):
        return f"{self.branch_name} ({self.ifsc_code})"


# ─── Employee Bank Detail ─────────────────────────────────────────────────────

class EmployeeBankDetail(models.Model):
    ACCOUNT_TYPE_CHOICES = [
        ('SAVING', 'Saving'),
        ('CURRENT', 'Current'),
        ('FIXED', 'Fixed'),
        ('SALARIED', 'Salaried Account'),
    ]
    PAYMENT_TYPE_CHOICES = [
        ('NEFT', 'NEFT / Bank Transfer'),
        ('CASH', 'Cash'),
        ('CHEQUE', 'Cheque'),
        ('DD', 'Demand Draft'),
    ]

    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, related_name='bank_detail')
    bank = models.ForeignKey(BankMaster, on_delete=models.SET_NULL, null=True, blank=True)
    branch = models.ForeignKey(BankBranchMaster, on_delete=models.SET_NULL, null=True, blank=True)
    bank_account_no = models.CharField(max_length=30, blank=True, null=True)
    ifsc_code = models.CharField(max_length=15, blank=True, null=True)
    iban = models.CharField(max_length=34, blank=True, null=True)
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPE_CHOICES, blank=True, null=True)
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE_CHOICES, blank=True, null=True)
    dd_payable_at = models.CharField(max_length=100, blank=True, null=True)
    name_as_per_bank = models.CharField(max_length=120, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_bank_details'

    def __str__(self):
        return f"{self.employee.name} - Bank Detail"


# ─── Employee ESI Detail ──────────────────────────────────────────────────────

class EmployeeESIDetail(models.Model):
    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, related_name='esi_detail')
    is_covered = models.BooleanField(default=False)
    esi_number = models.CharField(max_length=30, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_esi_details'

    def __str__(self):
        return f"{self.employee.name} - ESI Detail"


# ─── Employee PF Detail ───────────────────────────────────────────────────────

class EmployeePFDetail(models.Model):
    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, related_name='pf_detail')
    is_covered = models.BooleanField(default=False)
    uan = models.CharField(max_length=20, blank=True, null=True)
    pf_number = models.CharField(max_length=30, blank=True, null=True)
    pf_join_date = models.DateField(null=True, blank=True)
    family_pf_no = models.CharField(max_length=30, blank=True, null=True)
    is_existing_eps_member = models.BooleanField(default=False)
    allow_epf_excess = models.BooleanField(default=False)
    allow_eps_excess = models.BooleanField(default=False)
    verification_document = models.ForeignKey(
        EmployeeDocument,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pf_verifications',
        help_text='Employee document used as PF verification proof',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_pf_details'

    def __str__(self):
        return f"{self.employee.name} - PF Detail"


# ─── Employee LWF Detail ──────────────────────────────────────────────────────

class EmployeeLWFDetail(models.Model):
    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, related_name='lwf_detail')
    is_covered = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_lwf_details'

    def __str__(self):
        return f"{self.employee.name} - LWF Detail"


# ─── Employee Family Member ───────────────────────────────────────────────────

class EmployeeFamilyMember(models.Model):
    RELATION_CHOICES = [
        ('FATHER',   'Father'),
        ('MOTHER',   'Mother'),
        ('SPOUSE',   'Spouse'),
        ('SON',      'Son'),
        ('DAUGHTER', 'Daughter'),
        ('BROTHER',  'Brother'),
        ('SISTER',   'Sister'),
        ('GUARDIAN', 'Guardian'),
        ('OTHER',    'Other'),
    ]
    GENDER_CHOICES = [
        ('MALE',   'Male'),
        ('FEMALE', 'Female'),
        ('OTHER',  'Other'),
    ]
    BLOOD_GROUP_CHOICES = [
        ('A+', 'A+'), ('A-', 'A-'),
        ('B+', 'B+'), ('B-', 'B-'),
        ('O+', 'O+'), ('O-', 'O-'),
        ('AB+', 'AB+'), ('AB-', 'AB-'),
    ]
    ADDRESS_SOURCE_CHOICES = [
        ('PRESENT',   'Present Address'),
        ('PERMANENT', 'Permanent Address'),
    ]

    employee    = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='family_members')
    name        = models.CharField(max_length=120)
    relation    = models.CharField(max_length=20, choices=RELATION_CHOICES)
    dob         = models.DateField(null=True, blank=True)
    gender      = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, null=True)
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUP_CHOICES, blank=True, null=True)
    nationality = models.CharField(max_length=60, blank=True, null=True)
    profession  = models.CharField(max_length=100, blank=True, null=True)
    remarks     = models.TextField(blank=True, null=True)

    # Address copy
    address_same_as_employee = models.BooleanField(default=False)
    copy_address_from        = models.CharField(max_length=20, choices=ADDRESS_SOURCE_CHOICES, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table  = 'employee_family_members'
        ordering  = ['relation', 'name']

    def __str__(self):
        return f"{self.employee.name} – {self.get_relation_display()} ({self.name})"
