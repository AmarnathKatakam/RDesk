from django.urls import path
from . import views

urlpatterns = [
    # Salary Components
    path('components/', views.component_list, name='payroll-config-component-list'),
    path('components/<int:pk>/', views.component_detail, name='payroll-config-component-detail'),

    # Salary Templates
    path('templates/', views.template_list, name='payroll-config-template-list'),
    path('templates/<int:pk>/', views.template_detail, name='payroll-config-template-detail'),
    path('templates/<int:pk>/components/', views.template_components, name='payroll-config-template-components'),
    path('templates/<int:pk>/components/<int:comp_id>/', views.template_component_detail, name='payroll-config-template-component-detail'),

    # Assignments (list/detail)
    path('assignments/', views.assignment_list, name='payroll-config-assignment-list'),
    path('assignments/<int:pk>/', views.assignment_detail, name='payroll-config-assignment-detail'),

    # Per-employee salary management
    path('employees/<int:emp_id>/assign-salary/', views.assign_employee_salary, name='payroll-config-assign-salary'),
    path('employees/<int:emp_id>/revise-salary/', views.revise_employee_salary, name='payroll-config-revise-salary'),
    path('employees/<int:emp_id>/salary-history/', views.employee_salary_history, name='payroll-config-salary-history'),

    # Statutory Config (Milestone 3B)
    path('statutory/', views.statutory_config_list, name='payroll-config-statutory-list'),
    path('statutory/<int:pk>/', views.statutory_config_detail, name='payroll-config-statutory-detail'),
    path('statutory/<int:config_pk>/pt-slabs/', views.pt_slab_list, name='payroll-config-pt-slab-list'),
    path('statutory/<int:config_pk>/pt-slabs/<int:slab_pk>/', views.pt_slab_detail, name='payroll-config-pt-slab-detail'),
    path('statutory/resolve/', views.statutory_config_resolve, name='payroll-config-statutory-resolve'),
    path('statutory/preview/', views.statutory_preview, name='payroll-config-statutory-preview'),
]
