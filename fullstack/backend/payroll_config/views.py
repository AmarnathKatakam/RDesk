"""
payroll_config.views — CRUD API for salary configuration models.
"""
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from employees.models import Employee
from .models import SalaryComponent, SalaryTemplate, SalaryTemplateComponent, EmployeeSalaryAssignment
from .serializers import (
    SalaryComponentSerializer,
    SalaryTemplateSerializer,
    SalaryTemplateWriteSerializer,
    SalaryTemplateComponentSerializer,
    EmployeeSalaryAssignmentSerializer,
)
from .services import assign_salary, revise_salary, SalaryAssignmentError


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def component_list(request):
    if request.method == 'GET':
        qs = SalaryComponent.objects.all()
        if request.query_params.get('active_only', '').lower() == 'true':
            qs = qs.filter(is_active=True)
        if request.query_params.get('type'):
            qs = qs.filter(component_type=request.query_params['type'])
        return Response(SalaryComponentSerializer(qs, many=True).data)
    if not request.user.is_staff:
        return Response({'error': 'Admin access required.'}, status=403)
    s = SalaryComponentSerializer(data=request.data)
    if s.is_valid():
        s.save()
        return Response(s.data, status=201)
    return Response(s.errors, status=400)


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def component_detail(request, pk):
    try:
        obj = SalaryComponent.objects.get(pk=pk)
    except SalaryComponent.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    if request.method == 'GET':
        return Response(SalaryComponentSerializer(obj).data)
    if not request.user.is_staff:
        return Response({'error': 'Admin access required.'}, status=403)
    s = SalaryComponentSerializer(obj, data=request.data, partial=(request.method == 'PATCH'))
    if s.is_valid():
        s.save()
        return Response(s.data)
    return Response(s.errors, status=400)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def template_list(request):
    if request.method == 'GET':
        qs = SalaryTemplate.objects.prefetch_related('components__component').all()
        if request.query_params.get('active_only', '').lower() == 'true':
            qs = qs.filter(is_active=True)
        return Response(SalaryTemplateSerializer(qs, many=True).data)
    if not request.user.is_staff:
        return Response({'error': 'Admin access required.'}, status=403)
    s = SalaryTemplateWriteSerializer(data=request.data)
    if s.is_valid():
        s.save(created_by=request.user)
        return Response(s.data, status=201)
    return Response(s.errors, status=400)


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def template_detail(request, pk):
    try:
        obj = SalaryTemplate.objects.prefetch_related('components__component').get(pk=pk)
    except SalaryTemplate.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    if request.method == 'GET':
        return Response(SalaryTemplateSerializer(obj).data)
    if not request.user.is_staff:
        return Response({'error': 'Admin access required.'}, status=403)
    s = SalaryTemplateWriteSerializer(obj, data=request.data, partial=(request.method == 'PATCH'))
    if s.is_valid():
        s.save()
        return Response(SalaryTemplateSerializer(obj).data)
    return Response(s.errors, status=400)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def template_components(request, pk):
    try:
        template = SalaryTemplate.objects.get(pk=pk)
    except SalaryTemplate.DoesNotExist:
        return Response({'error': 'Template not found.'}, status=404)
    if request.method == 'GET':
        qs = SalaryTemplateComponent.objects.filter(template=template).select_related('component')
        return Response(SalaryTemplateComponentSerializer(qs, many=True).data)
    if not request.user.is_staff:
        return Response({'error': 'Admin access required.'}, status=403)
    data = {**request.data, 'template': template.pk}
    s = SalaryTemplateComponentSerializer(data=data)
    if s.is_valid():
        s.save()
        return Response(s.data, status=201)
    return Response(s.errors, status=400)


@api_view(['DELETE', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def template_component_detail(request, pk, comp_id):
    if not request.user.is_staff:
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        tc = SalaryTemplateComponent.objects.get(template_id=pk, id=comp_id)
    except SalaryTemplateComponent.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    if request.method == 'DELETE':
        if tc.component.is_statutory:
            return Response({'error': f'{tc.component.code} is statutory and cannot be removed.'}, status=400)
        tc.delete()
        return Response(status=204)
    s = SalaryTemplateComponentSerializer(tc, data=request.data, partial=(request.method == 'PATCH'))
    if s.is_valid():
        s.save()
        return Response(s.data)
    return Response(s.errors, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def assignment_list(request):
    qs = EmployeeSalaryAssignment.objects.select_related('employee', 'template').all()
    if request.query_params.get('active_only', '').lower() == 'true':
        qs = qs.filter(is_active=True)
    if request.query_params.get('employee_id'):
        qs = qs.filter(employee_id=request.query_params['employee_id'])
    return Response(EmployeeSalaryAssignmentSerializer(qs, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def assignment_detail(request, pk):
    try:
        obj = EmployeeSalaryAssignment.objects.select_related('employee', 'template').get(pk=pk)
    except EmployeeSalaryAssignment.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    return Response(EmployeeSalaryAssignmentSerializer(obj).data)


def _get_employee_or_404(emp_id):
    try:
        return Employee.objects.get(pk=emp_id), None
    except Employee.DoesNotExist:
        return None, Response({'error': 'Employee not found.'}, status=404)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assign_employee_salary(request, emp_id):
    if not request.user.is_staff:
        return Response({'error': 'Admin access required.'}, status=403)
    employee, err = _get_employee_or_404(emp_id)
    if err:
        return err
    s = EmployeeSalaryAssignmentSerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=400)
    try:
        assignment = assign_salary(
            employee=employee,
            template=s.validated_data['template'],
            annual_ctc=s.validated_data['annual_ctc'],
            effective_from=s.validated_data['effective_from'],
            created_by=request.user,
            notes=s.validated_data.get('notes', ''),
        )
    except SalaryAssignmentError as e:
        return Response({'error': str(e)}, status=400)
    return Response(EmployeeSalaryAssignmentSerializer(assignment).data, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def revise_employee_salary(request, emp_id):
    if not request.user.is_staff:
        return Response({'error': 'Admin access required.'}, status=403)
    employee, err = _get_employee_or_404(emp_id)
    if err:
        return err
    s = EmployeeSalaryAssignmentSerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=400)
    try:
        assignment = revise_salary(
            employee=employee,
            template=s.validated_data['template'],
            annual_ctc=s.validated_data['annual_ctc'],
            effective_from=s.validated_data['effective_from'],
            created_by=request.user,
            notes=s.validated_data.get('notes', ''),
        )
    except SalaryAssignmentError as e:
        return Response({'error': str(e)}, status=400)
    return Response(EmployeeSalaryAssignmentSerializer(assignment).data, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def employee_salary_history(request, emp_id):
    employee, err = _get_employee_or_404(emp_id)
    if err:
        return err
    assignments = (
        EmployeeSalaryAssignment.objects
        .select_related('template', 'created_by')
        .filter(employee=employee)
        .order_by('-effective_from')
    )
    return Response(EmployeeSalaryAssignmentSerializer(assignments, many=True).data)


# ─── Milestone 3B: Statutory Config Views ────────────────────────────────────

from .models import StatutoryConfig, ProfessionalTaxSlab
from .serializers import (
    StatutoryConfigSerializer,
    StatutoryConfigWriteSerializer,
    ProfessionalTaxSlabSerializer,
)
from .statutory_service import (
    get_statutory_config,
    get_financial_year,
    compute_all_statutory,
)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def statutory_config_list(request):
    if request.method == 'GET':
        qs = StatutoryConfig.objects.prefetch_related('pt_slabs').all()
        if request.query_params.get('state'):
            qs = qs.filter(state=request.query_params['state'])
        if request.query_params.get('financial_year'):
            qs = qs.filter(financial_year=request.query_params['financial_year'])
        if request.query_params.get('active_only', '').lower() == 'true':
            qs = qs.filter(is_active=True)
        return Response(StatutoryConfigSerializer(qs, many=True).data)

    if not request.user.is_staff:
        return Response({'error': 'Admin access required.'}, status=403)
    s = StatutoryConfigWriteSerializer(data=request.data)
    if s.is_valid():
        s.save(created_by=request.user)
        return Response(StatutoryConfigSerializer(StatutoryConfig.objects.get(pk=s.instance.pk)).data, status=201)
    return Response(s.errors, status=400)


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def statutory_config_detail(request, pk):
    try:
        obj = StatutoryConfig.objects.prefetch_related('pt_slabs').get(pk=pk)
    except StatutoryConfig.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if request.method == 'GET':
        return Response(StatutoryConfigSerializer(obj).data)

    if not request.user.is_staff:
        return Response({'error': 'Admin access required.'}, status=403)
    s = StatutoryConfigWriteSerializer(obj, data=request.data, partial=(request.method == 'PATCH'))
    if s.is_valid():
        s.save()
        obj.refresh_from_db()
        return Response(StatutoryConfigSerializer(obj).data)
    return Response(s.errors, status=400)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def pt_slab_list(request, config_pk):
    try:
        config = StatutoryConfig.objects.get(pk=config_pk)
    except StatutoryConfig.DoesNotExist:
        return Response({'error': 'Statutory config not found.'}, status=404)

    if request.method == 'GET':
        qs = ProfessionalTaxSlab.objects.filter(statutory_config=config)
        return Response(ProfessionalTaxSlabSerializer(qs, many=True).data)

    if not request.user.is_staff:
        return Response({'error': 'Admin access required.'}, status=403)
    data = {**request.data, 'statutory_config': config.pk}
    s = ProfessionalTaxSlabSerializer(data=data)
    if s.is_valid():
        s.save()
        return Response(s.data, status=201)
    return Response(s.errors, status=400)


@api_view(['PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def pt_slab_detail(request, config_pk, slab_pk):
    if not request.user.is_staff:
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        slab = ProfessionalTaxSlab.objects.get(pk=slab_pk, statutory_config_id=config_pk)
    except ProfessionalTaxSlab.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if request.method == 'DELETE':
        slab.delete()
        return Response(status=204)

    s = ProfessionalTaxSlabSerializer(slab, data=request.data, partial=(request.method == 'PATCH'))
    if s.is_valid():
        s.save()
        return Response(s.data)
    return Response(s.errors, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def statutory_config_resolve(request):
    """
    Resolve the active statutory config for a given state and date.
    Query params: state (required), date (optional, defaults to today)

    GET /api/payroll-config/statutory/resolve/?state=KA&date=2025-10-01
    """
    state = request.query_params.get('state')
    if not state:
        return Response({'error': 'state query param is required.'}, status=400)

    from datetime import date as date_cls
    date_str = request.query_params.get('date')
    if date_str:
        try:
            payroll_date = date_cls.fromisoformat(date_str)
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)
    else:
        payroll_date = date_cls.today()

    config = get_statutory_config(state, payroll_date)
    if not config:
        return Response({
            'found': False,
            'state': state,
            'financial_year': get_financial_year(payroll_date),
            'message': f'No active statutory config found for state={state} on {payroll_date}.',
        })

    return Response({
        'found': True,
        'config': StatutoryConfigSerializer(config).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def statutory_preview(request):
    """
    Preview statutory deductions for given inputs.
    Useful for admin to verify config before payroll run.

    POST body:
        {
            "pf_wage": 20000,
            "gross_wage": 45000,
            "state": "KA",
            "payroll_date": "2025-10-31",
            "month_number": 10,
            "gender": "ALL"
        }
    """
    from datetime import date as date_cls
    from decimal import InvalidOperation

    pf_wage = request.data.get('pf_wage', 0)
    gross_wage = request.data.get('gross_wage', 0)
    state = request.data.get('state')
    payroll_date_str = request.data.get('payroll_date')
    month_number = request.data.get('month_number')
    gender = request.data.get('gender', 'ALL')

    if not state:
        return Response({'error': 'state is required.'}, status=400)

    try:
        pf_wage = Decimal(str(pf_wage))
        gross_wage = Decimal(str(gross_wage))
    except InvalidOperation:
        return Response({'error': 'Invalid pf_wage or gross_wage.'}, status=400)

    if payroll_date_str:
        try:
            payroll_date = date_cls.fromisoformat(payroll_date_str)
        except ValueError:
            return Response({'error': 'Invalid payroll_date format. Use YYYY-MM-DD.'}, status=400)
    else:
        payroll_date = date_cls.today()

    if month_number is None:
        month_number = payroll_date.month

    try:
        month_number = int(month_number)
    except (ValueError, TypeError):
        return Response({'error': 'month_number must be an integer 1-12.'}, status=400)

    result = compute_all_statutory(
        pf_wage=pf_wage,
        gross_wage=gross_wage,
        state=state,
        payroll_date=payroll_date,
        month_number=month_number,
        gender=gender,
    )

    # Convert Decimals to strings for JSON serialization
    return Response({
        'inputs': {
            'pf_wage': str(pf_wage),
            'gross_wage': str(gross_wage),
            'state': state,
            'payroll_date': str(payroll_date),
            'month_number': month_number,
            'financial_year': get_financial_year(payroll_date),
        },
        'statutory': {k: str(v) if isinstance(v, Decimal) else v for k, v in result.items()},
    })
