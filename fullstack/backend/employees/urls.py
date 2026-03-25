from django.urls import path
from . import views

app_name = 'employees'

urlpatterns = [
    path('', views.EmployeeListCreateView.as_view(), name='employee-list-create'),
    path('<int:pk>/', views.EmployeeDetailView.as_view(), name='employee-detail'),
    path('<int:pk>/overview/', views.employee_overview, name='employee-overview'),
    path('<int:pk>/regenerate-password/', views.regenerate_employee_password, name='regenerate-employee-password'),
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
]
