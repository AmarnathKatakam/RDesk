"""
RothDesk HRMS - Main URL Configuration
========================================
All API routes are prefixed with /api/.
Each Django app owns its own urls.py; this file just wires them together.

Route groups:
  /api/auth/           → authentication app  (login, logout, profile)
  /api/departments/    → departments app      (department CRUD)
  /api/employees/      → employees app        (employee CRUD, salary, letters)
  /api/attendance/     → attendance app       (punch-in/out, shifts, holidays)
  /api/payslips/       → payslip_generation   (generate, download, email)
  /api/payroll-config/ → payroll_config       (components, templates, statutory)
  /api/tax/            → payroll_config       (tax calculation endpoints)
  /api/finance/        → employee_finance     (bank, ESI, PF details)
  /api/leave/          → hrms_views           (employee leave actions)
  /api/hrms/           → hrms_views           (alias routes for frontend)
  /api/dashboard/      → hrms_views           (dashboard summary stats)
  /admin/              → Django admin panel
"""

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from authentication import hrms_views

urlpatterns = [

    # -------------------------------------------------------------------------
    # Django Admin Panel
    # -------------------------------------------------------------------------
    path("admin/", admin.site.urls),

    # -------------------------------------------------------------------------
    # Dashboard — summary stats shown on the admin home screen
    # -------------------------------------------------------------------------
    path("api/dashboard/",                          hrms_views.dashboard_overview,                  name="dashboard-overview"),
    path("api/dashboard/activity/",                 hrms_views.dashboard_activity,                  name="dashboard-activity"),
    path("api/employees/count/",                    hrms_views.dashboard_employee_count,             name="dashboard-employee-count"),
    path("api/employees/summary/",                  hrms_views.dashboard_employee_summary,           name="dashboard-employee-summary"),
    path("api/payroll/month-summary/",              hrms_views.dashboard_payroll_month_summary,      name="dashboard-payroll-month-summary"),
    path("api/leaves/pending-count/",               hrms_views.dashboard_leave_pending_count,        name="dashboard-leave-pending-count"),
    path("api/leaves/overview/",                    hrms_views.dashboard_leave_overview,             name="dashboard-leave-overview"),
    path("api/attendance/today-summary/",           hrms_views.dashboard_attendance_today_summary,   name="dashboard-attendance-today-summary"),

    # -------------------------------------------------------------------------
    # App-level URL includes — each app manages its own endpoint list
    # -------------------------------------------------------------------------
    path("api/auth/",           include("authentication.urls")),    # login, logout, profile, password
    path("api/departments/",    include("departments.urls")),        # department CRUD
    path("api/employees/",      include("employees.urls")),          # employee CRUD, salary, org, letters
    path("api/",                include("attendance.urls")),         # attendance (app uses full paths internally)
    path("api/",                include("payslip_generation.urls")), # payslips (app uses full paths internally)
    path("api/finance/",        include("employee_finance.urls")),   # bank, ESI, PF
    path("api/payroll-config/", include("payroll_config.urls")),     # salary components, templates, assignments
    path("api/tax/",            include("payroll_config.tax_urls")), # tax calculation & TDS preview

    # -------------------------------------------------------------------------
    # Leave — canonical routes used by the employee portal
    # -------------------------------------------------------------------------
    path("api/leave/balance/",                                  hrms_views.get_leave_balance,           name="leave-balance"),
    path("api/leave/apply/",                                    hrms_views.apply_leave,                 name="leave-apply"),
    path("api/leave/my-requests/",                              hrms_views.get_my_leave_requests,       name="leave-my-requests"),
    path("api/leave/encash/",                                   hrms_views.leave_encash,                name="leave-encash"),
    path("api/leave/approve/",                                  hrms_views.admin_approve_leave,         name="leave-approve"),
    path("api/leave/reject/",                                   hrms_views.admin_reject_leave,          name="leave-reject"),
    path("api/admin/leave/all/",                                hrms_views.admin_get_all_leaves,        name="admin-leave-all"),
    path("api/admin/leave/<int:leave_request_id>/approve/",     hrms_views.admin_approve_leave,         name="admin-leave-approve"),
    path("api/admin/leave/<int:leave_request_id>/reject/",      hrms_views.admin_reject_leave,          name="admin-leave-reject"),

    # -------------------------------------------------------------------------
    # HRMS alias routes — /api/hrms/... mirrors the canonical routes above.
    # The frontend uses these for notifications, documents, and leave actions.
    # -------------------------------------------------------------------------

    # Notifications
    path("api/hrms/notifications/",                             hrms_views.get_notifications,               name="hrms-notifications"),
    path("api/hrms/notifications/unread-count/",                hrms_views.get_unread_notification_count,   name="hrms-notifications-unread"),
    path("api/hrms/notifications/read/",                        hrms_views.mark_all_notifications_as_read,  name="hrms-notifications-read-all"),
    path("api/hrms/notifications/<int:notif_id>/read/",         hrms_views.mark_notification_as_read,       name="hrms-notifications-read"),

    # Documents
    path("api/hrms/documents/",                                 hrms_views.get_documents,       name="hrms-documents"),
    path("api/hrms/documents/upload/",                          hrms_views.upload_document,     name="hrms-documents-upload"),
    path("api/hrms/documents/<int:doc_id>/",                    hrms_views.delete_document,     name="hrms-documents-delete"),
    path("api/hrms/documents/<int:doc_id>/download/",           hrms_views.download_document,   name="hrms-documents-download"),

    # Leave (HRMS alias)
    path("api/hrms/leaves/",                                    hrms_views.get_my_leave_requests,       name="hrms-leaves"),
    path("api/hrms/leaves/balance/",                            hrms_views.get_leave_balance,           name="hrms-leaves-balance"),
    path("api/hrms/leaves/types/",                              hrms_views.get_leave_types,             name="hrms-leave-types"),
    path("api/hrms/leaves/apply/",                              hrms_views.apply_leave,                 name="hrms-leave-apply"),
    path("api/hrms/leaves/encash/",                             hrms_views.leave_encash,                name="hrms-leave-encash"),
    path("api/hrms/leaves/all/",                                hrms_views.admin_get_all_leaves,        name="hrms-leaves-all"),
    path("api/hrms/leaves/pending/",                            hrms_views.admin_get_pending_leaves,    name="hrms-leaves-pending"),
    path("api/hrms/leaves/approve/",                            hrms_views.admin_approve_leave,         name="hrms-leaves-approve"),
    path("api/hrms/leaves/reject/",                             hrms_views.admin_reject_leave,          name="hrms-leaves-reject"),
    path("api/hrms/leaves/<int:leave_request_id>/approve/",     hrms_views.admin_approve_leave,         name="hrms-leaves-approve-by-id"),
    path("api/hrms/leaves/<int:leave_request_id>/reject/",      hrms_views.admin_reject_leave,          name="hrms-leaves-reject-by-id"),
]

# ---------------------------------------------------------------------------
# Payslip Media Protection
# ---------------------------------------------------------------------------
# Payslip PDFs must NEVER be served directly from /media/payslips/.
# All access goes through /api/payslips/<id>/download/ which enforces
# ownership checks and the "released" gate before streaming the file.

def _block_direct_payslip_access(request, path):
    """Reject any direct URL hit to /media/payslips/... in all environments."""
    from django.http import HttpResponseForbidden
    return HttpResponseForbidden(
        "Direct access to payslip files is not allowed. "
        "Use the authenticated download endpoint: /api/payslips/<id>/download/"
    )

# This rule must be registered BEFORE the general media handler below
urlpatterns += [
    re_path(r"^media/payslips/(?P<path>.*)$", _block_direct_payslip_access),
]

# ---------------------------------------------------------------------------
# Development Media & Static Serving
# ---------------------------------------------------------------------------
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL,  document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
