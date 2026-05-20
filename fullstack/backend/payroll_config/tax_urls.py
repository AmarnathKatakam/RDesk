from django.urls import path
from . import tax_views

urlpatterns = [
    path('compare-regimes/', tax_views.compare_regimes, name='tax-compare-regimes'),
    path('form16/<str:financial_year>/', tax_views.get_form16, name='tax-form16-get'),
    path('form16/<str:financial_year>/generate/', tax_views.generate_form16, name='tax-form16-generate'),
    path('audit-log/', tax_views.tax_audit_log, name='tax-audit-log'),
    path('summary/', tax_views.tax_summary_dashboard, name='tax-summary-dashboard'),
]
