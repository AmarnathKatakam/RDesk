from django.contrib import admin
from .models import (
    SalaryComponent, SalaryTemplate, SalaryTemplateComponent, EmployeeSalaryAssignment,
    StatutoryConfig, ProfessionalTaxSlab,
    TaxRegimeConfig, TaxSlab, EmployeeYTDRecord,
    Form16PartA, Form16PartB, TaxAuditLog,
)


class SalaryTemplateComponentInline(admin.TabularInline):
    model = SalaryTemplateComponent
    extra = 0
    fields = ('component', 'calculation_type_override', 'value', 'formula_override', 'display_order')
    autocomplete_fields = ['component']
    ordering = ['display_order']


@admin.register(SalaryComponent)
class SalaryComponentAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'component_type', 'calculation_type', 'default_value', 'is_statutory', 'is_active', 'display_order')
    list_filter = ('component_type', 'calculation_type', 'is_statutory', 'is_active', 'is_taxable')
    search_fields = ('code', 'name')
    ordering = ('display_order', 'name')
    readonly_fields = ('code',)  # code is used in formulas — prevent accidental rename
    fieldsets = (
        ('Identity', {
            'fields': ('code', 'name', 'description'),
        }),
        ('Classification', {
            'fields': ('component_type', 'calculation_type', 'default_value', 'formula'),
        }),
        ('Payslip Flags', {
            'fields': ('is_taxable', 'affects_gross', 'affects_net', 'affects_ctc'),
        }),
        ('Statutory Flags', {
            'fields': ('is_pf_applicable', 'is_esi_applicable', 'is_statutory'),
        }),
        ('Behaviour', {
            'fields': ('is_recurring', 'is_active', 'display_order'),
        }),
    )


@admin.register(SalaryTemplate)
class SalaryTemplateAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('code', 'name')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [SalaryTemplateComponentInline]
    fieldsets = (
        (None, {
            'fields': ('code', 'name', 'description', 'is_active'),
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )


@admin.register(EmployeeSalaryAssignment)
class EmployeeSalaryAssignmentAdmin(admin.ModelAdmin):
    list_display = ('employee', 'template', 'annual_ctc', 'effective_from', 'effective_to', 'is_active')
    list_filter = ('is_active', 'template')
    search_fields = ('employee__name', 'employee__employee_id', 'template__code')
    readonly_fields = ('created_at', 'updated_at')
    raw_id_fields = ('employee',)
    fieldsets = (
        ('Assignment', {
            'fields': ('employee', 'template', 'annual_ctc'),
        }),
        ('Effective Dates', {
            'fields': ('effective_from', 'effective_to', 'is_active'),
        }),
        ('Notes & Metadata', {
            'fields': ('notes', 'created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )


class ProfessionalTaxSlabInline(admin.TabularInline):
    model = ProfessionalTaxSlab
    extra = 0
    fields = ('min_monthly_wage', 'max_monthly_wage', 'pt_amount', 'applicable_months', 'gender', 'display_order', 'is_active')
    ordering = ['display_order', 'min_monthly_wage']


@admin.register(StatutoryConfig)
class StatutoryConfigAdmin(admin.ModelAdmin):
    list_display = (
        'financial_year', 'state', 'is_active',
        'pf_enabled', 'pf_wage_ceiling',
        'esi_enabled', 'esi_wage_threshold',
        'pt_enabled', 'lwf_enabled',
        'effective_from', 'effective_to',
    )
    list_filter = ('financial_year', 'state', 'is_active', 'pf_enabled', 'esi_enabled', 'pt_enabled')
    search_fields = ('state', 'financial_year', 'notes')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [ProfessionalTaxSlabInline]
    fieldsets = (
        ('Scope', {
            'fields': ('financial_year', 'state', 'is_active', 'effective_from', 'effective_to'),
        }),
        ('PF Settings', {
            'fields': (
                'pf_enabled', 'pf_employee_rate', 'pf_employer_rate',
                'pf_wage_ceiling', 'pf_rounding', 'pf_include_employer_in_ctc',
            ),
        }),
        ('ESI Settings', {
            'fields': ('esi_enabled', 'esi_employee_rate', 'esi_employer_rate', 'esi_wage_threshold'),
        }),
        ('PT / LWF / TDS', {
            'fields': (
                'pt_enabled',
                'lwf_enabled', 'lwf_employee_amount', 'lwf_employer_amount', 'lwf_applicable_months',
                'tds_enabled',
            ),
        }),
        ('Notes & Metadata', {
            'fields': ('notes', 'created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )


@admin.register(ProfessionalTaxSlab)
class ProfessionalTaxSlabAdmin(admin.ModelAdmin):
    list_display = (
        'statutory_config', 'min_monthly_wage', 'max_monthly_wage',
        'pt_amount', 'applicable_months', 'gender', 'is_active', 'display_order',
    )
    list_filter = ('statutory_config__state', 'statutory_config__financial_year', 'is_active', 'gender')
    search_fields = ('statutory_config__state', 'statutory_config__financial_year')
    ordering = ['statutory_config', 'display_order', 'min_monthly_wage']


# ─── Phase C: TDS Admin ───────────────────────────────────────────────────────

class TaxSlabInline(admin.TabularInline):
    model = TaxSlab
    extra = 0
    fields = ('income_from', 'income_to', 'rate', 'display_order')
    ordering = ['display_order', 'income_from']


@admin.register(TaxRegimeConfig)
class TaxRegimeConfigAdmin(admin.ModelAdmin):
    list_display = ('financial_year', 'regime', 'standard_deduction', 'rebate_87a_limit', 'cess_rate', 'is_active')
    list_filter = ('financial_year', 'regime', 'is_active')
    search_fields = ('financial_year', 'notes')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [TaxSlabInline]


@admin.register(TaxSlab)
class TaxSlabAdmin(admin.ModelAdmin):
    list_display = ('regime_config', 'income_from', 'income_to', 'rate', 'display_order')
    list_filter = ('regime_config__financial_year', 'regime_config__regime')
    ordering = ['regime_config', 'display_order', 'income_from']


@admin.register(EmployeeYTDRecord)
class EmployeeYTDRecordAdmin(admin.ModelAdmin):
    list_display = (
        'employee', 'financial_year', 'month', 'year',
        'ytd_taxable_earnings', 'ytd_tds_deducted', 'monthly_tds',
    )
    list_filter = ('financial_year', 'year', 'month')
    search_fields = ('employee__name', 'employee__employee_id', 'financial_year')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ['-year', '-month', 'employee__name']


@admin.register(Form16PartA)
class Form16PartAAdmin(admin.ModelAdmin):
    list_display = ('employee', 'financial_year', 'employer_tan', 'total_tds_deducted', 'is_generated', 'generated_at')
    list_filter = ('financial_year', 'is_generated')
    search_fields = ('employee__name', 'employee__employee_id', 'employer_tan')
    readonly_fields = ('created_at', 'updated_at', 'generated_at')


@admin.register(Form16PartB)
class Form16PartBAdmin(admin.ModelAdmin):
    list_display = ('employee', 'financial_year', 'regime', 'taxable_income', 'tds_deducted', 'is_generated')
    list_filter = ('financial_year', 'regime', 'is_generated')
    search_fields = ('employee__name', 'employee__employee_id')
    readonly_fields = ('created_at', 'updated_at', 'generated_at')


@admin.register(TaxAuditLog)
class TaxAuditLogAdmin(admin.ModelAdmin):
    list_display = ('employee', 'action', 'financial_year', 'field_changed', 'performed_by', 'timestamp')
    list_filter = ('action', 'financial_year')
    search_fields = ('employee__name', 'employee__employee_id')
    readonly_fields = ('timestamp',)
