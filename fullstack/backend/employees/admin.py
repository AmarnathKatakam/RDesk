from django.contrib import admin
from .models import Employee, SalaryStructure


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