"""
Payroll Run API Views — Milestone 2

All endpoints require admin/JWT authentication.
Business logic lives in payroll_service.py — views are thin.
"""
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from employees.models import Employee
from employees.monthly_salary_services import seed_monthly_salary_data

from .models import PayrollRun, PayrollRunItem, PayrollRunItemLine
from .payroll_service import (
    PayrollRunError,
    calculate_run,
    create_payroll_run,
    get_run_summary,
    hold_employee,
    release_employee_hold,
    reprocess_employee,
    transition_run,
)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _run_list_item(run: PayrollRun) -> dict:
    return {
        'id': run.id,
        'month': run.month,
        'year': run.year,
        'salary_type': run.salary_type,
        'status': run.status,
        'total_employees': run.total_employees,
        'total_gross': float(run.total_gross),
        'total_deductions': float(run.total_deductions),
        'total_net': float(run.total_net),
        'created_by': run.created_by.username if run.created_by else None,
        'created_at': run.created_at.isoformat() if run.created_at else None,
        'released_at': run.released_at.isoformat() if run.released_at else None,
        'valid_transitions': run.VALID_TRANSITIONS.get(run.status, []),
    }


def _run_item_dict(item: PayrollRunItem) -> dict:
    return {
        'id': item.id,
        'employee_pk': item.employee_id,
        'employee_id': item.employee.employee_id,
        'employee_name': item.employee.name,
        'department': item.employee.department.department_name if item.employee.department else None,
        'status': item.status,
        'gross_earnings': float(item.gross_earnings),
        'total_deductions': float(item.total_deductions),
        'employer_contributions': float(item.employer_contributions),
        'net_pay': float(item.net_pay),
        'lop_days': item.lop_days,
        'work_days': item.work_days,
        'payable_days': item.payable_days,
        'days_in_month': item.days_in_month,
        'proration_factor': float(item.proration_factor),
        'calculation_source': item.calculation_source,
        'calculation_notes': item.calculation_notes,
        'hold_reason': item.hold_reason,
        'error_message': item.error_message,
        'payslip_id': item.payslip_id,
        'salary_assignment_id': item.salary_assignment_id,
        'calculated_at': item.calculated_at.isoformat() if item.calculated_at else None,
    }


def _line_dict(line: PayrollRunItemLine) -> dict:
    return {
        'id': line.id,
        'code': line.code,
        'name': line.name,
        'component_type': line.component_type,
        'calculation_type': line.calculation_type,
        'rate': float(line.rate),
        'amount': float(line.amount),
        'is_statutory': line.is_statutory,
        'is_taxable': line.is_taxable,
        'affects_gross': line.affects_gross,
        'affects_net_pay': line.affects_net_pay,
        'affects_ctc': line.affects_ctc,
        'display_order': line.display_order,
    }


# ─── Run List / Create ────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def payroll_run_list(request):
    """
    GET  /api/payroll/runs/  — list all payroll runs
    POST /api/payroll/runs/  — create a new payroll run
    """
    if request.method == 'GET':
        runs = PayrollRun.objects.select_related('created_by').order_by('-year', '-month')
        return Response({'success': True, 'runs': [_run_list_item(r) for r in runs]})

    # POST — create
    month = request.data.get('month', '').strip()
    year = request.data.get('year')
    salary_type = request.data.get('salary_type', 'SALARY').strip().upper()

    if not month or not year:
        return Response(
            {'success': False, 'message': 'month and year are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        year = int(year)
    except (TypeError, ValueError):
        return Response({'success': False, 'message': 'year must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

    if salary_type not in ('SALARY', 'STIPEND'):
        return Response({'success': False, 'message': 'salary_type must be SALARY or STIPEND.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        run = create_payroll_run(month, year, salary_type, request.user)
    except PayrollRunError as exc:
        return Response({'success': False, 'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'success': True, 'run': _run_list_item(run)}, status=status.HTTP_201_CREATED)


# ─── Monthly Inputs Processing ────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def payroll_process_monthly_inputs(request):
    """
    POST /api/payroll/monthly-inputs/process/
    
    Seed monthly salary data for all active employees for a given month/year.
    
    Request body:
    {
        "month": "January",
        "year": 2025
    }
    
    Returns:
    {
        "success": true,
        "created": 150,
        "skipped": 5,
        "carry_forward": 140,
        "derived": 10,
        "adjustment_copies": 50,
        "errors": []
    }
    """
    month = request.data.get('month', '').strip()
    year = request.data.get('year')
    
    if not month or not year:
        return Response(
            {'success': False, 'message': 'month and year are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    
    try:
        year = int(year)
    except (TypeError, ValueError):
        return Response(
            {'success': False, 'message': 'year must be an integer.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    
    # Validate month
    valid_months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ]
    if month not in valid_months:
        return Response(
            {'success': False, 'message': f'Invalid month. Must be one of: {", ".join(valid_months)}'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    
    try:
        result = seed_monthly_salary_data(month, year, created_by=request.user)
        return Response(result, status=status.HTTP_200_OK)
    except Exception as exc:
        return Response(
            {'success': False, 'message': f'Error seeding monthly salary data: {str(exc)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ─── Run Detail ───────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_run_detail(request, run_id):
    """GET /api/payroll/runs/<id>/ — full run detail with summary."""
    run = get_object_or_404(PayrollRun, id=run_id)
    return Response({'success': True, 'run': get_run_summary(run)})


# ─── Calculate ────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def payroll_run_calculate(request, run_id):
    """POST /api/payroll/runs/<id>/calculate/ — calculate salary for all employees."""
    run = get_object_or_404(PayrollRun, id=run_id)
    try:
        result = calculate_run(run, request.user)
    except PayrollRunError as exc:
        return Response({'success': False, 'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'success': True, 'result': result, 'run': _run_list_item(run)})


# ─── Transition ───────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def payroll_run_transition(request, run_id):
    """
    POST /api/payroll/runs/<id>/transition/
    Body: { "new_status": "APPROVED", "reason": "optional note" }
    """
    run = get_object_or_404(PayrollRun, id=run_id)
    new_status = request.data.get('new_status', '').strip().upper()
    reason = request.data.get('reason', '').strip()

    if not new_status:
        return Response({'success': False, 'message': 'new_status is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        run = transition_run(run, new_status, request.user, reason)
    except PayrollRunError as exc:
        return Response({'success': False, 'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'success': True, 'run': _run_list_item(run)})


# ─── Run Items ────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_run_items(request, run_id):
    """GET /api/payroll/runs/<id>/items/ — list all PayrollRunItems for a run."""
    run = get_object_or_404(PayrollRun, id=run_id)
    items = (
        PayrollRunItem.objects
        .filter(run=run)
        .select_related('employee', 'employee__department')
        .order_by('employee__name')
    )
    return Response({'success': True, 'items': [_run_item_dict(i) for i in items]})


# ─── Hold Employee ────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def payroll_run_hold(request, run_id):
    """
    POST /api/payroll/runs/<id>/hold/
    Body: { "employee_id": 42, "reason": "Salary dispute pending" }
    """
    run = get_object_or_404(PayrollRun, id=run_id)
    emp_pk = request.data.get('employee_id')
    reason = request.data.get('reason', '').strip()

    if not emp_pk:
        return Response({'success': False, 'message': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    employee = get_object_or_404(Employee, id=emp_pk)

    try:
        item = hold_employee(run, employee, reason, request.user)
    except PayrollRunError as exc:
        return Response({'success': False, 'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'success': True, 'item': _run_item_dict(item)})


# ─── Release Hold ─────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def payroll_run_release_hold(request, run_id):
    """
    POST /api/payroll/runs/<id>/release-hold/
    Body: { "employee_id": 42 }
    """
    run = get_object_or_404(PayrollRun, id=run_id)
    emp_pk = request.data.get('employee_id')

    if not emp_pk:
        return Response({'success': False, 'message': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    employee = get_object_or_404(Employee, id=emp_pk)

    try:
        item = release_employee_hold(run, employee, request.user)
    except PayrollRunError as exc:
        return Response({'success': False, 'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'success': True, 'item': _run_item_dict(item)})


# ─── Reprocess Employee ───────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def payroll_run_reprocess(request, run_id):
    """
    POST /api/payroll/runs/<id>/reprocess/
    Body: { "employee_id": 42 }
    """
    run = get_object_or_404(PayrollRun, id=run_id)
    emp_pk = request.data.get('employee_id')

    if not emp_pk:
        return Response({'success': False, 'message': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    employee = get_object_or_404(Employee, id=emp_pk)

    try:
        item = reprocess_employee(run, employee, request.user)
    except PayrollRunError as exc:
        return Response({'success': False, 'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'success': True, 'item': _run_item_dict(item)})


# ─── Run Summary ──────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_run_summary(request, run_id):
    """GET /api/payroll/runs/<id>/summary/ — summary dict for dashboard."""
    run = get_object_or_404(PayrollRun, id=run_id)
    return Response({'success': True, 'summary': get_run_summary(run)})


# ─── Per-Employee Release Toggle ──────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def payroll_run_release_employee(request, run_id):
    """
    POST /api/payroll/runs/<id>/release-employee/
    Body: { "employee_id": 42 }

    Marks one employee's payslip as released without releasing the full run.
    Run must be in LOCKED or RELEASED status.
    """
    from django.utils import timezone
    from .models import Payslip
    from .audit import log_payroll_action

    run = get_object_or_404(PayrollRun, id=run_id)

    if run.status not in ('LOCKED', 'RELEASED'):
        return Response(
            {'success': False, 'message': 'Run must be LOCKED or RELEASED to release individual payslips.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    emp_pk = request.data.get('employee_id')
    if not emp_pk:
        return Response({'success': False, 'message': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    item = get_object_or_404(PayrollRunItem, run=run, employee_id=emp_pk)

    if not item.payslip_id:
        return Response(
            {'success': False, 'message': 'No payslip generated for this employee yet.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    Payslip.objects.filter(id=item.payslip_id).update(
        is_released=True,
        released_at=timezone.now(),
        released_by=request.user,
    )

    log_payroll_action(
        action='RELEASE',
        performed_by=request.user,
        employee=item.employee,
        pay_period_month=run.month,
        pay_period_year=run.year,
        notes=f'Per-employee release by {request.user.username}',
    )

    return Response({'success': True, 'message': f'Payslip released for {item.employee.name}.'})


# ─── Run Item Line Items ──────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_run_item_lines(request, run_id, item_id):
    """
    GET /api/payroll/runs/<run_id>/items/<item_id>/lines/
    Returns the component-wise breakdown for one employee in a run.
    """
    run = get_object_or_404(PayrollRun, id=run_id)
    item = get_object_or_404(PayrollRunItem, id=item_id, run=run)

    lines = (
        PayrollRunItemLine.objects
        .filter(run_item=item)
        .order_by('display_order', 'component_type', 'code')
    )

    # Group by component_type for convenience
    earnings = [_line_dict(l) for l in lines if l.component_type == 'EARNING']
    deductions = [_line_dict(l) for l in lines if l.component_type == 'DEDUCTION']
    employer = [_line_dict(l) for l in lines if l.component_type == 'EMPLOYER_CONTRIBUTION']

    return Response({
        'success': True,
        'item': _run_item_dict(item),
        'lines': {
            'earnings': earnings,
            'deductions': deductions,
            'employer_contributions': employer,
            'all': [_line_dict(l) for l in lines],
        },
        'totals': {
            'gross_earnings': float(item.gross_earnings),
            'total_deductions': float(item.total_deductions),
            'employer_contributions': float(item.employer_contributions),
            'net_pay': float(item.net_pay),
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_run_items_with_lines(request, run_id):
    """
    GET /api/payroll/runs/<run_id>/items/breakdown/
    Returns all run items with their line-item breakdowns.
    Useful for payroll review screens.
    """
    run = get_object_or_404(PayrollRun, id=run_id)
    items = (
        PayrollRunItem.objects
        .filter(run=run)
        .select_related('employee', 'employee__department')
        .prefetch_related('lines')
        .order_by('employee__name')
    )

    result = []
    for item in items:
        item_data = _run_item_dict(item)
        item_data['lines'] = [_line_dict(l) for l in item.lines.all().order_by('display_order', 'code')]
        result.append(item_data)

    return Response({'success': True, 'items': result})



# ─── Release Progress (C2) ────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_run_release_progress(request, run_id):
    """
    GET /api/payroll/runs/<id>/release-progress/
    Returns progress of payslip release for a run.
    Used by frontend to poll during async PDF generation.
    """
    from .models import Payslip
    run = get_object_or_404(PayrollRun, id=run_id)

    total = PayrollRunItem.objects.filter(run=run, status='INCLUDED').count()
    released = Payslip.objects.filter(
        pay_period_month=run.month,
        pay_period_year=run.year,
        salary_type=run.salary_type,
        is_released=True,
    ).count()

    return Response({
        'success': True,
        'total': total,
        'released': released,
        'done': released >= total,
        'percentage': int((released / total * 100) if total > 0 else 0),
    })
