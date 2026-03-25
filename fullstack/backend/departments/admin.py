from django.contrib import admin
from .models import Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    """
    Admin configuration for Department model.
    """
    list_display = ('department_code', 'department_name', 'is_active', 'employee_count', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('department_code', 'department_name')
    ordering = ('department_name',)
    
    fieldsets = (
        (None, {'fields': ('department_code', 'department_name', 'description')}),
        ('Status', {'fields': ('is_active',)}),
    )
    
    readonly_fields = ('created_at', 'updated_at')
    
    def employee_count(self, obj):
        return obj.employee_count
    employee_count.short_description = 'Employee Count'