from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from employees.models import Employee, EmployeeDocument
from .models import (
    BankMaster, BankBranchMaster,
    EmployeeBankDetail, EmployeeESIDetail,
    EmployeePFDetail, EmployeeLWFDetail,
)
from .serializers import (
    BankMasterSerializer, BankBranchMasterSerializer,
    EmployeeBankDetailSerializer, EmployeeESIDetailSerializer,
    EmployeePFDetailSerializer, EmployeeLWFDetailSerializer,
)


# ─── Bank Master ──────────────────────────────────────────────────────────────

class BankMasterListCreateView(generics.ListCreateAPIView):
    queryset = BankMaster.objects.filter(is_active=True).order_by('name')
    serializer_class = BankMasterSerializer
    permission_classes = [IsAuthenticated]


class BankMasterDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = BankMaster.objects.all()
    serializer_class = BankMasterSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])


# ─── Bank Branch Master ───────────────────────────────────────────────────────

class BankBranchListCreateView(generics.ListCreateAPIView):
    serializer_class = BankBranchMasterSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = BankBranchMaster.objects.filter(is_active=True).select_related('bank')
        bank_id = self.request.query_params.get('bank_id')
        if bank_id:
            qs = qs.filter(bank_id=bank_id)
        return qs.order_by('branch_name')


class BankBranchDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = BankBranchMaster.objects.all()
    serializer_class = BankBranchMasterSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def branch_ifsc(request, branch_id):
    branch = get_object_or_404(BankBranchMaster, id=branch_id, is_active=True)
    return Response({'ifsc_code': branch.ifsc_code, 'branch_name': branch.branch_name})


# ─── Employee finance detail (get all 4 sections at once) ────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def employee_finance_detail(request, employee_id):
    employee = get_object_or_404(Employee, id=employee_id, is_active=True)

    bank = getattr(employee, 'bank_detail', None)
    esi  = getattr(employee, 'esi_detail',  None)
    pf   = getattr(employee, 'pf_detail',   None)
    lwf  = getattr(employee, 'lwf_detail',  None)

    # Employee documents for PF proof selector
    docs = EmployeeDocument.objects.filter(employee=employee).values(
        'id', 'document_name', 'document_type'
    )

    return Response({
        'success': True,
        'employee': {'id': employee.id, 'name': employee.name, 'employee_id': employee.employee_id},
        'bank': EmployeeBankDetailSerializer(bank).data if bank else None,
        'esi':  EmployeeESIDetailSerializer(esi).data   if esi  else None,
        'pf':   EmployeePFDetailSerializer(pf).data     if pf   else None,
        'lwf':  EmployeeLWFDetailSerializer(lwf).data   if lwf  else None,
        'documents': list(docs),
    })


# ─── Upsert helpers ───────────────────────────────────────────────────────────

def _upsert(model_class, employee, serializer_class, data, related_name):
    instance = getattr(employee, related_name, None)
    if instance:
        ser = serializer_class(instance, data=data, partial=True)
    else:
        ser = serializer_class(data={**data, 'employee': employee.id})
    ser.is_valid(raise_exception=True)
    ser.save()
    return ser.data


@api_view(['POST', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def upsert_bank(request, employee_id):
    employee = get_object_or_404(Employee, id=employee_id, is_active=True)
    data = _upsert(EmployeeBankDetail, employee, EmployeeBankDetailSerializer, request.data, 'bank_detail')
    return Response({'success': True, 'bank': data})


@api_view(['POST', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def upsert_esi(request, employee_id):
    employee = get_object_or_404(Employee, id=employee_id, is_active=True)
    data = _upsert(EmployeeESIDetail, employee, EmployeeESIDetailSerializer, request.data, 'esi_detail')
    return Response({'success': True, 'esi': data})


@api_view(['POST', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def upsert_pf(request, employee_id):
    employee = get_object_or_404(Employee, id=employee_id, is_active=True)
    data = _upsert(EmployeePFDetail, employee, EmployeePFDetailSerializer, request.data, 'pf_detail')
    return Response({'success': True, 'pf': data})


@api_view(['POST', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def upsert_lwf(request, employee_id):
    employee = get_object_or_404(Employee, id=employee_id, is_active=True)
    data = _upsert(EmployeeLWFDetail, employee, EmployeeLWFDetailSerializer, request.data, 'lwf_detail')
    return Response({'success': True, 'lwf': data})


# ─── Family Members ───────────────────────────────────────────────────────────

from .models import EmployeeFamilyMember
from .serializers import EmployeeFamilyMemberSerializer


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def family_members(request, employee_id):
    employee = get_object_or_404(Employee, id=employee_id, is_active=True)

    if request.method == 'GET':
        members = EmployeeFamilyMember.objects.filter(employee=employee)
        return Response({
            'success': True,
            'employee': {'id': employee.id, 'name': employee.name, 'employee_id': employee.employee_id},
            'family_members': EmployeeFamilyMemberSerializer(members, many=True).data,
        })

    # POST — create
    data = {**request.data, 'employee': employee.id}
    ser = EmployeeFamilyMemberSerializer(data=data)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response({'success': True, 'family_member': ser.data}, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def family_member_detail(request, pk):
    member = get_object_or_404(EmployeeFamilyMember, pk=pk)

    if request.method == 'GET':
        return Response({'success': True, 'family_member': EmployeeFamilyMemberSerializer(member).data})

    if request.method == 'DELETE':
        member.delete()
        return Response({'success': True, 'message': 'Family member deleted.'}, status=status.HTTP_204_NO_CONTENT)

    # PUT / PATCH
    ser = EmployeeFamilyMemberSerializer(member, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response({'success': True, 'family_member': ser.data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def family_member_choices(request):
    """Return dropdown choices for family member form."""
    return Response({
        'relations':    [{'value': k, 'label': v} for k, v in EmployeeFamilyMember.RELATION_CHOICES],
        'genders':      [{'value': k, 'label': v} for k, v in EmployeeFamilyMember.GENDER_CHOICES],
        'blood_groups': [{'value': k, 'label': v} for k, v in EmployeeFamilyMember.BLOOD_GROUP_CHOICES],
        'address_sources': [{'value': k, 'label': v} for k, v in EmployeeFamilyMember.ADDRESS_SOURCE_CHOICES],
    })
