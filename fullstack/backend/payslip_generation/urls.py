from django.urls import path
from . import views

app_name = 'payslip_generation'

urlpatterns = [
    # Payslip URLs
    path('payslips/', views.PayslipListView.as_view(), name='payslip-list'),
    path('payslips/<int:pk>/', views.PayslipDetailView.as_view(), name='payslip-detail'),
    path('payslips/<int:payslip_id>/download/', views.download_payslip, name='download-payslip'),
    
    # Generation Task URLs
    path('payslips/task/<str:task_id>/', views.get_generation_status, name='task-status'),
    
    # Bulk Generation
    path('payslips/generate/', views.bulk_generate_payslips, name='bulk-generate'),
    
    # File Management
    path('payslips/download-monthly/<str:year>/<str:month>/', views.download_monthly_payslips, name='download-monthly'),
    path('payslips/files/<str:year>/<str:month>/', views.get_payslip_files, name='get-files'),
    path('payslips/send-selected/', views.send_selected_payslips, name='send-selected'),
    
    # Statistics
    path('payslips/stats/', views.payslip_stats, name='payslip-stats'),
]
