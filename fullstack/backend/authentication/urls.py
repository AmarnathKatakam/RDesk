from django.urls import path
from . import views
from . import employee_views
from . import hrms_views

app_name = 'authentication'

urlpatterns = [
    # Admin endpoints
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('profile/', views.profile_view, name='profile'),
    path('profile/update/', views.update_profile_view, name='update_profile'),
    path('change-password/', views.change_password_view, name='change_password'),
    
    # Employee endpoints
    path('employee/login/', employee_views.employee_login_view, name='employee_login'),
    path('employee/activate/', employee_views.activate_account_view, name='activate_account'),
    path('employee/onboarding/', employee_views.complete_onboarding_view, name='complete_onboarding'),
    path('employee/profile/', employee_views.employee_profile_view, name='employee_profile'),
    path('employee/profile/update/', employee_views.update_employee_profile_view, name='update_employee_profile'),
    path('employee/payslips/', employee_views.employee_payslips_view, name='employee_payslips'),
    path('employee/sign-in/', employee_views.sign_in_view, name='sign_in'),
    path('employee/sign-out/', employee_views.sign_out_view, name='sign_out'),
    path('employee/attendance/', employee_views.attendance_history_view, name='attendance_history'),
    path('employee/dashboard/', employee_views.employee_dashboard_view, name='employee_dashboard'),


    
    # Admin invitation and payslip endpoints
    path('employee/send-invitation/', employee_views.send_invitation_view, name='send_invitation'),
    path('employee/release-payslip/', employee_views.release_payslip_view, name='release_payslip'),
    path('employee/bulk-release-payslips/', employee_views.bulk_release_payslips_view, name='bulk_release_payslips'),
    
    # HRMS - Leave Management
    path('leave/apply/', hrms_views.apply_leave, name='apply_leave'),
    path('leave/my-requests/', hrms_views.get_my_leave_requests, name='get_my_leave_requests'),
    path('leave/types/', hrms_views.get_leave_types, name='get_leave_types'),
    path('admin/leave/approve/', hrms_views.admin_approve_leave, name='admin_approve_leave'),
    path('admin/leave/reject/', hrms_views.admin_reject_leave, name='admin_reject_leave'),
    path('admin/leave/pending/', hrms_views.admin_get_pending_leaves, name='admin_get_pending_leaves'),
    
    # HRMS - Document Vault
    path('documents/upload/', hrms_views.upload_document, name='upload_document'),
    path('documents/my-documents/', hrms_views.get_my_documents, name='get_my_documents'),
    path('documents/<int:doc_id>/delete/', hrms_views.delete_document, name='delete_document'),
    path('documents/<int:doc_id>/download/', hrms_views.download_document, name='download_document'),
    
    # HRMS - Notifications
    path('notifications/', hrms_views.get_notifications, name='get_notifications'),
    path('notifications/unread-count/', hrms_views.get_unread_notification_count, name='unread_count'),
    path('notifications/<int:notif_id>/read/', hrms_views.mark_notification_as_read, name='mark_notif_read'),
    path('notifications/read-all/', hrms_views.mark_all_notifications_as_read, name='mark_all_notif_read'),
    
    # HRMS - Employee Directory
    path('directory/', hrms_views.get_employee_directory, name='employee_directory'),
    path('directory/<int:emp_id>/', hrms_views.get_employee_profile_for_directory, name='employee_profile_directory'),
    
    # HRMS - CEO Dashboard
    path('admin/dashboard/stats/', hrms_views.get_dashboard_stats, name='dashboard_stats'),
    path('admin/dashboard/attendance-graph/', hrms_views.get_attendance_graph_data, name='attendance_graph'),
    path('admin/dashboard/leave-stats/', hrms_views.get_leave_stats, name='leave_stats'),
    path('admin/dashboard/payroll-distribution/', hrms_views.get_department_payroll_distribution, name='payroll_distribution'),
]
