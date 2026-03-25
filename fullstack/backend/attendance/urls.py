from django.urls import path

from . import views

app_name = "attendance"

urlpatterns = [
    # Core attendance APIs
    path("attendance/punch-in", views.punch_in, name="attendance-punch-in"),
    path("attendance/punch-out", views.punch_out, name="attendance-punch-out"),
    path("attendance/today", views.attendance_today, name="attendance-today"),
    path("attendance/monthly", views.attendance_monthly, name="attendance-monthly"),
    path("attendance/report", views.attendance_report, name="attendance-report"),
    path("attendance/dashboard", views.attendance_dashboard, name="attendance-dashboard"),
    path("attendance/payroll-data", views.payroll_attendance_data, name="attendance-payroll-data"),
    path("attendance/automation/mark-absent", views.run_absent_automation, name="attendance-auto-absent"),
    path("attendance/config-status", views.attendance_config_status, name="attendance-config-status"),

    # Admin configuration APIs
    path("shifts", views.shifts_collection, name="shifts-collection"),
    path("shifts/<int:shift_id>", views.shift_detail, name="shift-detail"),
    path("shifts/assign", views.shift_assignment_collection, name="shift-assign"),
    path("shifts/assignments", views.shift_assignment_collection, name="shift-assignments"),

    path("office-location", views.office_location_collection, name="office-location-collection"),
    path("office-location/<int:location_id>", views.office_location_detail, name="office-location-detail"),

    path("attendance/policies", views.attendance_policy_collection, name="attendance-policy-collection"),
    path("attendance/policies/<int:policy_id>", views.attendance_policy_detail, name="attendance-policy-detail"),

    path("attendance/holidays", views.holiday_collection, name="attendance-holiday-collection"),
    path("attendance/holidays/<int:holiday_id>", views.holiday_detail, name="attendance-holiday-detail"),
]
