from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import Department
from .serializers import DepartmentSerializer


DEFAULT_IT_DEPARTMENTS = [
    {'code': 'DEV', 'name': 'Development', 'description': 'Software engineering and application development'},
    {'code': 'TST', 'name': 'Testing', 'description': 'Quality assurance and test automation'},
    {'code': 'HR', 'name': 'HR', 'description': 'Human resources and people operations'},
    {'code': 'OPS', 'name': 'Operations', 'description': 'IT operations and infrastructure'},
    {'code': 'SAL', 'name': 'Sales', 'description': 'Business development and sales'},
    {'code': 'SUP', 'name': 'Support', 'description': 'Customer and technical support'},
]


def ensure_default_it_departments():
    for item in DEFAULT_IT_DEPARTMENTS:
        department, created = Department.objects.get_or_create(
            department_code=item['code'],
            defaults={
                'department_name': item['name'],
                'description': item['description'],
                'is_active': True,
            }
        )
        if not created:
            changed_fields = []
            if department.department_name != item['name']:
                department.department_name = item['name']
                changed_fields.append('department_name')
            if not department.description:
                department.description = item['description']
                changed_fields.append('description')
            if not department.is_active:
                department.is_active = True
                changed_fields.append('is_active')
            if changed_fields:
                department.save(update_fields=changed_fields + ['updated_at'])


@method_decorator(csrf_exempt, name='dispatch')
class DepartmentListCreateView(generics.ListCreateAPIView):
    """
    List all departments or create a new department.
    """
    queryset = Department.objects.filter(is_active=True)
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        ensure_default_it_departments()
        return super().list(request, *args, **kwargs)


@method_decorator(csrf_exempt, name='dispatch')
class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a department.
    """
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        # Soft delete - set is_active to False
        instance.is_active = False
        instance.save()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def department_stats(request):
    """
    Get department statistics.
    """
    departments = Department.objects.filter(is_active=True)
    
    stats = []
    for dept in departments:
        stats.append({
            'id': dept.id,
            'name': dept.department_name,
            'code': dept.department_code,
            'employee_count': dept.employee_count,
            'created_at': dept.created_at
        })
    
    return Response({
        'success': True,
        'data': stats
    }, status=status.HTTP_200_OK)
