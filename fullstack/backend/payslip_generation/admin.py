from django.contrib import admin
from .models import (
    Payslip, PayslipGenerationTask, PayrollAuditLog, PayrollValidationIssue,
    PayrollRun, PayrollRunItem, PayrollRunItemLine,
)


@admin.register(Payslip)
class PayslipAdmin(admin.ModelAdmin):
    """
    Admin configuration for Payslip model.
    """
    list_display = ('employee', 'pay_period_month', 'pay_period_year', 'salary_type', 'net_pay', 'is_released', 'generated_at')
    list_filter = ('pay_period_year', 'pay_period_month', 'salary_type', 'is_released', 'generated_at')
    search_fields = ('employee__name', 'employee__employee_id')
    ordering = ('-generated_at',)
    
    fieldsets = (
        ('Employee & Period', {'fields': ('employee', 'pay_period_month', 'pay_period_year', 'salary_type')}),
        ('Work Days', {'fields': ('work_days', 'days_in_month', 'lop_days')}),
        ('Earnings', {'fields': ('basic', 'hra', 'da', 'conveyance', 'medical', 'special_allowance', 'pf_employee', 'total_earnings')}),
        ('Deductions', {'fields': ('professional_tax', 'pf_employer', 'other_deductions', 'salary_advance', 'total_deductions')}),
        ('Net Pay', {'fields': ('net_pay',)}),
        ('Release Information', {'fields': ('is_released', 'released_at', 'released_by')}),
        ('File Information', {'fields': ('pdf_path', 'qr_code_data')}),
        ('Metadata', {'fields': ('generated_by', 'generated_at')}),
    )
    
    readonly_fields = ('generated_at', 'released_at')


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


@admin.register(PayrollAuditLog)
class PayrollAuditLogAdmin(admin.ModelAdmin):
    """
    Admin configuration for PayrollAuditLog model.
    Immutable audit trail - no edit/delete allowed.
    """
    list_display = ('timestamp', 'action', 'performed_by', 'employee', 'pay_period_month', 'pay_period_year')
    list_filter = ('action', 'pay_period_year', 'pay_period_month', 'timestamp')
    search_fields = ('performed_by__username', 'employee__name', 'employee__employee_id', 'notes')
    ordering = ('-timestamp',)
    date_hierarchy = 'timestamp'
    
    fieldsets = (
        ('Action', {'fields': ('action', 'performed_by', 'timestamp')}),
        ('Target', {'fields': ('payslip', 'employee', 'pay_period_month', 'pay_period_year')}),
        ('Details', {'fields': ('notes',)}),
    )
    
    readonly_fields = ('action', 'performed_by', 'payslip', 'employee', 'pay_period_month', 'pay_period_year', 'notes', 'timestamp')
    
    def has_add_permission(self, request):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False


@admin.register(PayrollValidationIssue)
class PayrollValidationIssueAdmin(admin.ModelAdmin):
    """
    Admin configuration for PayrollValidationIssue model.
    """
    list_display = ('employee', 'issue_type', 'severity', 'pay_period_month', 'pay_period_year', 'resolved', 'created_at')
    list_filter = ('severity', 'issue_type', 'resolved', 'pay_period_year', 'pay_period_month', 'created_at')
    search_fields = ('employee__name', 'employee__employee_id', 'message')
    ordering = ('-created_at', 'severity')
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Issue Details', {'fields': ('employee', 'issue_type', 'severity', 'message')}),
        ('Period', {'fields': ('pay_period_month', 'pay_period_year')}),
        ('Status', {'fields': ('resolved', 'generation_task')}),
        ('Metadata', {'fields': ('created_at',)}),
    )
    
    readonly_fields = ('created_at',)
    
    actions = ['mark_as_resolved', 'mark_as_unresolved']
    
    def mark_as_resolved(self, request, queryset):
        updated = queryset.update(resolved=True)
        self.message_user(request, f'{updated} issue(s) marked as resolved.')
    mark_as_resolved.short_description = 'Mark selected issues as resolved'
    
    def mark_as_unresolved(self, request, queryset):
        updated = queryset.update(resolved=False)
        self.message_user(request, f'{updated} issue(s) marked as unresolved.')
    mark_as_unresolved.short_description = 'Mark selected issues as unresolved'


@admin.register(PayrollRun)
class PayrollRunAdmin(admin.ModelAdmin):
    list_display = ('id', 'month', 'year', 'salary_type', 'status', 'total_employees', 'total_net', 'created_by', 'created_at')
    list_filter = ('status', 'salary_type', 'year', 'month')
    search_fields = ('month', 'notes', 'created_by__username')
    ordering = ('-year', '-month')
    readonly_fields = ('created_at', 'approved_at', 'locked_at', 'released_at', 'completed_at')

    fieldsets = (
        ('Period', {'fields': ('month', 'year', 'salary_type', 'status')}),
        ('Totals', {'fields': ('total_employees', 'total_gross', 'total_deductions', 'total_net')}),
        ('Lifecycle', {'fields': ('created_by', 'approved_by', 'released_by', 'created_at', 'approved_at', 'locked_at', 'released_at', 'completed_at')}),
        ('Notes', {'fields': ('notes', 'reopen_reason')}),
    )


@admin.register(PayrollRunItem)
class PayrollRunItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'run', 'employee', 'status', 'calculation_source', 'gross_earnings', 'total_deductions', 'employer_contributions', 'net_pay', 'calculated_at')
    list_filter = ('status', 'calculation_source', 'run__month', 'run__year')
    search_fields = ('employee__name', 'employee__employee_id')
    ordering = ('run', 'employee__name')
    readonly_fields = ('calculated_at', 'updated_at')

    fieldsets = (
        ('Run & Employee', {'fields': ('run', 'employee', 'status')}),
        ('Salary Snapshot', {'fields': ('gross_earnings', 'total_deductions', 'employer_contributions', 'net_pay')}),
        ('Attendance / Proration', {'fields': ('lop_days', 'work_days', 'payable_days', 'days_in_month', 'proration_factor')}),
        ('Calculation', {'fields': ('calculation_source', 'calculation_notes', 'salary_assignment')}),
        ('References', {'fields': ('salary_data', 'payslip')}),
        ('Hold / Error', {'fields': ('hold_reason', 'error_message')}),
        ('Timestamps', {'fields': ('calculated_at', 'updated_at')}),
    )


class PayrollRunItemLineInline(admin.TabularInline):
    model = PayrollRunItemLine
    extra = 0
    readonly_fields = ('code', 'name', 'component_type', 'calculation_type', 'rate', 'amount', 'is_statutory', 'affects_gross', 'affects_net_pay')
    fields = ('code', 'name', 'component_type', 'calculation_type', 'rate', 'amount', 'is_statutory', 'affects_gross', 'affects_net_pay', 'display_order')
    ordering = ('display_order', 'component_type', 'code')
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(PayrollRunItemLine)
class PayrollRunItemLineAdmin(admin.ModelAdmin):
    list_display = ('id', 'run_item', 'code', 'name', 'component_type', 'calculation_type', 'amount', 'is_statutory')
    list_filter = ('component_type', 'is_statutory', 'calculation_type')
    search_fields = ('code', 'name', 'run_item__employee__name')
    ordering = ('run_item', 'display_order', 'code')
    readonly_fields = ('run_item', 'component', 'code', 'name', 'component_type', 'calculation_type', 'rate', 'amount', 'is_statutory', 'is_taxable', 'affects_gross', 'affects_net_pay', 'affects_ctc', 'display_order')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
