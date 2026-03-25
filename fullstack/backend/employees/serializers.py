from rest_framework import serializers
from datetime import date, timedelta
import logging
from django.apps import apps
from django.conf import settings
from django.core.mail import send_mail
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.utils import timezone
from .models import Employee, SalaryStructure, MonthlySalaryData, EmployeeInvitation
from departments.models import Department


class DepartmentSerializer(serializers.ModelSerializer):
    """
    Simple department serializer for employee views.
    """
    class Meta:
        model = Department
        fields = ['id', 'department_code', 'department_name']


class EmployeeSerializer(serializers.ModelSerializer):
    """
    Serializer for Employee model.
    """
    employee_id = serializers.RegexField(
        regex=r'^[A-Za-z0-9]+$',
        max_length=20,
        error_messages={
            'invalid': 'Employee ID must contain only letters and numbers.',
        },
    )
    department = DepartmentSerializer(read_only=True)
    department_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    shift = serializers.SerializerMethodField(read_only=True)
    shift_name = serializers.CharField(source='shift.name', read_only=True)
    shift_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    shift_assignment_status = serializers.SerializerMethodField(read_only=True)
    invitation = serializers.SerializerMethodField(read_only=True)
    dob = serializers.DateField(input_formats=['%d-%m-%Y', '%Y-%m-%d'], required=False, allow_null=True)
    doj = serializers.DateField(input_formats=['%d-%m-%Y', '%Y-%m-%d'], required=False, allow_null=True)
    
    class Meta:
        model = Employee
        fields = [
            'id',
            'employee_id',
            'name',
            'position',
            'department',
            'department_id',
            'shift',
            'shift_name',
            'shift_id',
            'shift_assignment_status',
            'dob',
            'doj',
            'pan',
            'pf_number',
            'bank_account',
            'bank_ifsc',
            'pay_mode',
            'location',
            'health_card_no',
            'email',
            'personal_email',
            'password',
            'password_changed',
            'password_set_date',
            'lpa',
            'is_active',
            'account_activated',
            'onboarding_completed',
            'invitation',
            'created_at',
            'updated_at'
        ]
        read_only_fields = [
            'id',
            'password_changed',
            'password_set_date',
            'account_activated',
            'onboarding_completed',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'position': {'required': False, 'allow_blank': True},
            'dob': {'required': False, 'allow_null': True},
            'pan': {'required': False, 'allow_blank': True},
            'pf_number': {'required': False, 'allow_blank': True, 'allow_null': True},
            'bank_account': {'required': False, 'allow_blank': True},
            'bank_ifsc': {'required': False, 'allow_blank': True},
            'health_card_no': {'required': False, 'allow_blank': True, 'allow_null': True},
            'email': {'required': True, 'allow_blank': False, 'allow_null': False},
            'personal_email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'password': {'write_only': True, 'required': False, 'allow_blank': True, 'allow_null': True},
            'lpa': {'required': False, 'allow_null': True},
        }

    def get_invitation(self, obj):
        invitation = getattr(obj, 'invitation', None)
        if not invitation:
            return None
        return {
            'status': invitation.status,
            'created_at': invitation.created_at,
            'expires_at': invitation.expires_at,
            'activated_at': invitation.activated_at,
        }

    def get_shift(self, obj):
        if not getattr(obj, 'shift', None):
            return None
        return {
            'id': obj.shift.id,
            'name': obj.shift.name,
        }

    def get_shift_assignment_status(self, obj):
        return 'Shift Assigned' if getattr(obj, 'shift_id', None) else 'Not Assigned'
    
    def validate_employee_id(self, value):
        normalized = value.strip().upper()
        if self.instance:
            if Employee.objects.filter(employee_id=normalized).exclude(id=self.instance.id).exists():
                raise serializers.ValidationError("Employee ID already exists.")
        else:
            if Employee.objects.filter(employee_id=normalized).exists():
                raise serializers.ValidationError("Employee ID already exists.")
        return normalized
    
    def validate_department_id(self, value):
        """
        Validate department exists and is active.
        """
        try:
            department = Department.objects.get(id=value, is_active=True)
        except Department.DoesNotExist:
            raise serializers.ValidationError("Invalid department ID.")
        
        return value

    def validate_shift_id(self, value):
        if value in (None, ''):
            return None

        Shift = apps.get_model('attendance', 'Shift')
        if not Shift.objects.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError("Invalid shift ID.")
        return value

    def validate_email(self, value):
        if not value:
            raise serializers.ValidationError("Official email is required.")
        normalized = value.strip().lower()
        if not normalized.endswith('@blackroth.in'):
            raise serializers.ValidationError("Official email must end with @blackroth.in.")
        return normalized

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance is None:
            required_fields = ['employee_id', 'name', 'email', 'location', 'doj']
            missing = [field for field in required_fields if not attrs.get(field)]
            # personal_email is required on create so invitation can be delivered
            if not (attrs.get('personal_email') or '').strip():
                missing.append('personal_email')
            if missing:
                raise serializers.ValidationError({
                    field: ["This field is required."]
                    for field in missing
                })
        return attrs

    def _get_default_department(self):
        department = Department.objects.filter(is_active=True).first()
        if department:
            return department

        # Bootstrap a default department so admin can create employees with minimal fields.
        department, _ = Department.objects.get_or_create(
            department_code='GEN001',
            defaults={
                'department_name': 'General',
                'description': 'Auto-created default department',
                'is_active': True,
            }
        )
        if not department.is_active:
            department.is_active = True
            department.save(update_fields=['is_active'])
        return department

    def _default_pan(self, employee_id: str) -> str:
        digits = ''.join(ch for ch in employee_id if ch.isdigit())[-4:].rjust(4, '0')
        suffix = next((ch for ch in reversed(employee_id) if ch.isalpha()), 'A')
        return f"AAAAA{digits}{suffix.upper()}"

    def _default_bank_account(self, employee_id: str) -> str:
        digits = ''.join(ch for ch in employee_id if ch.isdigit())[-10:].rjust(10, '0')
        return digits

    def _send_activation_invitation(self, employee: Employee, token: str):
        # Prefer personal email; fall back to system email if not set
        recipient = employee.personal_email or employee.email
        if not recipient:
            raise ValueError("Employee has no email address to send invitation to.")
        activation_link = f"{settings.FRONTEND_URL}/activate/{token}"
        subject = "RDesk Account Activation - BlackRoth"
        message = (
            f"Hello {employee.name},\n\n"
            "Your RDesk employee account has been created.\n"
            "Please activate your account and complete onboarding using this link:\n\n"
            f"{activation_link}\n\n"
            "This activation link expires in 48 hours.\n\n"
            "Regards,\nRDesk Team"
        )
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [recipient],
            fail_silently=False,
        )
    
    def create(self, validated_data):
        department_id = validated_data.pop('department_id', None)
        shift_id = validated_data.pop('shift_id', None)
        if department_id:
            department = Department.objects.get(id=department_id)
        else:
            department = self._get_default_department()

        validated_data['department'] = department
        employee_id = validated_data['employee_id'].upper()
        validated_data['employee_id'] = employee_id

        validated_data.setdefault('position', 'Employee')
        validated_data.setdefault('dob', date(1990, 1, 1))
        validated_data.setdefault('pan', self._default_pan(employee_id))
        validated_data.setdefault('bank_account', self._default_bank_account(employee_id))
        validated_data.setdefault('bank_ifsc', 'PEND0123456')
        validated_data.setdefault('pay_mode', 'NEFT')
        validated_data.setdefault('pf_number', '')
        validated_data.setdefault('health_card_no', '')
        validated_data.setdefault('account_activated', False)
        validated_data.setdefault('onboarding_completed', False)
        validated_data.setdefault('password', None)
        validated_data.setdefault('personal_email', None)

        existing_employee = Employee.objects.filter(employee_id=employee_id).first()
        if existing_employee:
            raise serializers.ValidationError({'employee_id': ['Employee ID already exists.']})

        employee = super().create(validated_data)

        token = EmployeeInvitation.generate_token()
        invitation, _ = EmployeeInvitation.objects.update_or_create(
            employee=employee,
            defaults={
                'email': employee.personal_email or employee.email,
                'token': token,
                'status': 'PENDING',
                'expires_at': timezone.now() + timedelta(hours=48),
                'activated_at': None,
            }
        )

        try:
            self._send_activation_invitation(employee, invitation.token)
        except Exception as exc:
            logging.getLogger('employees').error(
                "Failed to send activation invitation to %s: %s",
                employee.email,
                str(exc),
            )

        if shift_id is not None:
            self._assign_shift(employee, shift_id)

        return employee
    
    def update(self, instance, validated_data):
        """
        Update employee with department.
        """
        shift_id = validated_data.pop('shift_id', serializers.empty)
        if 'department_id' in validated_data:
            department_id = validated_data.pop('department_id')
            department = Department.objects.get(id=department_id)
            validated_data['department'] = department
        employee = super().update(instance, validated_data)
        if shift_id is not serializers.empty:
            self._assign_shift(employee, shift_id)
        return employee

    def _assign_shift(self, employee: Employee, shift_id: int | None):
        Shift = apps.get_model('attendance', 'Shift')
        EmployeeShiftAssignment = apps.get_model('attendance', 'EmployeeShiftAssignment')
        AttendanceRecord = apps.get_model('attendance', 'AttendanceRecord')

        today = timezone.localdate()
        request = self.context.get('request')
        assigned_by = (
            request.user
            if request and getattr(request, 'user', None) and request.user.is_authenticated
            else None
        )

        if shift_id is None:
            EmployeeShiftAssignment.objects.filter(
                employee=employee,
                is_active=True,
                effective_to__isnull=True,
            ).update(effective_to=today - timedelta(days=1))
            if employee.shift_id is not None:
                employee.shift = None
                employee.save(update_fields=['shift', 'updated_at'])
            return

        shift = Shift.objects.filter(id=shift_id, is_active=True).first()
        if not shift:
            raise serializers.ValidationError({'shift_id': ['Invalid shift ID.']})

        effective_from = employee.doj or today

        overlapping_assignments = EmployeeShiftAssignment.objects.filter(
            employee=employee,
            is_active=True,
            effective_from__lte=effective_from,
        ).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=effective_from))

        for existing in overlapping_assignments:
            if existing.shift_id == shift.id:
                if employee.shift_id != shift.id:
                    employee.shift = shift
                    employee.save(update_fields=['shift', 'updated_at'])
                return

            if existing.effective_from < effective_from:
                existing.effective_to = effective_from - timedelta(days=1)
                existing.save(update_fields=['effective_to', 'updated_at'])
            else:
                existing.is_active = False
                existing.effective_to = effective_from
                existing.save(update_fields=['is_active', 'effective_to', 'updated_at'])

        assignment = EmployeeShiftAssignment(
            employee=employee,
            shift=shift,
            effective_from=effective_from,
            is_active=True,
            assigned_by=assigned_by,
        )
        try:
            assignment.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'shift_id': exc.messages}) from exc
        assignment.save()

        if employee.shift_id != shift.id:
            employee.shift = shift
            employee.save(update_fields=['shift', 'updated_at'])

        AttendanceRecord.objects.filter(
            employee=employee,
            date__gte=effective_from,
            date__lte=today,
            shift__isnull=True,
        ).update(shift=shift)


class SalaryStructureSerializer(serializers.ModelSerializer):
    """
    Serializer for SalaryStructure model.
    """
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    employee_id = serializers.CharField(source='employee.employee_id', read_only=True)
    monthly_salary = serializers.ReadOnlyField()
    basic_salary = serializers.ReadOnlyField()
    hra = serializers.ReadOnlyField()
    da = serializers.ReadOnlyField()
    conveyance = serializers.ReadOnlyField()
    medical = serializers.ReadOnlyField()
    pf_employee = serializers.ReadOnlyField()
    pf_employer = serializers.ReadOnlyField()
    professional_tax = serializers.ReadOnlyField()
    special_allowance = serializers.ReadOnlyField()
    
    class Meta:
        model = SalaryStructure
        fields = [
            'id',
            'employee',
            'employee_name',
            'employee_id',
            'salary_type',
            'annual_ctc',
            'effective_from',
            'is_active',
            'monthly_salary',
            'basic_salary',
            'hra',
            'da',
            'conveyance',
            'medical',
            'pf_employee',
            'pf_employer',
            'professional_tax',
            'special_allowance',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_employee(self, value):
        """
        Validate employee exists and is active.
        """
        if not value.is_active:
            raise serializers.ValidationError("Employee is not active.")
        return value


class ExcelImportSerializer(serializers.Serializer):
    """
    Serializer for Excel import validation.
    """
    file = serializers.FileField()
    
    def validate_file(self, value):
        """
        Validate uploaded file.
        """
        if not value.name.endswith(('.xlsx', '.xls', '.csv')):
            raise serializers.ValidationError("File must be an Excel (.xlsx, .xls) or CSV file.")
        
        if value.size > 10 * 1024 * 1024:  # 10MB limit
            raise serializers.ValidationError("File size must be less than 10MB.")
        
        return value


class MonthlySalaryDataSerializer(serializers.ModelSerializer):
    """
    Serializer for MonthlySalaryData model.
    """
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    employee_id = serializers.CharField(source='employee.employee_id', read_only=True)
    total_earnings = serializers.ReadOnlyField()
    total_deductions = serializers.ReadOnlyField()
    net_pay = serializers.ReadOnlyField()
    uploaded_by_name = serializers.CharField(source='uploaded_by.username', read_only=True)
    
    class Meta:
        model = MonthlySalaryData
        fields = [
            'id',
            'employee',
            'employee_name',
            'employee_id',
            'month',
            'year',
            'basic',
            'hra',
            'da',
            'conveyance',
            'medical',
            'special_allowance',
            'pf_employee',
            'professional_tax',
            'pf_employer',
            'other_deductions',
            'salary_advance',
            'work_days',
            'days_in_month',
            'lop_days',
            'total_earnings',
            'total_deductions',
            'net_pay',
            'uploaded_at',
            'uploaded_by',
            'uploaded_by_name'
        ]
        read_only_fields = ['id', 'uploaded_at', 'uploaded_by']
    
    def validate_employee(self, value):
        """
        Validate employee exists and is active.
        """
        if not value.is_active:
            raise serializers.ValidationError("Employee is not active.")
        return value
    
    def validate(self, data):
        """
        Validate the salary data.
        """
        # Validate month format
        valid_months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ]
        if data.get('month') not in valid_months:
            raise serializers.ValidationError("Invalid month. Must be a full month name.")
        
        # Validate year
        if data.get('year') < 2020 or data.get('year') > 2030:
            raise serializers.ValidationError("Year must be between 2020 and 2030.")
        
        # Validate work days
        if data.get('work_days', 0) > data.get('days_in_month', 31):
            raise serializers.ValidationError("Work days cannot exceed days in month.")
        
        return data


class MonthlySalaryUploadSerializer(serializers.Serializer):
    """
    Serializer for monthly salary Excel upload.
    """
    file = serializers.FileField()
    month = serializers.CharField(max_length=20)
    year = serializers.IntegerField()
    
    def validate_file(self, value):
        """
        Validate uploaded file.
        """
        if not value.name.endswith(('.xlsx', '.xls')):
            raise serializers.ValidationError("File must be an Excel (.xlsx, .xls) file.")
        
        if value.size > 10 * 1024 * 1024:  # 10MB limit
            raise serializers.ValidationError("File size must be less than 10MB.")
        
        return value
    
    def validate_month(self, value):
        """
        Validate month format.
        """
        valid_months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ]
        if value not in valid_months:
            raise serializers.ValidationError("Invalid month. Must be a full month name.")
        return value
    
    def validate_year(self, value):
        """
        Validate year.
        """
        if value < 2020 or value > 2030:
            raise serializers.ValidationError("Year must be between 2020 and 2030.")
        return value
