from django.contrib import admin

from .models import (
    AttendanceAuditLog,
    AttendancePolicy,
    AttendanceRecord,
    EmployeeShiftAssignment,
    Holiday,
    HolidayCalendar,
    MonthlyAttendanceSummary,
    OfficeLocation,
    Shift,
)


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ("name", "start_time", "end_time", "late_after", "half_day_after", "overtime_allowed", "is_active")
    search_fields = ("name",)
    list_filter = ("is_active", "overtime_allowed")


@admin.register(OfficeLocation)
class OfficeLocationAdmin(admin.ModelAdmin):
    list_display = ("name", "latitude", "longitude", "allowed_radius_meters", "is_default", "is_active")
    search_fields = ("name",)
    list_filter = ("is_default", "is_active")


@admin.register(AttendancePolicy)
class AttendancePolicyAdmin(admin.ModelAdmin):
    list_display = ("name", "enforce_gps", "allow_remote_punch", "auto_mark_absent", "is_active")
    search_fields = ("name",)
    list_filter = ("enforce_gps", "allow_remote_punch", "auto_mark_absent", "is_active")


@admin.register(HolidayCalendar)
class HolidayCalendarAdmin(admin.ModelAdmin):
    list_display = ("name", "year", "state", "is_active", "created_at")
    search_fields = ("name",)
    list_filter = ("year", "state", "is_active")


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ("name", "date", "holiday_type", "calendar", "is_active")
    search_fields = ("name",)
    list_filter = ("holiday_type", "is_active", "date")


@admin.register(EmployeeShiftAssignment)
class EmployeeShiftAssignmentAdmin(admin.ModelAdmin):
    list_display = ("employee", "shift", "effective_from", "effective_to", "is_active")
    search_fields = ("employee__name", "employee__employee_id", "shift__name")
    list_filter = ("is_active", "shift")


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ("employee", "date", "status", "punch_in_time", "punch_out_time", "working_hours", "overtime_hours")
    search_fields = ("employee__name", "employee__employee_id")
    list_filter = ("status", "date")


@admin.register(AttendanceAuditLog)
class AttendanceAuditLogAdmin(admin.ModelAdmin):
    list_display = ("attendance", "actor_type", "action", "created_at")
    list_filter = ("actor_type", "action", "created_at")
    search_fields = ("attendance__employee__name", "attendance__employee__employee_id")


@admin.register(MonthlyAttendanceSummary)
class MonthlyAttendanceSummaryAdmin(admin.ModelAdmin):
    list_display = ("employee", "month", "year", "present_days", "late_days", "leave_days", "absent_days", "half_days")
    list_filter = ("month", "year")
    search_fields = ("employee__name", "employee__employee_id")
