import pandas as pd
import io
import logging
import secrets
import string
from decimal import Decimal
from rest_framework import status, generics, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.conf import settings
from django.core.mail import send_mail
from django.shortcuts import get_object_or_404
from django.db import transaction, models
from django.utils import timezone
from django.contrib.auth.hashers import make_password
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django_filters.rest_framework import DjangoFilterBackend
from .models import Employee, SalaryStructure, MonthlySalaryData, ActualSalaryCredited, EmailLog
from .serializers import (
    EmployeeSerializer, 
    SalaryStructureSerializer, 
    ExcelImportSerializer,
    MonthlySalaryDataSerializer,
    MonthlySalaryUploadSerializer
)
from departments.models import Department


def _resolve_admin_role(user):
    """Mirror frontend role expectations from group/username."""
    group_names = {group.name.lower() for group in user.groups.all()}
    if 'ceo' in group_names or str(user.username).lower() == 'ceo':
        return 'ceo'
    if 'hr' in group_names:
        return 'hr'
    return 'admin'

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def test_welcome_email_simple(request):
    """
    Simple test endpoint for welcome email
    """
    try:
        data = {
            "name": request.data.get("name", "Test User"),
            "personal_email": request.data.get("personal_email", "test@example.com"),
            "password": request.data.get("password", "TestPass123!"),
            "system_email": request.data.get("system_email", "test@blackroth.co.in"),
        }

        class TestEmployee:
            def __init__(self, name, email, personal_email, password, employee_id):
                self.name = name
                self.email = email
                self.personal_email = personal_email
                self.password = password
                self.employee_id = employee_id

        employee = TestEmployee(
            name=data["name"],
            email=data["system_email"],
            personal_email=data["personal_email"],
            password=data["password"],
            employee_id="TEST001"
        )

        from .email_service import EmployeeEmailService
        email_service = EmployeeEmailService()
        success, message = email_service.send_welcome_email(employee)

        return Response({
            "success": success,
            "message": message
        })

    except Exception as e:
        return Response({
            "success": False,
            "message": str(e)
        })

def _generate_secure_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + '@#$%&*!?'
    while True:
        candidate = ''.join(secrets.choice(alphabet) for _ in range(length))
        if (
            any(ch.islower() for ch in candidate)
            and any(ch.isupper() for ch in candidate)
            and any(ch.isdigit() for ch in candidate)
            and any(ch in '@#$%&*!?' for ch in candidate)
        ):
            return candidate


def _build_password_reset_email(employee: Employee, plain_password: str) -> tuple[str, str]:
    subject = 'Your RDesk Account Password Reset'
    body = (
        f'Hello {employee.name},\n\n'
        'Your account password has been reset.\n\n'
        f'Login Email: {employee.email}\n'
        f'Temporary Password: {plain_password}\n\n'
        'Please login and change your password after first login.\n\n'
        'Login URL:\n'
        'https://RDesk.blackroth.in/login\n\n'
        'Regards\n'
        'RDesk HR Team'
    )
    return subject, body


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def regenerate_employee_password(request, pk):
    """
    Regenerate an employee password in either:
    - view mode: returns plain password once
    - mail mode: emails password to employee
    """
    role = _resolve_admin_role(request.user)
    if role not in {'admin', 'hr', 'ceo'}:
        return Response({
            'status': 'error',
            'message': 'Only Admin/HR can regenerate employee passwords.'
        }, status=status.HTTP_403_FORBIDDEN)

    mode = str(request.data.get('mode', '')).strip().lower()
    if mode not in {'view', 'mail'}:
        return Response({
            'status': 'error',
            'message': 'mode must be either "view" or "mail".'
        }, status=status.HTTP_400_BAD_REQUEST)

    employee = get_object_or_404(Employee, pk=pk, is_active=True)
    if not employee.email:
        return Response({
            'status': 'error',
            'message': 'Employee does not have a login email configured.'
        }, status=status.HTTP_400_BAD_REQUEST)

    plain_password = _generate_secure_temp_password()
    hashed_password = make_password(plain_password)
    now = timezone.now()

    if mode == 'view':
        previous_account_activated = employee.account_activated
        previous_account_activated_at = employee.account_activated_at
        employee.password = hashed_password
        employee.password_changed = False
        employee.password_set_date = now
        employee.account_activated = True
        employee.account_activated_at = employee.account_activated_at or now
        employee.save(
            update_fields=[
                'password',
                'password_changed',
                'password_set_date',
                'account_activated',
                'account_activated_at',
                'updated_at',
            ]
        )

        logging.getLogger('employees').info(
            'Password regenerated in VIEW mode for employee_id=%s by user=%s role=%s (activated_before=%s)',
            employee.employee_id,
            request.user.username,
            role,
            previous_account_activated,
        )

        return Response({
            'status': 'success',
            'password': plain_password
        }, status=status.HTTP_200_OK)

    previous_password = employee.password
    previous_password_changed = employee.password_changed
    previous_password_set_date = employee.password_set_date
    previous_account_activated = employee.account_activated
    previous_account_activated_at = employee.account_activated_at

    employee.password = hashed_password
    employee.password_changed = False
    employee.password_set_date = now
    employee.account_activated = True
    employee.account_activated_at = employee.account_activated_at or now
    employee.save(
        update_fields=[
            'password',
            'password_changed',
            'password_set_date',
            'account_activated',
            'account_activated_at',
            'updated_at',
        ]
    )

    subject, body = _build_password_reset_email(employee, plain_password)
    try:
        send_mail(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            [employee.email],
            fail_silently=False,
        )
    except Exception as exc:
        # Revert to previous password if mail fails, so employee is not locked out.
        employee.password = previous_password
        employee.password_changed = previous_password_changed
        employee.password_set_date = previous_password_set_date
        employee.account_activated = previous_account_activated
        employee.account_activated_at = previous_account_activated_at
        employee.save(
            update_fields=[
                'password',
                'password_changed',
                'password_set_date',
                'account_activated',
                'account_activated_at',
                'updated_at',
            ]
        )

        logging.getLogger('employees').error(
            'Password regeneration MAIL mode failed for employee_id=%s by user=%s: %s',
            employee.employee_id,
            request.user.username,
            str(exc),
        )
        return Response({
            'status': 'error',
            'message': 'Failed to send password reset email.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    logging.getLogger('employees').info(
        'Password regenerated in MAIL mode for employee_id=%s by user=%s role=%s (activated_before=%s)',
        employee.employee_id,
        request.user.username,
        role,
        previous_account_activated,
    )

    return Response({
        'status': 'success',
        'message': 'Password generated and emailed to employee'
    }, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class EmployeeListCreateView(generics.ListCreateAPIView):
    """
    List all employees or create a new employee.
    """
    queryset = Employee.objects.filter(is_active=True).select_related('department', 'shift')
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['department', 'pay_mode', 'is_active', 'shift']
    search_fields = ['name', 'employee_id', 'position', 'location']
    ordering_fields = ['name', 'employee_id', 'doj', 'created_at']
    ordering = ['name']

    def create(self, request, *args, **kwargs):
        """
        Return clean serializer validation payload for frontend handling.
        """
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Validation failed',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        employee = serializer.save()
        headers = self.get_success_headers(serializer.data)
        response_data = self.get_serializer(employee).data
        reactivated = bool(getattr(serializer, '_reactivated_employee', False))
        response_data.update({
            'success': True,
            'message': (
                'Employee reactivated and activation invitation sent.'
                if reactivated
                else 'Employee created and activation invitation sent.'
            )
        })
        return Response(
            response_data,
            status=status.HTTP_200_OK if reactivated else status.HTTP_201_CREATED,
            headers=headers
        )


@method_decorator(csrf_exempt, name='dispatch')
class EmployeeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete an employee.
    """
    queryset = Employee.objects.select_related('department', 'shift').all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        # Soft delete - set is_active to False
        instance.is_active = False
        instance.save()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def employee_overview(request, pk):
    """
    Detailed employee payload with shift history and current-month attendance snapshot.
    """
    employee = get_object_or_404(
        Employee.objects.select_related('department', 'shift'),
        pk=pk,
        is_active=True
    )

    from attendance.models import AttendanceRecord, EmployeeShiftAssignment
    from attendance.services import generate_monthly_summary

    today = timezone.localdate()
    month_start = today.replace(day=1)

    shift_assignments = (
        EmployeeShiftAssignment.objects.select_related('shift', 'office_location', 'policy')
        .filter(employee=employee)
        .order_by('-effective_from', '-id')[:12]
    )
    attendance_rows = (
        AttendanceRecord.objects.select_related('shift')
        .filter(employee=employee, date__gte=month_start, date__lte=today)
        .order_by('-date')[:31]
    )
    monthly_summary = generate_monthly_summary(employee, month=today.month, year=today.year)

    return Response({
        'success': True,
        'employee': EmployeeSerializer(employee).data,
        'current_month_summary': {
            'month': monthly_summary.month,
            'year': monthly_summary.year,
            'present_days': monthly_summary.present_days,
            'late_days': monthly_summary.late_days,
            'leave_days': monthly_summary.leave_days,
            'half_days': monthly_summary.half_days,
            'absent_days': monthly_summary.absent_days,
            'total_working_hours': monthly_summary.total_working_hours,
            'overtime_hours': monthly_summary.overtime_hours,
            'payable_days': monthly_summary.payable_days,
        },
        'shift_assignments': [
            {
                'id': assignment.id,
                'shift_id': assignment.shift_id,
                'shift_name': assignment.shift.name if assignment.shift else None,
                'office_location': assignment.office_location.name if assignment.office_location else None,
                'policy': assignment.policy.name if assignment.policy else None,
                'effective_from': assignment.effective_from,
                'effective_to': assignment.effective_to,
                'is_active': assignment.is_active,
            }
            for assignment in shift_assignments
        ],
        'attendance': [
            {
                'id': row.id,
                'date': row.date,
                'status': row.status,
                'punch_in_time': row.punch_in_time,
                'punch_out_time': row.punch_out_time,
                'working_hours': row.working_hours,
                'overtime_hours': row.overtime_hours,
                'shift_name': row.shift.name if row.shift else None,
            }
            for row in attendance_rows
        ],
    }, status=status.HTTP_200_OK)


class SalaryStructureListCreateView(generics.ListCreateAPIView):
    """
    List all salary structures or create a new one.
    """
    queryset = SalaryStructure.objects.filter(is_active=True).select_related('employee')
    serializer_class = SalaryStructureSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['employee', 'salary_type', 'is_active']
    search_fields = ['employee__name', 'employee__employee_id']


class SalaryStructureDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a salary structure.
    """
    queryset = SalaryStructure.objects.all()
    serializer_class = SalaryStructureSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        # Soft delete - set is_active to False
        instance.is_active = False
        instance.save()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def import_excel(request):
    """
    Import employees from Excel file.
    """
    serializer = ExcelImportSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    file = serializer.validated_data['file']
    
    try:
        # Read Excel file
        if file.name.endswith('.csv'):
            df = pd.read_csv(file)
        else:
            df = pd.read_excel(file)
        
        # Validate required columns - handle different column name formats
        required_columns = [
            'employee_id', 'name', 'position', 'dob', 'doj', 'pan', 
            'bank_account', 'bank_ifsc', 'pay_mode', 'location'
        ]
        
        # Also check for alternative column names (Excel format)
        alternative_columns = [
            'Employee ID', 'Employee', 'Name', 'Position', 'Department',
            'DOB', 'DOJ', 'PAN', 'PF Number', 'Bank Account',
            'Bank IFSC', 'Pay Mode', 'Location', 'Health Card No', 'Health Card',
            'LPA', 'Is Active', 'Email', 'Mail'
        ]
        
        # Map alternative column names to standard names
        column_mapping = {
            'Employee ID': 'employee_id',
            'Employee': 'employee_id',
            'Name': 'name', 
            'Position': 'position',
            'Department': 'department_name',  # Keep as department_name for mapping
            'DOB': 'dob',
            'DOJ': 'doj',
            'PAN': 'pan',
            'PF Number': 'pf_number',
            'Bank Account': 'bank_account',
            'Bank IFSC': 'bank_ifsc',
            'Pay Mode': 'pay_mode',
            'Location': 'location',
            'Health Card No': 'health_card_no',
            'Health Card': 'health_card_no',
            'LPA': 'lpa',
            'Is Active': 'is_active',
            'Email': 'email',
            'Mail': 'email',
            'Annual CTC': 'annual_ctc'
        }
        
        # Department name to code mapping
        department_mapping = {
            'Sales': 'SALES001',
            'Finance': 'FIN001',
            'HR': 'HR001',
            'Operations': 'OPS001',
            'IT': 'IT001',
            'Marketing': 'MKT001'
        }
        
        # Rename columns to standard format
        df = df.rename(columns=column_mapping)
        
        # Check for either department_name or department_code (after renaming)
        has_department = 'department_name' in df.columns or 'department_code' in df.columns
        
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return Response({
                'success': False,
                'errors': [f'Missing required columns: {", ".join(missing_columns)}']
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not has_department:
            return Response({
                'success': False,
                'errors': ['Missing department information. Please include either "Department" or "department_code" column.']
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Process employees
        imported_count = 0
        errors = []
        warnings = []
        
        with transaction.atomic():
            for index, row in df.iterrows():
                try:
                    # Get department - handle both department_name and department_code
                    department = None
                    if 'department_name' in row and pd.notna(row['department_name']):
                        # Map department name to code
                        dept_name = str(row['department_name']).strip()
                        if dept_name in department_mapping:
                            dept_code = department_mapping[dept_name]
                            try:
                                department = Department.objects.get(
                                    department_code=dept_code,
                                    is_active=True
                                )
                            except Department.DoesNotExist:
                                errors.append(f"Row {index + 2}: Department '{dept_name}' (code: {dept_code}) not found")
                                continue
                        else:
                            errors.append(f"Row {index + 2}: Unknown department '{dept_name}'. Available: {list(department_mapping.keys())}")
                            continue
                    elif 'department_code' in row and pd.notna(row['department_code']):
                        try:
                            department = Department.objects.get(
                                department_code=row['department_code'],
                                is_active=True
                            )
                        except Department.DoesNotExist:
                            errors.append(f"Row {index + 2}: Department code '{row['department_code']}' not found")
                            continue
                    else:
                        errors.append(f"Row {index + 2}: No department specified")
                        continue
                    
                    # Check if employee already exists
                    if Employee.objects.filter(employee_id=row['employee_id']).exists():
                        warnings.append(f"Row {index + 2}: Employee ID '{row['employee_id']}' already exists")
                        continue
                    
                    # Handle date parsing with different formats
                    try:
                        # Try to parse date, handle various formats
                        dob_str = str(row['dob']).strip()
                        # Fix single digit days (e.g., 1990-05-1 -> 1990-05-01)
                        if len(dob_str.split('-')) == 3:
                            parts = dob_str.split('-')
                            if len(parts[2]) == 1:
                                parts[2] = '0' + parts[2]
                            dob_str = '-'.join(parts)
                        dob = pd.to_datetime(dob_str).date()
                    except:
                        errors.append(f"Row {index + 2}: Invalid DOB format '{row['dob']}'. Expected format: YYYY-MM-DD")
                        continue
                        
                    try:
                        # Try to parse date, handle various formats
                        doj_str = str(row['doj']).strip()
                        # Fix single digit days (e.g., 2020-01-1 -> 2020-01-01)
                        if len(doj_str.split('-')) == 3:
                            parts = doj_str.split('-')
                            if len(parts[2]) == 1:
                                parts[2] = '0' + parts[2]
                            doj_str = '-'.join(parts)
                        doj = pd.to_datetime(doj_str).date()
                    except:
                        errors.append(f"Row {index + 2}: Invalid DOJ format '{row['doj']}'. Expected format: YYYY-MM-DD")
                        continue
                    
                    # Handle LPA field
                    lpa_value = None
                    if 'lpa' in row and pd.notna(row['lpa']):
                        try:
                            lpa_value = float(row['lpa'])
                        except (ValueError, TypeError):
                            warnings.append(f"Row {index + 2}: Invalid LPA value '{row['lpa']}'")
                    
                    # Clean data fields
                    pan_clean = str(row['pan']).strip().replace(':', '').replace(' ', '')
                    bank_account_clean = str(row['bank_account']).strip().replace(':', '').replace(' ', '')
                    position_clean = str(row['position']).strip().replace(':', '').replace(' ', ' ')
                    
                    # Create employee
                    employee = Employee.objects.create(
                        employee_id=row['employee_id'],
                        name=row['name'],
                        position=position_clean,
                        department=department,
                        dob=dob,
                        doj=doj,
                        pan=pan_clean,
                        pf_number=row['pf_number'],
                        bank_account=bank_account_clean,
                        bank_ifsc=row['bank_ifsc'],
                        pay_mode=row['pay_mode'],
                        location=row['location'],
                        health_card_no=row.get('health_card_no', ''),
                        email=row.get('email', None),
                        personal_email=row.get('personal_email', None),  # Add personal email field
                        password=row.get('password', None),  # Add password field
                        lpa=lpa_value,
                        is_active=row.get('is_active', True) if 'is_active' in row else True
                    )
                    
                    # Create salary structure if annual_ctc is provided
                    if 'annual_ctc' in row and pd.notna(row['annual_ctc']):
                        try:
                            annual_ctc = float(row['annual_ctc'])
                            SalaryStructure.objects.create(
                                employee=employee,
                                salary_type='SALARY',
                                annual_ctc=annual_ctc,
                                is_active=True
                            )
                        except (ValueError, TypeError):
                            warnings.append(f"Row {index + 2}: Invalid annual_ctc value '{row['annual_ctc']}'")
                    
                    # Send welcome email if both personal_email and password are provided
                    if employee.personal_email and employee.password:
                        try:
                            from .email_service import EmployeeEmailService
                            email_service = EmployeeEmailService()
                            success, message = email_service.send_welcome_email(employee)
                            
                            if not success:
                                warnings.append(f"Row {index + 2}: Failed to send welcome email to {employee.personal_email}: {message}")
                        except Exception as email_error:
                            warnings.append(f"Row {index + 2}: Error sending welcome email: {str(email_error)}")
                    
                    imported_count += 1
                    
                except Exception as e:
                    errors.append(f"Row {index + 2}: {str(e)}")
                    continue
        
        return Response({
            'success': True,
            'imported_count': imported_count,
            'errors': errors,
            'warnings': warnings
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'errors': [f'Error processing file: {str(e)}']
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def employee_stats(request):
    """
    Get employee statistics.
    """
    total_employees = Employee.objects.filter(is_active=True).count()
    employees_by_department = {}
    employees_by_pay_mode = {}
    
    # Count by department
    for dept in Department.objects.filter(is_active=True):
        count = Employee.objects.filter(department=dept, is_active=True).count()
        if count > 0:
            employees_by_department[dept.department_name] = count
    
    # Count by pay mode
    for pay_mode, _ in Employee.PAY_MODE_CHOICES:
        count = Employee.objects.filter(pay_mode=pay_mode, is_active=True).count()
        if count > 0:
            employees_by_pay_mode[pay_mode] = count
    
    return Response({
        'success': True,
        'data': {
            'total_employees': total_employees,
            'by_department': employees_by_department,
            'by_pay_mode': employees_by_pay_mode
        }
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_employees_by_department(request, department_id):
    """
    Get employees by department.
    """
    try:
        department = Department.objects.get(id=department_id, is_active=True)
        employees = Employee.objects.filter(
            department=department,
            is_active=True
        ).select_related('department')
        
        serializer = EmployeeSerializer(employees, many=True)
        
        return Response({
            'success': True,
            'data': serializer.data
        }, status=status.HTTP_200_OK)
        
    except Department.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Department not found'
        }, status=status.HTTP_404_NOT_FOUND)


class MonthlySalaryDataListView(generics.ListCreateAPIView):
    """
    List and create monthly salary data.
    """
    queryset = MonthlySalaryData.objects.all().select_related('employee', 'uploaded_by')
    serializer_class = MonthlySalaryDataSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['employee', 'month', 'year']
    search_fields = ['employee__name', 'employee__employee_id']
    ordering_fields = ['month', 'year', 'uploaded_at']
    ordering = ['-year', '-month']
    
    def perform_create(self, serializer):
        """
        Set the uploaded_by field to the current user.
        """
        serializer.save(uploaded_by=self.request.user)


class MonthlySalaryDataDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete monthly salary data.
    """
    queryset = MonthlySalaryData.objects.all()
    serializer_class = MonthlySalaryDataSerializer
    permission_classes = [IsAuthenticated]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def upload_monthly_salary_excel(request):
    """
    Upload monthly salary data from Excel file.
    """
    serializer = MonthlySalaryUploadSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    file = serializer.validated_data['file']
    month = serializer.validated_data['month']
    year = serializer.validated_data['year']
    
    try:
        # Read Excel file
        df = pd.read_excel(file)
        
        # Validate required columns
        required_columns = [
            'employee_id', 'basic', 'hra', 'da', 'conveyance', 'medical', 
            'special_allowance', 'pf_employee', 'professional_tax', 'pf_employer',
            'work_days', 'days_in_month'
        ]
        
        # Also check for alternative column names
        column_mapping = {
            'Employee ID': 'employee_id',
            'Employee': 'employee_id',
            'Basic': 'basic',
            'Basic Salary': 'basic',
            'HRA': 'hra',
            'House Rent Allowance': 'hra',
            'DA': 'da',
            'Dearness Allowance': 'da',
            'Conveyance': 'conveyance',
            'Conveyance Allowance': 'conveyance',
            'Medical': 'medical',
            'Medical Allowance': 'medical',
            'Special Allowance': 'special_allowance',
            'Special': 'special_allowance',
            'PF Employee': 'pf_employee',
            'PF (Employee)': 'pf_employee',
            'Professional Tax': 'professional_tax',
            'PT': 'professional_tax',
            'PF Employer': 'pf_employer',
            'PF (Employer)': 'pf_employer',
            'Work Days': 'work_days',
            'Working Days': 'work_days',
            'Days in Month': 'days_in_month',
            'Total Days': 'days_in_month',
            'LOP Days': 'lop_days',
            'Loss of Pay': 'lop_days',
            'Other Deductions': 'other_deductions',
            'Salary Advance': 'salary_advance'
        }
        
        # Rename columns to standard format
        df = df.rename(columns=column_mapping)
        
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return Response({
                'success': False,
                'errors': [f'Missing required columns: {", ".join(missing_columns)}']
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Process salary data
        imported_count = 0
        updated_count = 0
        errors = []
        warnings = []
        
        with transaction.atomic():
            for index, row in df.iterrows():
                try:
                    # Get employee
                    try:
                        employee = Employee.objects.get(
                            employee_id=row['employee_id'],
                            is_active=True
                        )
                    except Employee.DoesNotExist:
                        errors.append(f"Row {index + 2}: Employee ID '{row['employee_id']}' not found")
                        continue
                    
                    # Prepare salary data
                    salary_data = {
                        'employee': employee,
                        'month': month,
                        'year': year,
                        'basic': Decimal(str(row['basic'])) if pd.notna(row['basic']) else Decimal('0'),
                        'hra': Decimal(str(row['hra'])) if pd.notna(row['hra']) else Decimal('0'),
                        'da': Decimal(str(row['da'])) if pd.notna(row['da']) else Decimal('0'),
                        'conveyance': Decimal(str(row['conveyance'])) if pd.notna(row['conveyance']) else Decimal('0'),
                        'medical': Decimal(str(row['medical'])) if pd.notna(row['medical']) else Decimal('0'),
                        'special_allowance': Decimal(str(row['special_allowance'])) if pd.notna(row['special_allowance']) else Decimal('0'),
                        'pf_employee': Decimal(str(row['pf_employee'])) if pd.notna(row['pf_employee']) else Decimal('0'),
                        'professional_tax': Decimal(str(row['professional_tax'])) if pd.notna(row['professional_tax']) else Decimal('0'),
                        'pf_employer': Decimal(str(row['pf_employer'])) if pd.notna(row['pf_employer']) else Decimal('0'),
                        'other_deductions': Decimal(str(row.get('other_deductions', 0))) if pd.notna(row.get('other_deductions', 0)) else Decimal('0'),
                        'salary_advance': Decimal(str(row.get('salary_advance', 0))) if pd.notna(row.get('salary_advance', 0)) else Decimal('0'),
                        'work_days': int(row['work_days']) if pd.notna(row['work_days']) else 0,
                        'days_in_month': int(row['days_in_month']) if pd.notna(row['days_in_month']) else 0,
                        'lop_days': int(row.get('lop_days', 0)) if pd.notna(row.get('lop_days', 0)) else 0,
                        'uploaded_by': request.user
                    }
                    
                    # Check if salary data already exists for this employee and month
                    existing_salary = MonthlySalaryData.objects.filter(
                        employee=employee,
                        month=month,
                        year=year
                    ).first()
                    
                    if existing_salary:
                        # Update existing record
                        for key, value in salary_data.items():
                            if key != 'employee':  # Don't update employee field
                                setattr(existing_salary, key, value)
                        existing_salary.save()
                        updated_count += 1
                    else:
                        # Create new record
                        MonthlySalaryData.objects.create(**salary_data)
                        imported_count += 1
                    
                except Exception as e:
                    errors.append(f"Row {index + 2}: {str(e)}")
                    continue
        
        return Response({
            'success': True,
            'imported_count': imported_count,
            'updated_count': updated_count,
            'errors': errors,
            'warnings': warnings
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'errors': [f'Error processing file: {str(e)}']
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_monthly_salary_data(request, month, year):
    """
    Get monthly salary data for a specific month and year.
    """
    try:
        salary_data = MonthlySalaryData.objects.filter(
            month=month,
            year=year
        ).select_related('employee', 'uploaded_by')
        
        serializer = MonthlySalaryDataSerializer(salary_data, many=True)
        
        return Response({
            'success': True,
            'data': serializer.data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error retrieving data: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def monthly_salary_stats(request):
    """
    Get monthly salary data statistics.
    """
    try:
        total_records = MonthlySalaryData.objects.count()
        records_by_month = {}
        records_by_year = {}
        
        # Count by month
        for record in MonthlySalaryData.objects.all():
            month_key = f"{record.month} {record.year}"
            records_by_month[month_key] = records_by_month.get(month_key, 0) + 1
        
        # Count by year
        for record in MonthlySalaryData.objects.all():
            records_by_year[record.year] = records_by_year.get(record.year, 0) + 1
        
        return Response({
            'success': True,
            'data': {
                'total_records': total_records,
                'by_month': records_by_month,
                'by_year': records_by_year
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error getting statistics: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_salary_calculation_preview(request):
    """
    Get salary calculation preview for selected employees and month.
    """
    try:
        employee_ids = request.GET.getlist('employee_ids')
        month = request.GET.get('month')
        year = int(request.GET.get('year'))




        if not employee_ids or not month or not year:
            return Response({
                'success': False,
                'message': 'Employee IDs, month, and year are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        employees = Employee.objects.filter(
            id__in=employee_ids,
            is_active=True
        ).select_related('department')



        preview_data = []

        for employee in employees:


            # Get monthly salary data
            monthly_salary_qs = MonthlySalaryData.objects.filter(
                employee=employee,
                month=month,
                year=year
            )

            if monthly_salary_qs.exists():
                monthly_salary = monthly_salary_qs.first()
                if employee.lpa:
                    lpa_annual = float(employee.lpa) * 100000  # Convert lakhs to rupees
                else:
                    lpa_annual = 0
                calculated_monthly = float(monthly_salary.net_pay)

                preview_data.append({
                    'employee_id': employee.id,
                    'employee_name': employee.name,
                    'employee_id_code': employee.employee_id,
                    'department': employee.department.department_name,
                    'lpa': float(employee.lpa) if employee.lpa else 0,
                    'calculated_monthly': calculated_monthly,
                    'lpa_monthly': lpa_annual / 12,
                    'difference': abs(calculated_monthly - (lpa_annual / 12)) if lpa_annual > 0 else calculated_monthly,
                    'difference_percentage': abs((calculated_monthly - (lpa_annual / 12)) / (lpa_annual / 12) * 100) if lpa_annual > 0 else 0,
                    'is_nearby': abs(calculated_monthly - (lpa_annual / 12)) <= (lpa_annual / 12 * 0.1) if lpa_annual > 0 else False  # Within 10%
                })
            else:
                # No monthly salary data for this employee/month
                continue




        return Response({
            'success': True,
            'data': preview_data,
            'summary': {
                'total_employees': len(preview_data),
                'nearby_calculations': len([emp for emp in preview_data if emp['is_nearby']]),
                'month': month,
                'year': year
            }
        }, status=status.HTTP_200_OK)

    except Exception as e:

        return Response({
            'success': False,
            'message': f'Error getting salary preview: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def upload_actual_salary_credited(request):
    """
    Upload actual salary credited data for employees.
    """
    try:
        data = request.data
        employee_salaries = data.get('employee_salaries', [])
        month = data.get('month')
        year = int(data.get('year'))
        
        if not employee_salaries or not month or not year:
            return Response({
                'success': False,
                'message': 'Employee salaries, month, and year are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        uploaded_count = 0
        updated_count = 0
        errors = []
        
        for salary_data in employee_salaries:
            try:
                employee_id = salary_data.get('employee_id')
                actual_salary = Decimal(str(salary_data.get('actual_salary_credited', 0)))
                
                if not employee_id or actual_salary <= 0:
                    errors.append(f"Invalid data for employee {employee_id}")
                    continue
                
                employee = Employee.objects.get(id=employee_id)
                
                # Check if actual salary already exists
                existing_salary = ActualSalaryCredited.objects.filter(
                    employee=employee,
                    month=month,
                    year=year
                ).first()
                
                if existing_salary:
                    # Update existing record
                    existing_salary.actual_salary_credited = actual_salary
                    existing_salary.uploaded_by = request.user
                    existing_salary.save()
                    updated_count += 1
                else:
                    # Create new record
                    ActualSalaryCredited.objects.create(
                        employee=employee,
                        month=month,
                        year=year,
                        actual_salary_credited=actual_salary,
                        uploaded_by=request.user
                    )
                    uploaded_count += 1
                    
            except Employee.DoesNotExist:
                errors.append(f"Employee with ID {employee_id} not found")
            except Exception as e:
                errors.append(f"Error processing employee {employee_id}: {str(e)}")
        
        return Response({
            'success': True,
            'uploaded_count': uploaded_count,
            'updated_count': updated_count,
            'errors': errors
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error uploading actual salary data: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_actual_salary_credited(request):
    """
    Get actual salary credited data for employees.
    """
    try:
        month = request.GET.get('month')
        year = int(request.GET.get('year')) if request.GET.get('year') else None
        employee_id = request.GET.get('employee_id')
        
        queryset = ActualSalaryCredited.objects.select_related('employee', 'uploaded_by')
        
        if month:
            queryset = queryset.filter(month=month)
        if year:
            queryset = queryset.filter(year=year)
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        
        data = []
        for record in queryset:
            data.append({
                'id': record.id,
                'employee_id': record.employee.id,
                'employee_name': record.employee.name,
                'employee_id_code': record.employee.employee_id,
                'month': record.month,
                'year': record.year,
                'actual_salary_credited': float(record.actual_salary_credited),
                'uploaded_at': record.uploaded_at,
                'uploaded_by': record.uploaded_by.username
            })
        
        return Response({
            'success': True,
            'data': data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error getting actual salary data: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_welcome_email(request, pk):
    """
    Send welcome email to specific employee.
    """
    try:
        employee = get_object_or_404(Employee, pk=pk)
        
        if not employee.personal_email:
            return Response({
                'success': False,
                'message': 'Employee has no personal email address'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not employee.password:
            return Response({
                'success': False,
                'message': 'Employee has no password set'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        from .email_service import EmployeeEmailService
        email_service = EmployeeEmailService()
        success, message = email_service.send_welcome_email(employee)
        
        return Response({
            'success': success,
            'message': message
        }, status=status.HTTP_200_OK if success else status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_bulk_welcome_emails(request):
    """
    Send welcome emails to multiple employees.
    """
    try:
        employee_ids = request.data.get('employee_ids', [])
        if not employee_ids:
            return Response({
                'success': False,
                'message': 'No employee IDs provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get employees
        employees = Employee.objects.filter(
            id__in=employee_ids,
            is_active=True,
            personal_email__isnull=False,
            password__isnull=False
        ).exclude(personal_email='').exclude(password='')
        
        if not employees.exists():
            return Response({
                'success': False,
                'message': 'No valid employees found with email and password'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        from .email_service import EmployeeEmailService
        email_service = EmployeeEmailService()
        results = email_service.send_bulk_welcome_emails(employees)
        
        return Response({
            'success': True,
            'message': f'Bulk welcome emails processed. Sent: {results["sent"]}, Failed: {results["failed"]}',
            'results': results
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_welcome_email_with_credentials(request, pk):
    """
    Send welcome email to employee with custom credentials.
    """
    try:
        employee = get_object_or_404(Employee, pk=pk)
        
        # Get custom credentials from request
        custom_email = request.data.get('personal_email', employee.personal_email)
        custom_password = request.data.get('password', employee.password)
        
        if not custom_email:
            return Response({
                'success': False,
                'message': 'No email address provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not custom_password:
            return Response({
                'success': False,
                'message': 'No password provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create temporary employee object with custom credentials
        temp_employee = Employee(
            name=employee.name,
            email=employee.email,
            personal_email=custom_email,
            password=custom_password,
            employee_id=employee.employee_id
        )
        
        from .email_service import EmployeeEmailService
        email_service = EmployeeEmailService()
        success, message = email_service.send_welcome_email(temp_employee)
        
        return Response({
            'success': success,
            'message': message
        }, status=status.HTTP_200_OK if success else status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_employees_for_welcome_email(request):
    """
    Get list of employees who can receive welcome emails.
    """
    try:
        # Get employees without personal email or password
        employees_missing_info = Employee.objects.filter(
            is_active=True
        ).filter(
            models.Q(personal_email__isnull=True) | 
            models.Q(personal_email='') | 
            models.Q(password__isnull=True) | 
            models.Q(password='')
        ).select_related('department')
        
        # Get employees with complete info
        employees_ready = Employee.objects.filter(
            is_active=True,
            personal_email__isnull=False,
            password__isnull=False
        ).exclude(personal_email='').exclude(password='').select_related('department')
        
        # Serialize data
        missing_serializer = EmployeeSerializer(employees_missing_info, many=True)
        ready_serializer = EmployeeSerializer(employees_ready, many=True)
        
        return Response({
            'success': True,
            'employees_ready': ready_serializer.data,
            'employees_missing_info': missing_serializer.data,
            'counts': {
                'ready': employees_ready.count(),
                'missing_info': employees_missing_info.count()
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_email_logs(request):
    """
    Get email sending logs with optional filtering.
    """
    try:
        # Get query parameters
        email_type = request.GET.get('email_type')
        status_filter = request.GET.get('status')
        employee_id = request.GET.get('employee_id')
        limit = int(request.GET.get('limit', 50))
        
        # Build queryset
        queryset = EmailLog.objects.all().select_related('employee')
        
        if email_type:
            queryset = queryset.filter(email_type=email_type)
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
            
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        
        # Order by most recent first and limit results
        queryset = queryset.order_by('-sent_at')[:limit]
        
        # Serialize data
        logs_data = []
        for log in queryset:
            logs_data.append({
                'id': log.id,
                'employee_id': log.employee.employee_id if log.employee else None,
                'employee_name': log.employee.name if log.employee else 'N/A',
                'email_type': log.email_type,
                'recipient_email': log.recipient_email,
                'subject': log.subject,
                'status': log.status,
                'message': log.message,
                'sent_at': log.sent_at.isoformat(),
                'error_message': log.error_message
            })
        
        return Response({
            'success': True,
            'logs': logs_data,
            'count': len(logs_data)
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def process_welcome_email_excel(request):
    """
    Process Excel file for welcome email sending.
    """
    try:
        # Check if it's a file upload or manual form submission
        if 'file' in request.FILES:
            # File upload processing
            file = request.FILES['file']
            
            # Read Excel file
            if file.name.endswith('.csv'):
                df = pd.read_csv(file)
            else:
                df = pd.read_excel(file)
        else:
            # Manual form processing - create a single-row DataFrame
            manual_data = {
                'name': request.data.get('name', ''),
                'personal_email': request.data.get('personal_email', ''),
                'password': request.data.get('password', ''),
                'system_email': request.data.get('system_email', '')
            }
            df = pd.DataFrame([manual_data])
        
        # Validate required columns
        required_columns = ['name', 'personal_email', 'password', 'system_email']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            return Response({
                'success': False,
                'message': f'Missing required columns: {", ".join(missing_columns)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Process each row
        processed_count = 0
        emails_sent = 0
        errors = []
        
        from .email_service import EmployeeEmailService
        email_service = EmployeeEmailService()
        
        for index, row in df.iterrows():
            try:
                # Find or create employee
                employee = None
                
                # First try to find by system_email
                if 'system_email' in row and pd.notna(row['system_email']):
                    try:
                        employee = Employee.objects.get(email=row['system_email'])
                    except Employee.DoesNotExist:
                        pass
                
                # If not found, try to find by personal_email
                if not employee and 'personal_email' in row and pd.notna(row['personal_email']):
                    try:
                        employee = Employee.objects.get(personal_email=row['personal_email'])
                    except Employee.DoesNotExist:
                        pass
                
                # If still not found, create a new employee
                if not employee:
                    # Validate required fields for new employee
                    if not all(pd.notna(row.get(field, '')) for field in ['name', 'system_email', 'personal_email', 'password']):
                        errors.append(f"Row {index + 1}: Missing required fields for new employee creation")
                        continue
                    
                    # Create new employee with all required fields
                    from datetime import date
                    from departments.models import Department
                    
                    # Get default department (first available)
                    default_department = Department.objects.first()
                    if not default_department:
                        errors.append(f"Row {index + 1}: No departments available. Please create a department first.")
                        continue
                    
                    # Generate unique employee ID
                    def generate_unique_employee_id():
                        counter = 1
                        while True:
                            new_id = f"NEW{counter:03d}"
                            if not Employee.objects.filter(employee_id=new_id).exists():
                                return new_id
                            counter += 1
                            if counter > 999:  # Safety limit
                                return f"NEW{int(time.time())}"  # Fallback to timestamp
                    
                    import time
                    unique_employee_id = generate_unique_employee_id()
                    
                    employee = Employee.objects.create(
                        # Basic Information
                        employee_id=unique_employee_id,
                        name=row['name'].strip(),
                        position='New Employee',  # Default position
                        department=default_department,
                        
                        # Personal Information
                        dob=date(1990, 1, 1),  # Default DOB - should be updated later
                        doj=date.today(),  # Date of joining = today
                        
                        # Financial Information
                        pan='ABCDE1234F',  # Default PAN - should be updated later
                        bank_account='1234567890',  # Default bank account - should be updated later
                        bank_ifsc='ABCD0123456',  # Default IFSC - should be updated later
                        pay_mode='NEFT',
                        
                        # Additional Information
                        location='Office',  # Default location
                        
                        # Email and Login
                        email=row['system_email'].strip(),
                        personal_email=row['personal_email'].strip(),
                        password=row['password'].strip(),
                        
                        # Salary Information
                        lpa=0,  # Default salary - should be updated later
                    )
                    print(f"Created new employee: {employee.name} ({employee.email})")
                
                # Update employee with new credentials
                if 'personal_email' in row and pd.notna(row['personal_email']):
                    employee.personal_email = row['personal_email']
                if 'password' in row and pd.notna(row['password']):
                    employee.password = row['password']
                if 'system_email' in row and pd.notna(row['system_email']):
                    employee.email = row['system_email']
                
                employee.save()
                
                # Send welcome email
                success, message = email_service.send_welcome_email(employee)
                
                if success:
                    emails_sent += 1
                else:
                    errors.append(f"Row {index + 1}: {message}")
                
                processed_count += 1
                
            except Exception as e:
                errors.append(f"Row {index + 1}: {str(e)}")
        
        return Response({
            'success': True,
            'message': f'Processed {processed_count} employees, sent {emails_sent} welcome emails',
            'processed_count': processed_count,
            'emails_sent': emails_sent,
            'new_employees_created': processed_count - len([e for e in errors if 'not found' not in e]),
            'errors': errors
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error processing file: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def process_welcome_email_excel(request):
    """
    Simple test endpoint for welcome email without authentication
    """
    try:
        manual_data = {
            'name': request.data.get('name', 'Test User'),
            'personal_email': request.data.get('personal_email', 'test@example.com'),
            'password': request.data.get('password', 'TestPass123!'),
            'system_email': request.data.get('system_email', 'test@blackroth.co.in')
        }

        # Create test employee object
        class TestEmployee:
            def __init__(self, name, email, personal_email, password, employee_id):
                self.name = name
                self.email = email
                self.personal_email = personal_email
                self.password = password
                self.employee_id = employee_id

        test_employee = TestEmployee(
            name=manual_data['name'],
            email=manual_data['system_email'],
            personal_email=manual_data['personal_email'],
            password=manual_data['password'],
            employee_id='TEST001'
        )

        # Send email
        from .email_service import EmployeeEmailService
        email_service = EmployeeEmailService()
        success, message = email_service.send_welcome_email(test_employee)

        return Response({
            'success': success,
            'message': message,
            'test_data': manual_data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def send_relieving_letter(request):
    """
    Send relieving letter and experience letter emails with PDF attachments.
    """
    try:
        employee_name = request.data.get('employee_name')
        recipient_email = request.data.get('recipient_email')
        relieving_letter_file = request.FILES.get('relieving_letter')
        experience_letter_file = request.FILES.get('experience_letter')

        if not employee_name:
            return Response({
                'success': False,
                'message': 'Employee name is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not recipient_email:
            return Response({
                'success': False,
                'message': 'Recipient email is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not relieving_letter_file:
            return Response({
                'success': False,
                'message': 'Relieving letter PDF file is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not experience_letter_file:
            return Response({
                'success': False,
                'message': 'Experience letter PDF file is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate file types
        if not relieving_letter_file.name.lower().endswith('.pdf') or not experience_letter_file.name.lower().endswith('.pdf'):
            return Response({
                'success': False,
                'message': 'Only PDF files are allowed for both documents'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate file sizes (max 10MB each)
        if relieving_letter_file.size > 10 * 1024 * 1024 or experience_letter_file.size > 10 * 1024 * 1024:
            return Response({
                'success': False,
                'message': 'Each file size must be less than 10MB'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Send emails
        from .email_service import EmployeeEmailService
        email_service = EmployeeEmailService()
        success, message = email_service.send_relieving_and_experience_letters(
            employee_name=employee_name,
            recipient_email=recipient_email,
            relieving_letter_file=relieving_letter_file,
            experience_letter_file=experience_letter_file
        )

        return Response({
            'success': success,
            'message': message
        }, status=status.HTTP_200_OK if success else status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
