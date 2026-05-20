from django.urls import path
from . import views

urlpatterns = [
    # Bank master
    path('banks/', views.BankMasterListCreateView.as_view(), name='bank-list'),
    path('banks/<int:pk>/', views.BankMasterDetailView.as_view(), name='bank-detail'),

    # Branch master
    path('branches/', views.BankBranchListCreateView.as_view(), name='branch-list'),
    path('branches/<int:pk>/', views.BankBranchDetailView.as_view(), name='branch-detail'),
    path('branches/<int:branch_id>/ifsc/', views.branch_ifsc, name='branch-ifsc'),

    # Employee finance (bank/esi/pf/lwf)
    path('employee/<int:employee_id>/', views.employee_finance_detail, name='employee-finance-detail'),
    path('employee/<int:employee_id>/bank/', views.upsert_bank, name='upsert-bank'),
    path('employee/<int:employee_id>/esi/',  views.upsert_esi,  name='upsert-esi'),
    path('employee/<int:employee_id>/pf/',   views.upsert_pf,   name='upsert-pf'),
    path('employee/<int:employee_id>/lwf/',  views.upsert_lwf,  name='upsert-lwf'),

    # Family members
    path('employee/<int:employee_id>/family-members/', views.family_members, name='family-members'),
    path('family-members/<int:pk>/', views.family_member_detail, name='family-member-detail'),
    path('family-members/choices/', views.family_member_choices, name='family-member-choices'),
]
