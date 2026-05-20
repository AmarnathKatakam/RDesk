"""
employees.tax_declaration_views — Tax Declaration API

Employee endpoints:
  GET/POST  /api/employees/tax-declarations/          — get or create own declaration
  PUT       /api/employees/tax-declarations/<fy>/     — update own declaration
  POST      /api/employees/tax-declarations/<fy>/submit/   — submit for review
  POST      /api/employees/tax-declarations/<fy>/upload-proof/ — upload proof doc

Admin endpoints:
  GET       /api/employees/tax-declarations/admin/    — list all declarations
  POST      /api/employees/tax-declarations/admin/<id>/approve/ — approve
  POST      /api/employees/tax-declarations/admin/<id>/reject/  — reject with remarks
"""
from __future__ import annotations

import os
import logging
from decimal import Decimal
from datetime import datetime

from django.conf import settings
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import Employee, TaxDeclaration

logger = logging.getLogger('employees.tax_declaration')

ZERO = Decimal('0')

# ── Helpers ───────────────────────────────────────────────────────────────────

def _current_fy() -> str:
    today = datetime.today()
    if today.month >= 4:
        return f"{today.year}-{str(today.year + 1)[-2:]}"
    return f"{today.year - 1}-{str(today.year)[-2:]}"


def _decl_to_dict(d: TaxDeclaration) -> dict:
    return {
        'id': d.id,
        'employee_id': d.employee.employee_id,
        'employee_name': d.employee.name,
        'financial_year': d.financial_year,
        'status': d.status,
        # 80C
        'lic_premium':         float(d.lic_premium),
        'elss_investment':     float(d.elss_investment),
        'ppf_investment':      float(d.ppf_investment),
        'nsc_investment':      float(d.nsc_investment),
        'home_loan_principal': float(d.home_loan_principal),
        'tuition_fees':        float(d.tuition_fees),
        'other_80c':           float(d.other_80c),
        'total_80c':           float(d.total_80c),
        # 80D
        'medical_insurance_self':    float(d.medical_insurance_self),
        'medical_insurance_parents': float(d.medical_insurance_parents),
        'parents_senior_citizen':    d.parents_senior_citizen,
        'total_80d':                 float(d.total_80d),
        # HRA
        'rent_paid_monthly': float(d.rent_paid_monthly),
        'landlord_name':     d.landlord_name,
        'landlord_pan':      d.landlord_pan,
        'city_type':         d.city_type,
        # Other
        'education_loan_interest': float(d.education_loan_interest),
        'donations_80g':           float(d.donations_80g),
        'donation_type':           d.donation_type,
        'nps_additional':          float(d.nps_additional),
        'home_loan_interest':      float(d.home_loan_interest),
        # Totals
        'total_declared_deductions': float(d.total_declared_deductions),
        # Admin
        'admin_remarks':  d.admin_remarks,
        'reviewed_at':    d.reviewed_at.isoformat() if d.reviewed_at else None,
        'proof_documents': d.proof_documents,
        'submitted_at':   d.submitted_at.isoformat() if d.submitted_at else None,
        'created_at':     d.created_at.isoformat(),
        'updated_at':     d.updated_at.isoformat(),
    }


DECLARATION_FIELDS = [
    'lic_premium', 'elss_investment', 'ppf_investment', 'nsc_investment',
    'home_loan_principal', 'tuition_fees', 'other_80c',
    'medical_insurance_self', 'medical_insurance_parents', 'parents_senior_citizen',
    'rent_paid_monthly', 'landlord_name', 'landlord_pan', 'city_type',
    'education_loan_interest', 'donations_80g', 'donation_type',
    'nps_additional', 'home_loan_interest',
]

DECIMAL_FIELDS = {
    'lic_premium', 'elss_investment', 'ppf_investment', 'nsc_investment',
    'home_loan_principal', 'tuition_fees', 'other_80c',
    'medical_insurance_self', 'medical_insurance_parents',
    'rent_paid_monthly', 'education_loan_interest', 'donations_80g',
    'nps_additional', 'home_loan_interest',
}

BOOL_FIELDS = {'parents_senior_citizen'}


def _apply_fields(decl: TaxDeclaration, data: dict) -> None:
    for f in DECLARATION_FIELDS:
        if f in data:
            val = data[f]
            if f in DECIMAL_FIELDS:
                setattr(decl, f, Decimal(str(val or 0)))
            elif f in BOOL_FIELDS:
                setattr(decl, f, bool(val))
            else:
                setattr(decl, f, val or '')


def _resolve_employee(request) -> Employee | None:
    """Resolve employee from session or query param."""
    session_emp_id = request.session.get('employee_id')
    if session_emp_id:
        return Employee.objects.filter(id=session_emp_id, is_active=True).first()
    emp_id = request.GET.get('employee_id') or request.data.get('employee_id')
    if emp_id:
        return Employee.objects.filter(id=emp_id, is_active=True).first()
    return None


# ── Employee: get or create declaration ──────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def employee_declaration(request):
    """
    GET  — return current FY declaration (or empty scaffold)
    POST — create declaration for current FY
    """
    employee = _resolve_employee(request)
    if not employee:
        return Response({'success': False, 'message': 'Employee not found'}, status=401)

    fy = request.GET.get('financial_year') or request.data.get('financial_year') or _current_fy()

    if request.method == 'GET':
        decl = TaxDeclaration.objects.filter(employee=employee, financial_year=fy).first()
        if not decl:
            # Return empty scaffold so the form can pre-populate
            return Response({
                'success': True,
                'declaration': None,
                'financial_year': fy,
            })
        return Response({'success': True, 'declaration': _decl_to_dict(decl)})

    # POST — create
    if TaxDeclaration.objects.filter(employee=employee, financial_year=fy).exists():
        return Response(
            {'success': False, 'message': f'Declaration for FY {fy} already exists. Use PUT to update.'},
            status=400,
        )
    # Validate
    from payroll_config.tds_service import validate_declaration
    errors = validate_declaration(request.data)
    if errors:
        return Response({'success': False, 'errors': errors}, status=400)

    decl = TaxDeclaration(employee=employee, financial_year=fy, status='DRAFT')
    _apply_fields(decl, request.data)
    decl.save()
    return Response({'success': True, 'declaration': _decl_to_dict(decl)}, status=201)


@api_view(['PUT', 'PATCH'])
@permission_classes([AllowAny])
def employee_declaration_update(request, financial_year):
    """PUT/PATCH — update declaration (only allowed in DRAFT or REJECTED status)."""
    employee = _resolve_employee(request)
    if not employee:
        return Response({'success': False, 'message': 'Employee not found'}, status=401)

    try:
        decl = TaxDeclaration.objects.get(employee=employee, financial_year=financial_year)
    except TaxDeclaration.DoesNotExist:
        return Response({'success': False, 'message': 'Declaration not found'}, status=404)

    if decl.status == 'APPROVED':
        return Response(
            {'success': False, 'message': 'Approved declarations cannot be edited.'},
            status=400,
        )
    if decl.status == 'SUBMITTED':
        return Response(
            {'success': False, 'message': 'Submitted declarations cannot be edited. Wait for admin review.'},
            status=400,
        )

    # Payroll lock check
    from payroll_config.tds_service import validate_declaration, _is_payroll_locked_for_fy
    if _is_payroll_locked_for_fy(employee, financial_year):
        return Response(
            {'success': False, 'message': 'Payroll is locked for this financial year. Declaration cannot be edited.'},
            status=400,
        )

    # Validate
    errors = validate_declaration(request.data)
    if errors:
        return Response({'success': False, 'errors': errors}, status=400)

    _apply_fields(decl, request.data)
    if decl.status == 'REJECTED':
        decl.status = 'DRAFT'
    decl.save()
    return Response({'success': True, 'declaration': _decl_to_dict(decl)})


@api_view(['POST'])
@permission_classes([AllowAny])
def employee_declaration_submit(request, financial_year):
    """Submit declaration for admin review."""
    employee = _resolve_employee(request)
    if not employee:
        return Response({'success': False, 'message': 'Employee not found'}, status=401)

    try:
        decl = TaxDeclaration.objects.get(employee=employee, financial_year=financial_year)
    except TaxDeclaration.DoesNotExist:
        return Response({'success': False, 'message': 'Declaration not found'}, status=404)

    if decl.status not in ('DRAFT', 'REJECTED'):
        return Response(
            {'success': False, 'message': f'Cannot submit a declaration in {decl.status} status.'},
            status=400,
        )

    # Payroll lock check
    from payroll_config.tds_service import _is_payroll_locked_for_fy
    if _is_payroll_locked_for_fy(employee, decl.financial_year):
        return Response(
            {'success': False, 'message': 'Payroll is locked for this financial year. Declaration cannot be submitted.'},
            status=400,
        )

    decl.status = 'SUBMITTED'
    decl.submitted_at = timezone.now()
    decl.save(update_fields=['status', 'submitted_at', 'updated_at'])
    return Response({'success': True, 'declaration': _decl_to_dict(decl)})


@api_view(['POST'])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def employee_declaration_upload_proof(request, financial_year):
    """Upload a proof document for a declaration."""
    employee = _resolve_employee(request)
    if not employee:
        return Response({'success': False, 'message': 'Employee not found'}, status=401)

    try:
        decl = TaxDeclaration.objects.get(employee=employee, financial_year=financial_year)
    except TaxDeclaration.DoesNotExist:
        return Response({'success': False, 'message': 'Declaration not found'}, status=404)

    file = request.FILES.get('file')
    if not file:
        return Response({'success': False, 'message': 'No file provided'}, status=400)

    # Save to media/tax_proofs/<employee_id>/<fy>/
    upload_dir = os.path.join(
        settings.MEDIA_ROOT, 'tax_proofs',
        str(employee.employee_id), financial_year,
    )
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.name)
    with open(file_path, 'wb+') as dest:
        for chunk in file.chunks():
            dest.write(chunk)

    relative_path = os.path.relpath(file_path, settings.MEDIA_ROOT)
    docs = list(decl.proof_documents)
    docs.append(relative_path)
    decl.proof_documents = docs
    decl.save(update_fields=['proof_documents', 'updated_at'])

    return Response({'success': True, 'file_path': relative_path, 'declaration': _decl_to_dict(decl)})


# ── Admin: list all declarations ─────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_declaration_list(request):
    """List all declarations, filterable by financial_year and status."""
    fy     = request.GET.get('financial_year', _current_fy())
    status_filter = request.GET.get('status')

    qs = TaxDeclaration.objects.filter(financial_year=fy).select_related('employee')
    if status_filter:
        qs = qs.filter(status=status_filter)
    qs = qs.order_by('employee__name')

    return Response({
        'success': True,
        'financial_year': fy,
        'count': qs.count(),
        'declarations': [_decl_to_dict(d) for d in qs],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_declaration_approve(request, pk):
    """Approve a declaration — it will now be used in TDS computation."""
    try:
        decl = TaxDeclaration.objects.select_related('employee').get(pk=pk)
    except TaxDeclaration.DoesNotExist:
        return Response({'success': False, 'message': 'Not found'}, status=404)

    if decl.status != 'SUBMITTED':
        return Response(
            {'success': False, 'message': f'Only SUBMITTED declarations can be approved (current: {decl.status}).'},
            status=400,
        )

    admin = getattr(request.user, 'adminuser', None)
    decl.status = 'APPROVED'
    decl.reviewed_by = admin
    decl.reviewed_at = timezone.now()
    decl.admin_remarks = request.data.get('remarks', '')
    decl.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'admin_remarks', 'updated_at'])

    logger.info('Declaration %s approved by %s', decl.id, request.user)
    return Response({'success': True, 'declaration': _decl_to_dict(decl)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_declaration_reject(request, pk):
    """Reject a declaration with mandatory remarks."""
    try:
        decl = TaxDeclaration.objects.select_related('employee').get(pk=pk)
    except TaxDeclaration.DoesNotExist:
        return Response({'success': False, 'message': 'Not found'}, status=404)

    remarks = (request.data.get('remarks') or '').strip()
    if not remarks:
        return Response({'success': False, 'message': 'Rejection remarks are required.'}, status=400)

    admin = getattr(request.user, 'adminuser', None)
    decl.status = 'REJECTED'
    decl.reviewed_by = admin
    decl.reviewed_at = timezone.now()
    decl.admin_remarks = remarks
    decl.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'admin_remarks', 'updated_at'])

    logger.info('Declaration %s rejected by %s: %s', decl.id, request.user, remarks)
    return Response({'success': True, 'declaration': _decl_to_dict(decl)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_declaration_bulk_approve(request):
    """
    Bulk approve multiple declarations.
    Body: { "ids": [1, 2, 3], "remarks": "Verified" }
    """
    ids = request.data.get('ids', [])
    remarks = request.data.get('remarks', '')
    if not ids:
        return Response({'success': False, 'message': 'ids list is required'}, status=400)

    admin = getattr(request.user, 'adminuser', None)
    now = timezone.now()
    updated = TaxDeclaration.objects.filter(pk__in=ids, status='SUBMITTED').update(
        status='APPROVED',
        reviewed_by=admin,
        reviewed_at=now,
        admin_remarks=remarks,
    )
    return Response({'success': True, 'approved_count': updated})


@api_view(['GET'])
@permission_classes([AllowAny])
def employee_tds_preview(request):
    """
    GET /api/employees/tax-declarations/tds-preview/?employee_id=&financial_year=
    Returns projected TDS breakdown without triggering a payroll run.
    """
    employee = _resolve_employee(request)
    if not employee:
        return Response({'success': False, 'message': 'Employee not found'}, status=401)

    fy = request.GET.get('financial_year') or _current_fy()

    try:
        from payroll_config.tds_service import compute_tds_for_employee, _get_financial_year
        from datetime import date as dt
        today = dt.today()
        result = compute_tds_for_employee(
            employee=employee,
            month=today.month,
            year=today.year,
            payroll_date=today,
            gross_taxable_this_month=Decimal('0'),
            pf_employee_this_month=Decimal('0'),
        )
        return Response({
            'success': True,
            'financial_year': fy,
            'regime': result.regime,
            'projected_annual_gross': float(result.projected_annual_taxable + result.projected_80c),
            'standard_deduction': float(result.projected_annual_taxable - result.projected_net_taxable + result.projected_80c),
            'projected_80c': float(result.projected_80c),
            'hra_exemption': float(result.hra_exemption),
            'declaration_deductions': float(result.total_declaration_deductions),
            'projected_net_taxable': float(result.projected_net_taxable),
            'projected_annual_tax': float(result.projected_annual_tax),
            'projected_surcharge': float(result.projected_surcharge),
            'projected_cess': float(result.projected_cess),
            'projected_total_tax': float(result.projected_total_tax),
            'monthly_tds': float(result.monthly_tds),
            'ytd_tds_deducted': float(result.ytd_tds_prior),
            'warnings': result.warnings,
        })
    except Exception as e:
        return Response({'success': False, 'message': str(e)}, status=500)
