from django.urls import path
from . import views
from . import payroll_views
from . import report_views

app_name = 'payslip_generation'

urlpatterns = [
    # ── Milestone 2: Payroll Run endpoints ────────────────────────────────────
    path('payroll/runs/', payroll_views.payroll_run_list, name='payroll-run-list'),
    path('payroll/monthly-inputs/process/', payroll_views.payroll_process_monthly_inputs, name='payroll-monthly-inputs-process'),
    path('payroll/runs/<int:run_id>/', payroll_views.payroll_run_detail, name='payroll-run-detail'),
    path('payroll/runs/<int:run_id>/calculate/', payroll_views.payroll_run_calculate, name='payroll-run-calculate'),
    path('payroll/runs/<int:run_id>/transition/', payroll_views.payroll_run_transition, name='payroll-run-transition'),
    path('payroll/runs/<int:run_id>/items/', payroll_views.payroll_run_items, name='payroll-run-items'),
    path('payroll/runs/<int:run_id>/items/breakdown/', payroll_views.payroll_run_items_with_lines, name='payroll-run-items-breakdown'),
    path('payroll/runs/<int:run_id>/items/<int:item_id>/lines/', payroll_views.payroll_run_item_lines, name='payroll-run-item-lines'),
    path('payroll/runs/<int:run_id>/hold/', payroll_views.payroll_run_hold, name='payroll-run-hold'),
    path('payroll/runs/<int:run_id>/release-hold/', payroll_views.payroll_run_release_hold, name='payroll-run-release-hold'),
    path('payroll/runs/<int:run_id>/reprocess/', payroll_views.payroll_run_reprocess, name='payroll-run-reprocess'),
    path('payroll/runs/<int:run_id>/summary/', payroll_views.payroll_run_summary, name='payroll-run-summary'),

    # ── Milestone 4: Payroll Reports ──────────────────────────────────────────
    path('payroll/reports/register/', report_views.payroll_register, name='payroll-register'),
    path('payroll/reports/register/export/', report_views.payroll_register_export, name='payroll-register-export'),
    path('payroll/reports/bank-transfer/', report_views.bank_transfer_report, name='bank-transfer-report'),
    path('payroll/reports/bank-transfer/export/', report_views.bank_transfer_export, name='bank-transfer-export'),
    path('payroll/reports/department-summary/', report_views.department_summary, name='department-summary'),
    path('payroll/reports/variance/', report_views.variance_report, name='variance-report'),

    # Payslip list / detail (admin)
    path('payslips/', views.PayslipListView.as_view(), name='payslip-list'),
    path('payslips/<int:pk>/', views.PayslipDetailView.as_view(), name='payslip-detail'),

    # Secure download (enforces is_released + ownership)
    path('payslips/<int:payslip_id>/download/', views.download_payslip, name='download-payslip'),

    # HTML preview for visual validation (admin only)
    path('payslips/<int:payslip_id>/preview/', views.payslip_html_preview, name='payslip-preview'),

    # Generation task status
    path('payslips/task/<str:task_id>/', views.get_generation_status, name='task-status'),

    # Bulk generation (with validation gate)
    path('payslips/generate/', views.bulk_generate_payslips, name='bulk-generate'),

    # Validate-only dry run
    path('payslips/validate/', views.validate_payroll, name='validate-payroll'),

    # File management
    path('payslips/download-monthly/<str:year>/<str:month>/', views.download_monthly_payslips, name='download-monthly'),
    path('payslips/files/<str:year>/<str:month>/', views.get_payslip_files, name='get-files'),
    path('payslips/send-selected/', views.send_selected_payslips, name='send-selected'),

    # Statistics (ORM-based)
    path('payslips/stats/', views.payslip_stats, name='payslip-stats'),

    # Audit log viewer (admin)
    path('payslips/audit-logs/', views.payroll_audit_logs, name='audit-logs'),

    # Validation issues viewer (admin)
    path('payslips/validation-issues/', views.payroll_validation_issues, name='validation-issues'),
]
