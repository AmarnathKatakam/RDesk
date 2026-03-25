from rest_framework import serializers
from .models import Payslip, PayslipGenerationTask
from employees.serializers import EmployeeSerializer


class PayslipSerializer(serializers.ModelSerializer):
    """
    Serializer for Payslip model.
    """
    employee = EmployeeSerializer(read_only=True)
    generated_by_name = serializers.CharField(source='generated_by.full_name', read_only=True)
    filename = serializers.ReadOnlyField()
    file_path = serializers.ReadOnlyField()
    
    class Meta:
        model = Payslip
        fields = [
            'id',
            'employee',
            'pay_period_month',
            'pay_period_year',
            'salary_type',
            'work_days',
            'days_in_month',
            'lop_days',
            'basic',
            'hra',
            'da',
            'conveyance',
            'medical',
            'special_allowance',
            'pf_employee',
            'total_earnings',
            'professional_tax',
            'pf_employer',
            'other_deductions',
            'salary_advance',
            'total_deductions',
            'net_pay',
            'pdf_path',
            'qr_code_data',
            'generated_at',
            'generated_by_name',
            'filename',
            'file_path'
        ]
        read_only_fields = ['id', 'generated_at']


class PayslipGenerationTaskSerializer(serializers.ModelSerializer):
    """
    Serializer for PayslipGenerationTask model.
    """
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    progress_percentage = serializers.ReadOnlyField()
    is_complete = serializers.ReadOnlyField()
    time_remaining = serializers.ReadOnlyField()
    
    class Meta:
        model = PayslipGenerationTask
        fields = [
            'task_id',
            'status',
            'employee_ids',
            'pay_period_month',
            'pay_period_year',
            'salary_type',
            'total_employees',
            'completed_employees',
            'failed_employees',
            'current_batch',
            'total_batches',
            'batch_size',
            'errors',
            'started_at',
            'completed_at',
            'created_by_name',
            'progress_percentage',
            'is_complete',
            'time_remaining'
        ]
        read_only_fields = ['task_id', 'started_at', 'completed_at']
