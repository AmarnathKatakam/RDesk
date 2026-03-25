"""
URL configuration for RDesk Payslip project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from authentication import hrms_views

urlpatterns = [
    path("admin/", admin.site.urls),
    
    # API URLs
    path("api/dashboard/", hrms_views.dashboard_overview, name="dashboard-overview"),
    path("api/dashboard/activity/", hrms_views.dashboard_activity, name="dashboard-activity"),
    path("api/employees/count/", hrms_views.dashboard_employee_count, name="dashboard-employee-count"),
    path("api/employees/summary/", hrms_views.dashboard_employee_summary, name="dashboard-employee-summary"),
    path("api/payroll/month-summary/", hrms_views.dashboard_payroll_month_summary, name="dashboard-payroll-month-summary"),
    path("api/leaves/pending-count/", hrms_views.dashboard_leave_pending_count, name="dashboard-leave-pending-count"),
    path("api/leaves/overview/", hrms_views.dashboard_leave_overview, name="dashboard-leave-overview"),
    path("api/attendance/today-summary/", hrms_views.dashboard_attendance_today_summary, name="dashboard-attendance-today-summary"),
    path("api/auth/", include("authentication.urls")),
    path("api/departments/", include("departments.urls")),
    path("api/employees/", include("employees.urls")),
    path("api/", include("attendance.urls")),
    path("api/", include("payslip_generation.urls")),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
