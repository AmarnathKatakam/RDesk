from django.contrib import admin
from .models import Payslip, PayslipGenerationTask


@admin.register(Payslip)
class PayslipAdmin(admin.ModelAdmin):
    """
    Admin configuration for Payslip model.
    """
    list_display = ('employee', 'pay_period_month', 'pay_period_year', 'salary_type', 'net_pay', 'generated_at')
    list_filter = ('pay_period_year', 'pay_period_month', 'salary_type', 'generated_at')
    search_fields = ('employee__name', 'employee__employee_id')
    ordering = ('-generated_at',)
    
    fieldsets = (
        ('Employee & Period', {'fields': ('employee', 'pay_period_month', 'pay_period_year', 'salary_type')}),
        ('Work Days', {'fields': ('work_days', 'days_in_month', 'lop_days')}),
        ('Earnings', {'fields': ('basic', 'hra', 'da', 'conveyance', 'medical', 'special_allowance', 'pf_employee', 'total_earnings')}),
        ('Deductions', {'fields': ('professional_tax', 'pf_employer', 'other_deductions', 'salary_advance', 'total_deductions')}),
        ('Net Pay', {'fields': ('net_pay',)}),
        ('File Information', {'fields': ('pdf_path', 'qr_code_data')}),
        ('Metadata', {'fields': ('generated_by', 'generated_at')}),
    )
    
    readonly_fields = ('generated_at',)


@admin.register(PayslipGenerationTask)
class PayslipGenerationTaskAdmin(admin.ModelAdmin):
    """
    Admin configuration for PayslipGenerationTask model.
    """
    list_display = ('task_id', 'status', 'pay_period_month', 'pay_period_year', 'total_employees', 'completed_employees', 'started_at')
    list_filter = ('status', 'pay_period_year', 'pay_period_month', 'salary_type', 'started_at')
    search_fields = ('task_id', 'created_by__username')
    ordering = ('-started_at',)
    
    fieldsets = (
        ('Task Information', {'fields': ('task_id', 'status', 'created_by')}),
        ('Parameters', {'fields': ('pay_period_month', 'pay_period_year', 'salary_type', 'employee_ids')}),
        ('Progress', {'fields': ('total_employees', 'completed_employees', 'failed_employees', 'current_batch', 'total_batches', 'batch_size')}),
        ('Errors', {'fields': ('errors',)}),
        ('Timestamps', {'fields': ('started_at', 'completed_at')}),
    )
    
    readonly_fields = ('task_id', 'started_at', 'completed_at')