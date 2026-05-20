from django.contrib import admin
from .models import (
    Employee,
    SalaryStructure,
    EmployeeTaxProfile,
    TaxDeclaration,
    LeavePolicy,
    EmployeeLeaveBalance,
    LeaveEncashment,
)


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    """
    Admin configuration for Employee model.
    """
    list_display = ('employee_id', 'name', 'position', 'department', 'email', 'pay_mode', 'is_active', 'created_at')
    list_filter = ('department', 'pay_mode', 'is_active', 'created_at')
    search_fields = ('employee_id', 'name', 'position', 'pan', 'email')
    ordering = ('name',)
    
    fieldsets = (
        ('Basic Information', {'fields': ('employee_id', 'name', 'position', 'department')}),
        ('Personal Information', {'fields': ('dob', 'doj')}),
        ('Financial Information', {'fields': ('pan', 'pf_number', 'bank_account', 'bank_ifsc', 'pay_mode')}),
        ('Additional Information', {'fields': ('location', 'health_card_no', 'email')}),
        ('Status', {'fields': ('is_active',)}),
    )
    
    readonly_fields = ('created_at', 'updated_at')


@admin.register(SalaryStructure)
class SalaryStructureAdmin(admin.ModelAdmin):
    """
    Admin configuration for SalaryStructure model.
    """
    list_display = ('employee', 'salary_type', 'annual_ctc', 'monthly_salary', 'is_active', 'effective_from')
    list_filter = ('salary_type', 'is_active', 'effective_from')
    search_fields = ('employee__name', 'employee__employee_id')
    ordering = ('-effective_from',)
    
    fieldsets = (
        (None, {'fields': ('employee', 'salary_type', 'annual_ctc', 'effective_from')}),
        ('Status', {'fields': ('is_active',)}),
    )
    
    readonly_fields = ('created_at', 'updated_at')


from .models import MonthlySalaryData, PayrollInputAdjustment


@admin.register(MonthlySalaryData)
class MonthlySalaryDataAdmin(admin.ModelAdmin):
    list_display = ('employee', 'month', 'year', 'salary_type', 'source', 'net_pay', 'uploaded_at')
    list_filter = ('month', 'year', 'salary_type', 'source')
    search_fields = ('employee__name', 'employee__employee_id')
    ordering = ('-year', '-month')
    readonly_fields = ('uploaded_at', 'updated_at')


@admin.register(PayrollInputAdjustment)
class PayrollInputAdjustmentAdmin(admin.ModelAdmin):
    list_display = ('employee', 'month', 'year', 'salary_type', 'adjustment_type', 'label', 'amount', 'is_active', 'created_at')
    list_filter = ('month', 'year', 'salary_type', 'adjustment_type', 'is_active')
    search_fields = ('employee__name', 'employee__employee_id', 'label')
    ordering = ('-year', '-month', 'employee__name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(EmployeeTaxProfile)
class EmployeeTaxProfileAdmin(admin.ModelAdmin):
    list_display = ('employee', 'regime', 'is_tds_exempt', 'tds_override', 'updated_at')
    list_filter = ('regime', 'is_tds_exempt')
    search_fields = ('employee__name', 'employee__employee_id')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(TaxDeclaration)
class TaxDeclarationAdmin(admin.ModelAdmin):
    list_display = ('employee', 'financial_year', 'status', 'total_80c', 'total_80d', 'submitted_at', 'reviewed_at')
    list_filter = ('financial_year', 'status', 'city_type')
    search_fields = ('employee__name', 'employee__employee_id', 'financial_year')
    readonly_fields = ('created_at', 'updated_at', 'submitted_at', 'reviewed_at', 'total_80c', 'total_80d', 'total_declared_deductions')
    fieldsets = (
        ('Employee & Status', {'fields': ('employee', 'financial_year', 'status', 'submitted_at')}),
        ('Section 80C', {'fields': ('lic_premium', 'elss_investment', 'ppf_investment', 'nsc_investment', 'home_loan_principal', 'tuition_fees', 'other_80c', 'total_80c')}),
        ('Section 80D', {'fields': ('medical_insurance_self', 'medical_insurance_parents', 'total_80d')}),
        ('HRA Details', {'fields': ('rent_paid_monthly', 'landlord_name', 'landlord_pan', 'city_type')}),
        ('Other Deductions', {'fields': ('education_loan_interest', 'donations_80g', 'nps_additional', 'home_loan_interest', 'total_declared_deductions')}),
        ('Admin Review', {'fields': ('reviewed_by', 'reviewed_at', 'admin_remarks', 'proof_documents')}),
    )


@admin.register(LeavePolicy)
class LeavePolicyAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'earned_leave_per_year',
        'casual_leave_per_year',
        'sick_leave_per_year',
        'el_carry_forward_limit',
        'el_encashment_limit',
        'accrual_enabled',
        'accrual_rate_per_month',
        'is_active',
    )
    list_filter = ('is_active', 'accrual_enabled')
    search_fields = ('name',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(EmployeeLeaveBalance)
class EmployeeLeaveBalanceAdmin(admin.ModelAdmin):
    list_display = (
        'employee',
        'leave_type',
        'year',
        'opening_balance',
        'allocated',
        'used',
        'encashed',
        'remaining',
        'last_accrual_processed_on',
    )
    list_filter = ('year', 'leave_type')
    search_fields = ('employee__name', 'employee__employee_id', 'leave_type__name')
    readonly_fields = ('created_at', 'updated_at', 'remaining')


@admin.register(LeaveEncashment)
class LeaveEncashmentAdmin(admin.ModelAdmin):
    list_display = (
        'employee',
        'leave_year',
        'requested_days',
        'encashed_days',
        'encash_amount',
        'status',
        'processed_at',
    )
    list_filter = ('status', 'leave_year')
    search_fields = ('employee__name', 'employee__employee_id')
    readonly_fields = ('created_at', 'processed_at')
