"""
payroll_config.tax_views — Tax API endpoints

GET  /api/tax/compare-regimes/   — compare OLD vs NEW regime tax for an employee
GET  /api/tax/form16/<fy>/        — get Form 16 data for an employee
POST /api/tax/form16/<fy>/generate/ — generate Form 16 from YTD records
GET  /api/tax/audit-log/          — tax audit log for an employee (admin)
GET  /api/tax/summary/            — admin tax summary dashboard
"""
from __future__ import annotations

import logging
from decimal import Decimal
from datetime import date as dt

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from employees.models import Employee
from .tds_service import (
    compute_tds_for_employee,
    _get_financial_year,
    _compute_slab_tax,
    _compute_surcharge,
    _remaining_fy_months,
    ZERO,
)

logger = logging.getLogger('payroll.tax_views')


def _log_tax_action(employee, action, financial_year='', field_changed='',
                    old_value='', new_value='', performed_by=None, notes=''):
    """Write a TaxAuditLog entry. Fails silently."""
    try:
        from .models import TaxAuditLog
        TaxAuditLog.objects.create(
            employee=employee,
            action=action,
            financial_year=financial_year,
            field_changed=field_changed,
            old_value=str(old_value),
            new_value=str(new_value),
            performed_by=performed_by,
            notes=notes,
        )
    except Exception as e:
        logger.warning('TaxAuditLog write failed: %s', e)


def _resolve_employee(request):
    session_emp_id = request.session.get('employee_id')
    if session_emp_id:
        return Employee.objects.filter(id=session_emp_id, is_active=True).first()
    emp_id = request.GET.get('employee_id') or request.data.get('employee_id')
    if emp_id:
        return Employee.objects.filter(id=emp_id, is_active=True).first()
    return None


def _current_fy():
    today = dt.today()
    if today.month >= 4:
        return f"{today.year}-{str(today.year + 1)[-2:]}"
    return f"{today.year - 1}-{str(today.year)[-2:]}"


# ─── Regime comparison ────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def compare_regimes(request):
    """
    GET /api/tax/compare-regimes/?employee_id=&financial_year=

    Computes projected annual tax under both OLD and NEW regimes
    and recommends the lower one.
    """
    employee = _resolve_employee(request)
    if not employee:
        return Response({'success': False, 'message': 'Employee not found'}, status=401)

    fy = request.GET.get('financial_year') or _current_fy()
    today = dt.today()

    def _compute_for_regime(regime_name: str) -> dict:
        """Temporarily override regime and compute TDS."""
        from .models import TaxRegimeConfig, TaxSlab, EmployeeYTDRecord
        from employees.models import EmployeeTaxProfile

        try:
            regime_config = TaxRegimeConfig.objects.get(
                financial_year=fy, regime=regime_name, is_active=True
            )
        except TaxRegimeConfig.DoesNotExist:
            return {'error': f'No config for {regime_name} regime FY {fy}'}

        slabs = list(TaxSlab.objects.filter(regime_config=regime_config)
                     .order_by('display_order', 'income_from'))

        # Get latest YTD for projection base
        prior_ytd = (
            EmployeeYTDRecord.objects
            .filter(employee=employee, financial_year=fy)
            .order_by('-year', '-month')
            .first()
        )
        ytd_taxable = Decimal(str(prior_ytd.ytd_taxable_earnings)) if prior_ytd else ZERO
        ytd_tds     = Decimal(str(prior_ytd.ytd_tds_deducted))     if prior_ytd else ZERO

        # Project annual gross from YTD
        months_elapsed = 12 - _remaining_fy_months(today.month, today.year) + 1
        monthly_avg = ytd_taxable / max(months_elapsed, 1)
        projected_gross = ytd_taxable + monthly_avg * Decimal(str(
            _remaining_fy_months(today.month, today.year) - 1
        ))

        std_deduction = Decimal(str(regime_config.standard_deduction))
        rebate_limit  = Decimal(str(regime_config.rebate_87a_limit))
        rebate_amount = Decimal(str(regime_config.rebate_87a_amount))
        cess_rate     = Decimal(str(regime_config.cess_rate))
        surcharge_slabs = regime_config.surcharge_slabs or []

        taxable = max(ZERO, projected_gross - std_deduction)

        # OLD regime: apply 80C + declaration deductions
        deductions_applied = ZERO
        if regime_name == 'OLD':
            try:
                from employees.models import TaxDeclaration, EmployeeTaxProfile
                from .tds_service import (CAP_80C, CAP_NPS_80CCD1B, CAP_80D_SELF,
                                          CAP_80D_PARENTS, CAP_80D_PARENTS_SR, CAP_24B_HL,
                                          _compute_80g)
                # PF-based 80C
                pf_80c = min(
                    Decimal(str(prior_ytd.ytd_deductions_80c)) if prior_ytd else ZERO,
                    CAP_80C
                )
                taxable = max(ZERO, taxable - pf_80c)
                deductions_applied += pf_80c

                decl = TaxDeclaration.objects.filter(
                    employee=employee, financial_year=fy, status='APPROVED'
                ).first()
                if decl:
                    extra_80c = max(ZERO, min(Decimal(str(decl.total_80c)), CAP_80C) - pf_80c)
                    cap_p = CAP_80D_PARENTS_SR if decl.parents_senior_citizen else CAP_80D_PARENTS
                    d80d = (min(Decimal(str(decl.medical_insurance_self)), CAP_80D_SELF) +
                            min(Decimal(str(decl.medical_insurance_parents)), cap_p))
                    d_nps = min(Decimal(str(decl.nps_additional)), CAP_NPS_80CCD1B)
                    d_hl  = min(Decimal(str(decl.home_loan_interest)), CAP_24B_HL)
                    d_edu = Decimal(str(decl.education_loan_interest))
                    d_80g = _compute_80g(Decimal(str(decl.donations_80g)),
                                         decl.donation_type, projected_gross)
                    total_decl = extra_80c + d80d + d_nps + d_hl + d_edu + d_80g
                    taxable = max(ZERO, taxable - total_decl)
                    deductions_applied += total_decl
            except Exception:
                pass

        annual_tax = _compute_slab_tax(taxable, slabs)
        if taxable <= rebate_limit:
            annual_tax = max(ZERO, annual_tax - min(annual_tax, rebate_amount))
        surcharge = _compute_surcharge(annual_tax, taxable, surcharge_slabs)
        cess = ((annual_tax + surcharge) * cess_rate).quantize(Decimal('0.01'))
        total_tax = annual_tax + surcharge + cess
        remaining = _remaining_fy_months(today.month, today.year)
        remaining_tax = max(ZERO, total_tax - ytd_tds)
        monthly_tds = (remaining_tax / Decimal(str(remaining))).quantize(Decimal('1')) if remaining else remaining_tax

        return {
            'regime': regime_name,
            'projected_gross': float(projected_gross),
            'standard_deduction': float(std_deduction),
            'total_deductions': float(deductions_applied),
            'taxable_income': float(taxable),
            'annual_tax': float(annual_tax),
            'surcharge': float(surcharge),
            'cess': float(cess),
            'total_annual_tax': float(total_tax),
            'ytd_tds_paid': float(ytd_tds),
            'monthly_tds': float(monthly_tds),
        }

    old_result = _compute_for_regime('OLD')
    new_result = _compute_for_regime('NEW')

    if 'error' in old_result or 'error' in new_result:
        return Response({
            'success': True,
            'old_regime': old_result,
            'new_regime': new_result,
            'recommended_regime': None,
            'tax_saving': 0,
        })

    old_tax = old_result['total_annual_tax']
    new_tax = new_result['total_annual_tax']
    recommended = 'OLD' if old_tax < new_tax else 'NEW'
    saving = abs(old_tax - new_tax)

    return Response({
        'success': True,
        'financial_year': fy,
        'old_regime': old_result,
        'new_regime': new_result,
        'recommended_regime': recommended,
        'tax_saving': round(saving, 2),
        'saving_note': (
            f"Choosing {recommended} regime saves ₹{saving:,.0f} in annual tax."
        ),
    })


# ─── Form 16 ─────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def get_form16(request, financial_year):
    """GET /api/tax/form16/<fy>/?employee_id= — fetch Form 16 data."""
    employee = _resolve_employee(request)
    if not employee:
        return Response({'success': False, 'message': 'Employee not found'}, status=401)

    from .models import Form16PartA, Form16PartB
    part_a = Form16PartA.objects.filter(employee=employee, financial_year=financial_year).first()
    part_b = Form16PartB.objects.filter(employee=employee, financial_year=financial_year).first()

    return Response({
        'success': True,
        'financial_year': financial_year,
        'part_a': _part_a_dict(part_a) if part_a else None,
        'part_b': _part_b_dict(part_b) if part_b else None,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_form16(request, financial_year):
    """
    POST /api/tax/form16/<fy>/generate/?employee_id=
    Generates Form 16 Part A + B from YTD records and approved declaration.
    """
    emp_id = request.GET.get('employee_id') or request.data.get('employee_id')
    if not emp_id:
        return Response({'success': False, 'message': 'employee_id required'}, status=400)
    try:
        employee = Employee.objects.get(id=emp_id, is_active=True)
    except Employee.DoesNotExist:
        return Response({'success': False, 'message': 'Employee not found'}, status=404)

    from .models import Form16PartA, Form16PartB, EmployeeYTDRecord
    from django.conf import settings as django_settings

    now = timezone.now()

    # Aggregate YTD records for the FY
    ytd_records = list(EmployeeYTDRecord.objects.filter(
        employee=employee, financial_year=financial_year
    ).order_by('year', 'month'))

    total_gross    = sum(Decimal(str(r.ytd_gross_earnings)) for r in ytd_records[-1:]) if ytd_records else ZERO
    total_tds      = sum(Decimal(str(r.ytd_tds_deducted))   for r in ytd_records[-1:]) if ytd_records else ZERO
    last_ytd       = ytd_records[-1] if ytd_records else None

    # Quarterly TDS split (approximate from monthly records)
    def _q_tds(months):
        return sum(
            Decimal(str(r.monthly_tds))
            for r in EmployeeYTDRecord.objects.filter(
                employee=employee, financial_year=financial_year, month__in=months
            )
        )

    q1 = _q_tds([4, 5, 6])
    q2 = _q_tds([7, 8, 9])
    q3 = _q_tds([10, 11, 12])
    q4 = _q_tds([1, 2, 3])

    employer_tan  = getattr(django_settings, 'EMPLOYER_TAN', 'HYDX00000X')
    employer_pan  = getattr(django_settings, 'EMPLOYER_PAN', 'AABCB1234C')
    employer_name = getattr(django_settings, 'COMPANY_NAME', 'BlackRoth Software Solutions Pvt. Ltd.')

    part_a, _ = Form16PartA.objects.update_or_create(
        employee=employee, financial_year=financial_year,
        defaults={
            'employer_tan': employer_tan,
            'employer_pan': employer_pan,
            'employer_name': employer_name,
            'employee_pan': employee.pan or '',
            'employee_name': employee.name,
            'q1_tds_deducted': q1, 'q1_tds_deposited': q1,
            'q2_tds_deducted': q2, 'q2_tds_deposited': q2,
            'q3_tds_deducted': q3, 'q3_tds_deposited': q3,
            'q4_tds_deducted': q4, 'q4_tds_deposited': q4,
            'total_tds_deducted': q1 + q2 + q3 + q4,
            'total_tds_deposited': q1 + q2 + q3 + q4,
            'is_generated': True,
            'generated_at': now,
            'generated_by': request.user,
        },
    )

    # Part B from last YTD record
    net_taxable = Decimal(str(last_ytd.projected_annual_taxable)) if last_ytd else ZERO
    annual_tax  = Decimal(str(last_ytd.projected_annual_tax))     if last_ytd else ZERO
    total_tax   = Decimal(str(last_ytd.projected_annual_tax_with_cess)) if last_ytd else ZERO

    from employees.models import TaxDeclaration
    decl = TaxDeclaration.objects.filter(
        employee=employee, financial_year=financial_year, status='APPROVED'
    ).first()

    part_b, _ = Form16PartB.objects.update_or_create(
        employee=employee, financial_year=financial_year,
        defaults={
            'part_a': part_a,
            'gross_salary': total_gross,
            'standard_deduction': Decimal('50000'),
            'income_from_salary': max(ZERO, total_gross - Decimal('50000')),
            'deduction_80c':     min(Decimal(str(decl.total_80c)), Decimal('150000')) if decl else ZERO,
            'deduction_80ccd1b': min(Decimal(str(decl.nps_additional)), Decimal('50000')) if decl else ZERO,
            'deduction_80d':     Decimal(str(decl.total_80d)) if decl else ZERO,
            'deduction_80e':     Decimal(str(decl.education_loan_interest)) if decl else ZERO,
            'deduction_80g':     Decimal(str(decl.donations_80g)) if decl else ZERO,
            'deduction_24b':     min(Decimal(str(decl.home_loan_interest)), Decimal('200000')) if decl else ZERO,
            'taxable_income':    net_taxable,
            'tax_on_income':     annual_tax,
            'total_tax_payable': total_tax,
            'net_tax_payable':   total_tax,
            'tds_deducted':      total_tds,
            'is_generated': True,
            'generated_at': now,
            'generated_by': request.user,
        },
    )

    _log_tax_action(
        employee=employee, action='FORM16_GENERATED',
        financial_year=financial_year,
        notes=f"Form 16 generated for FY {financial_year}. TDS=₹{total_tds:,.0f}",
        performed_by=request.user,
    )

    return Response({
        'success': True,
        'part_a': _part_a_dict(part_a),
        'part_b': _part_b_dict(part_b),
    })


def _part_a_dict(p) -> dict:
    return {
        'id': p.id, 'financial_year': p.financial_year,
        'employer_tan': p.employer_tan, 'employer_pan': p.employer_pan,
        'employer_name': p.employer_name,
        'employee_pan': p.employee_pan, 'employee_name': p.employee_name,
        'q1_tds': float(p.q1_tds_deducted), 'q2_tds': float(p.q2_tds_deducted),
        'q3_tds': float(p.q3_tds_deducted), 'q4_tds': float(p.q4_tds_deducted),
        'total_tds_deducted': float(p.total_tds_deducted),
        'is_generated': p.is_generated,
        'generated_at': p.generated_at.isoformat() if p.generated_at else None,
    }


def _part_b_dict(p) -> dict:
    return {
        'id': p.id, 'financial_year': p.financial_year, 'regime': p.regime,
        'gross_salary': float(p.gross_salary),
        'standard_deduction': float(p.standard_deduction),
        'income_from_salary': float(p.income_from_salary),
        'deduction_80c': float(p.deduction_80c),
        'deduction_80ccd1b': float(p.deduction_80ccd1b),
        'deduction_80d': float(p.deduction_80d),
        'deduction_80e': float(p.deduction_80e),
        'deduction_80g': float(p.deduction_80g),
        'deduction_24b': float(p.deduction_24b),
        'taxable_income': float(p.taxable_income),
        'tax_on_income': float(p.tax_on_income),
        'total_tax_payable': float(p.total_tax_payable),
        'tds_deducted': float(p.tds_deducted),
        'is_generated': p.is_generated,
        'generated_at': p.generated_at.isoformat() if p.generated_at else None,
    }


# ─── Tax audit log ────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tax_audit_log(request):
    """GET /api/tax/audit-log/?employee_id=&financial_year= — admin audit log."""
    emp_id = request.GET.get('employee_id')
    fy     = request.GET.get('financial_year', '')
    if not emp_id:
        return Response({'success': False, 'message': 'employee_id required'}, status=400)

    from .models import TaxAuditLog
    qs = TaxAuditLog.objects.filter(employee_id=emp_id)
    if fy:
        qs = qs.filter(financial_year=fy)
    qs = qs.select_related('performed_by').order_by('-timestamp')[:100]

    return Response({
        'success': True,
        'logs': [{
            'id': l.id,
            'action': l.action,
            'financial_year': l.financial_year,
            'field_changed': l.field_changed,
            'old_value': l.old_value,
            'new_value': l.new_value,
            'performed_by': l.performed_by.username if l.performed_by else 'system',
            'notes': l.notes,
            'timestamp': l.timestamp.isoformat(),
        } for l in qs],
    })


# ─── Admin tax summary dashboard ─────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tax_summary_dashboard(request):
    """
    GET /api/tax/summary/?financial_year=
    Admin dashboard: total TDS, declaration stats, anomaly alerts.
    """
    fy = request.GET.get('financial_year', _current_fy())
    from .models import EmployeeYTDRecord
    from employees.models import TaxDeclaration

    ytd_qs = EmployeeYTDRecord.objects.filter(financial_year=fy)
    total_employees_with_ytd = ytd_qs.values('employee').distinct().count()

    from django.db.models import Sum, Count, Q
    agg = ytd_qs.order_by('employee', '-year', '-month').distinct('employee').aggregate(
        total_tds=Sum('ytd_tds_deducted'),
        total_taxable=Sum('ytd_taxable_earnings'),
    )

    decl_stats = TaxDeclaration.objects.filter(financial_year=fy).aggregate(
        total=Count('id'),
        draft=Count('id', filter=Q(status='DRAFT')),
        submitted=Count('id', filter=Q(status='SUBMITTED')),
        approved=Count('id', filter=Q(status='APPROVED')),
        rejected=Count('id', filter=Q(status='REJECTED')),
    )

    # Anomaly alerts: employees with zero TDS but high taxable income
    from django.db.models import Max
    high_income_zero_tds = []
    for rec in ytd_qs.values('employee_id').annotate(
        max_taxable=Max('ytd_taxable_earnings'),
        max_tds=Max('ytd_tds_deducted'),
    ).filter(max_taxable__gt=500000, max_tds=0)[:10]:
        try:
            emp = Employee.objects.get(id=rec['employee_id'])
            high_income_zero_tds.append({
                'employee_id': emp.employee_id,
                'name': emp.name,
                'ytd_taxable': float(rec['max_taxable']),
            })
        except Employee.DoesNotExist:
            pass

    return Response({
        'success': True,
        'financial_year': fy,
        'total_employees_with_tds': total_employees_with_ytd,
        'total_tds_deducted': float(agg['total_tds'] or 0),
        'total_taxable_income': float(agg['total_taxable'] or 0),
        'declarations': decl_stats,
        'alerts': {
            'high_income_zero_tds': high_income_zero_tds,
            'pending_declarations': decl_stats['submitted'],
        },
    })
