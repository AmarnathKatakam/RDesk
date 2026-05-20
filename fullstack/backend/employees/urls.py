from django.urls import path
from . import views
from . import org_views
from . import tax_declaration_views as tdv

app_name = 'employees'

urlpatterns = [
    path('', views.EmployeeListCreateView.as_view(), name='employee-list-create'),
    path('<int:pk>/', views.EmployeeDetailView.as_view(), name='employee-detail'),
    path('<int:pk>/overview/', views.employee_overview, name='employee-overview'),
    path('<int:pk>/regenerate-password/', views.regenerate_employee_password, name='regenerate-employee-password'),

    # Org chart / hierarchy
    path('org-chart/', org_views.org_chart_tree, name='org-chart-tree'),
    path('org-chart/assign-manager/', org_views.assign_manager, name='org-assign-manager'),
    path('org-chart/assign-top-level/', org_views.assign_top_level_manager, name='org-assign-top-level'),
    path('org-chart/mass-transfer/', org_views.mass_transfer, name='org-mass-transfer'),
    path('org-chart/manager/<int:manager_id>/team/', org_views.manager_team, name='org-manager-team'),
    path('org-chart/manager/<int:manager_id>/leaves/', org_views.manager_leave_queue, name='org-manager-leaves'),
    path('import/', views.import_excel, name='import-excel'),
    path('stats/', views.employee_stats, name='employee-stats'),
    path('by-department/<int:department_id>/', views.get_employees_by_department, name='employees-by-department'),
    
    # Salary Structure URLs
    path('salary-structures/', views.SalaryStructureListCreateView.as_view(), name='salary-structure-list-create'),
    path('salary-structures/<int:pk>/', views.SalaryStructureDetailView.as_view(), name='salary-structure-detail'),
    
    # Monthly Salary Data URLs
    path('monthly-salaries/', views.MonthlySalaryDataListView.as_view(), name='monthly-salary-list'),
    path('monthly-salaries/<int:pk>/', views.MonthlySalaryDataDetailView.as_view(), name='monthly-salary-detail'),
    path('monthly-salaries/upload/', views.upload_monthly_salary_excel, name='upload-monthly-salary-excel'),
    path('monthly-salaries/<str:month>/<int:year>/', views.get_monthly_salary_data, name='get-monthly-salary-data'),
    path('monthly-salaries/stats/', views.monthly_salary_stats, name='monthly-salary-stats'),

    # 3E — Monthly Salary Editor + Payroll Input Adjustments
    path('monthly-salaries/upsert/', views.monthly_salary_upsert, name='monthly-salary-upsert'),
    path('monthly-salaries/by-period/', views.monthly_salary_list_by_period, name='monthly-salary-by-period'),
    path('monthly-salaries/preview/', views.monthly_payroll_preview, name='monthly-payroll-preview'),
    path('payroll-adjustments/', views.payroll_adjustment_list_create, name='payroll-adjustment-list-create'),
    path('payroll-adjustments/<int:pk>/', views.payroll_adjustment_detail, name='payroll-adjustment-detail'),
    
    # Salary Calculation Preview and Actual Salary URLs
    path('salary-preview/', views.get_salary_calculation_preview, name='salary-calculation-preview'),
    path('actual-salary/upload/', views.upload_actual_salary_credited, name='upload-actual-salary-credited'),
    path('actual-salary/', views.get_actual_salary_credited, name='get-actual-salary-credited'),
    
    # Email URLs
    path('<int:pk>/send-welcome-email/', views.send_welcome_email, name='send-welcome-email'),
    path('send-bulk-welcome-emails/', views.send_bulk_welcome_emails, name='send-bulk-welcome-emails'),
    path('<int:pk>/send-welcome-email-with-credentials/', views.send_welcome_email_with_credentials, name='send-welcome-email-with-credentials'),
    path('welcome-email-employees/', views.get_employees_for_welcome_email, name='get-employees-for-welcome-email'),
    path('email-logs/', views.get_email_logs, name='get-email-logs'),
    path('process-welcome-email-excel/', views.process_welcome_email_excel, name='process-welcome-email-excel'),
    path('test-welcome-email/', views.test_welcome_email_simple, name='test-welcome-email-simple'),
    path('send-relieving-letter/', views.send_relieving_letter, name='send-relieving-letter'),

    # Letter generation
    path('letter-types/', views.get_letter_types, name='letter-types'),
    path('signatories/', views.get_signatories, name='signatories'),
    path('letters/preview/', views.preview_letter, name='letter-preview'),
    path('letters/generate/', views.generate_letters, name='letter-generate'),

    # Mass Communication / Announcements
    path('announcements/', views.list_announcements, name='announcement-list'),
    path('announcements/send/', views.send_announcement, name='announcement-send'),
    path('announcements/<int:pk>/delete/', views.delete_announcement, name='announcement-delete'),

    # Tax Declarations
    path('tax-declarations/', tdv.employee_declaration, name='tax-declaration'),
    path('tax-declarations/<str:financial_year>/update/', tdv.employee_declaration_update, name='tax-declaration-update'),
    path('tax-declarations/<str:financial_year>/submit/', tdv.employee_declaration_submit, name='tax-declaration-submit'),
    path('tax-declarations/<str:financial_year>/upload-proof/', tdv.employee_declaration_upload_proof, name='tax-declaration-upload-proof'),
    path('tax-declarations/tds-preview/', tdv.employee_tds_preview, name='tax-declaration-tds-preview'),
    path('tax-declarations/admin/', tdv.admin_declaration_list, name='tax-declaration-admin-list'),
    path('tax-declarations/admin/bulk-approve/', tdv.admin_declaration_bulk_approve, name='tax-declaration-bulk-approve'),
    path('tax-declarations/admin/<int:pk>/approve/', tdv.admin_declaration_approve, name='tax-declaration-approve'),
    path('tax-declarations/admin/<int:pk>/reject/', tdv.admin_declaration_reject, name='tax-declaration-reject'),
]
