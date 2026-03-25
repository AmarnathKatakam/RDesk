import os
import zipfile
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.http import HttpResponse, FileResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import Payslip, PayslipGenerationTask
from .serializers import PayslipSerializer, PayslipGenerationTaskSerializer
from .tasks import generate_all_payslips
from employees.models import Employee, MonthlySalaryData
from .utils import PayslipFileManager


@method_decorator(csrf_exempt, name='dispatch')
class PayslipListView(generics.ListAPIView):
    """
    List all payslips.
    """
    queryset = Payslip.objects.all().select_related('employee', 'generated_by')
    serializer_class = PayslipSerializer
    permission_classes = [IsAuthenticated]


class PayslipDetailView(generics.RetrieveAPIView):
    """
    Retrieve a payslip.
    """
    queryset = Payslip.objects.all()
    serializer_class = PayslipSerializer
    permission_classes = [IsAuthenticated]


class PayslipGenerationTaskListView(generics.ListAPIView):
    """
    List all payslip generation tasks.
    """
    queryset = PayslipGenerationTask.objects.all().select_related('created_by')
    serializer_class = PayslipGenerationTaskSerializer
    permission_classes = [IsAuthenticated]


class PayslipGenerationTaskDetailView(generics.RetrieveAPIView):
    """
    Retrieve a payslip generation task.
    """
    queryset = PayslipGenerationTask.objects.all()
    serializer_class = PayslipGenerationTaskSerializer
    permission_classes = [IsAuthenticated]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_generate_payslips(request):
    """
    Start bulk payslip generation.
    """
    employee_ids = request.data.get('employee_ids', [])
    pay_period = request.data.get('pay_period', {})
    salary_method = request.data.get('salary_method', 'SALARY')
    
    # Validate input
    if not employee_ids:
        return Response({
            'success': False,
            'message': 'Employee IDs are required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if not pay_period.get('month') or not pay_period.get('year'):
        return Response({
            'success': False,
            'message': 'Pay period (month and year) is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if salary_method not in ['SALARY', 'STIPEND']:
        return Response({
            'success': False,
            'message': 'Salary method must be SALARY or STIPEND'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Validate employees exist and are active
    employees = Employee.objects.filter(
        id__in=employee_ids,
        is_active=True
    )
    
    if len(employees) != len(employee_ids):
        return Response({
            'success': False,
            'message': 'Some employees not found or inactive'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if monthly salary data exists for all employees for the specified month/year
    missing_salary_data = []
    for employee in employees:
        monthly_salary = MonthlySalaryData.objects.filter(
            employee=employee,
            month=pay_period['month'],
            year=pay_period['year']
        ).first()
        
        if not monthly_salary:
            missing_salary_data.append(employee.name)
    
    if missing_salary_data:
        return Response({
            'success': False,
            'message': f'Monthly salary data not found for the following employees for {pay_period["month"]} {pay_period["year"]}: {", ".join(missing_salary_data)}. Please upload salary data first.',
            'missing_employees': missing_salary_data
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # For now, run synchronously to avoid Celery issues
        # TODO: Re-enable Celery when Redis is properly configured
        task_id = generate_all_payslips(
            employee_ids,
            pay_period,
            salary_method,
            request.user.id
        )
        
        return Response({
            'success': True,
            'message': 'Payslip generation completed',
            'task_id': task_id
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error starting generation: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_generation_status(request, task_id):
    """
    Get payslip generation status.
    """
    try:
        task = PayslipGenerationTask.objects.get(task_id=task_id)
        
        return Response({
            'task_id': task.task_id,
            'status': task.status,
            'total': task.total_employees,
            'completed': task.completed_employees,
            'current_batch': task.current_batch,
            'total_batches': task.total_batches,
            'batch_size': task.batch_size,
            'time_remaining': task.time_remaining,
            'errors': task.errors,
            'is_complete': task.is_complete
        }, status=status.HTTP_200_OK)
        
    except PayslipGenerationTask.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Task not found'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_payslip(request, payslip_id):
    """
    Download individual payslip PDF.
    """
    try:
        payslip = Payslip.objects.get(id=payslip_id)
        file_path = os.path.join(settings.MEDIA_ROOT, payslip.pdf_path)
        
        if not os.path.exists(file_path):
            return Response({
                'success': False,
                'message': 'Payslip file not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        response = FileResponse(
            open(file_path, 'rb'),
            content_type='application/pdf'
        )
        response['Content-Disposition'] = f'attachment; filename="{payslip.filename}"'
        return response
        
    except Payslip.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Payslip not found'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_monthly_payslips(request, year, month):
    """
    Download all payslips for a month as ZIP file.
    """
    try:
        # Get payslips for the month
        payslips = Payslip.objects.filter(
            pay_period_year=year,
            pay_period_month=month
        )
        
        if not payslips.exists():
            return Response({
                'success': False,
                'message': 'No payslips found for the specified month'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Create ZIP file
        zip_filename = f"payslips_{month}_{year}.zip"
        zip_path = os.path.join(settings.MEDIA_ROOT, 'temp', zip_filename)
        
        # Create temp directory if it doesn't exist
        os.makedirs(os.path.dirname(zip_path), exist_ok=True)
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for payslip in payslips:
                file_path = os.path.join(settings.MEDIA_ROOT, payslip.pdf_path)
                if os.path.exists(file_path):
                    zipf.write(file_path, payslip.filename)
        
        # Return ZIP file
        response = FileResponse(
            open(zip_path, 'rb'),
            content_type='application/zip'
        )
        response['Content-Disposition'] = f'attachment; filename="{zip_filename}"'
        
        # Clean up temp file after response
        def cleanup():
            try:
                os.remove(zip_path)
            except:
                pass
        
        response.closed = cleanup
        return response
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error creating ZIP file: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_payslip_files(request, year, month):
    """
    Get list of payslip files for a month.
    """
    try:
        payslips = Payslip.objects.filter(
            pay_period_year=year,
            pay_period_month=month
        ).select_related('employee')
        
        files = []
        for payslip in payslips:
            file_path = os.path.join(settings.MEDIA_ROOT, payslip.pdf_path)
            files.append({
                'id': payslip.id,
                'filename': payslip.filename,
                'path': payslip.pdf_path,
                'size': os.path.getsize(file_path) if os.path.exists(file_path) else 0,
                'created_at': payslip.generated_at,
                'employee_name': payslip.employee.name,
                'employee_id': payslip.employee.employee_id
            })
        
        return Response({
            'success': True,
            'data': files
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error getting files: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_selected_payslips(request):
    """
    Send selected payslip PDFs to employees' emails.
    Accepts JSON: { payslip_ids: [int], override_emails?: { [payslip_id]: email } }
    """
    try:
        payslip_ids = request.data.get('payslip_ids', [])
        override_emails = request.data.get('override_emails', {}) or {}
        
        if not isinstance(payslip_ids, list) or not payslip_ids:
            return Response({
                'success': False,
                'message': 'payslip_ids must be a non-empty list'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        payslips = Payslip.objects.filter(id__in=payslip_ids).select_related('employee')
        if payslips.count() != len(payslip_ids):
            return Response({
                'success': False,
                'message': 'Some payslips not found'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        file_manager = PayslipFileManager()
        results = []
        sent = 0
        failed = 0
        
        for p in payslips:
            # Temporarily override email if provided
            original_email = getattr(p.employee, 'email', None)
            temp_email = override_emails.get(str(p.id)) or override_emails.get(p.id)
            if temp_email:
                setattr(p.employee, 'email', temp_email)
            
            ok = False
            try:
                ok = file_manager.send_payslip_email(p)
            except Exception as e:
                ok = False
            
            # restore original email
            if temp_email:
                setattr(p.employee, 'email', original_email)
            
            results.append({
                'payslip_id': p.id,
                'employee_name': p.employee.name,
                'email': temp_email or original_email,
                'sent': bool(ok)
            })
            if ok:
                sent += 1
            else:
                failed += 1
        
        return Response({
            'success': True,
            'sent': sent,
            'failed': failed,
            'results': results
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error sending payslips: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payslip_stats(request):
    """
    Get payslip generation statistics.
    """
    try:
        total_payslips = Payslip.objects.count()
        payslips_by_month = {}
        payslips_by_salary_type = {}
        
        # Count by month
        for payslip in Payslip.objects.all():
            month_key = f"{payslip.pay_period_month} {payslip.pay_period_year}"
            payslips_by_month[month_key] = payslips_by_month.get(month_key, 0) + 1
        
        # Count by salary type
        for payslip in Payslip.objects.all():
            payslips_by_salary_type[payslip.salary_type] = payslips_by_salary_type.get(payslip.salary_type, 0) + 1
        
        return Response({
            'success': True,
            'data': {
                'total_payslips': total_payslips,
                'by_month': payslips_by_month,
                'by_salary_type': payslips_by_salary_type
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error getting statistics: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)