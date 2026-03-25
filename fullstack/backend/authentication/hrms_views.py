"""
HRMS Advanced Modules Views
Handles Leave Management, Document Vault, Notifications, Directory, and CEODashboard
"""

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q, Count, F, ExpressionWrapper, FloatField, Sum as DjangoSum
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse, FileResponse
from django.core.files.storage import default_storage
from django.core.paginator import Paginator
import os
from datetime import datetime, timedelta, date
from decimal import Decimal

from employees.models import (
    Employee, LeaveRequest, LeaveType, EmployeeDocument,
    Notification, EmployeeAttendance
)
from authentication.models import AdminUser
from payslip_generation.models import Payslip
from departments.models import Department

DEFAULT_LEAVE_TYPES = [
    ("Earned Leave", 18),
    ("Sick Leave", 12),
    ("Casual Leave", 12),
]


def _ensure_default_leave_types():
    for name, max_days in DEFAULT_LEAVE_TYPES:
        LeaveType.objects.get_or_create(
            name=name,
            defaults={
                "max_days_per_year": max_days,
                "is_active": True,
            },
        )

# =====================================================
# LEAVE MANAGEMENT ENDPOINTS
# =====================================================

@require_http_methods(["POST"])
def apply_leave(request):
    """Employee applies for leave"""
    try:
        data = request.POST
        employee_id = request.session.get('employee_id')
        
        if not employee_id:
            return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
        
        employee = get_object_or_404(Employee, id=employee_id)
        leave_type = get_object_or_404(LeaveType, id=data.get('leave_type_id'))
        
        start_date = datetime.strptime(data.get('start_date'), '%Y-%m-%d').date()
        end_date = datetime.strptime(data.get('end_date'), '%Y-%m-%d').date()
        reason = data.get('reason', '')
        
        # Validation
        if start_date > end_date:
            return JsonResponse({'success': False, 'message': 'Start date cannot be after end date'})
        
        if start_date < timezone.now().date():
            return JsonResponse({'success': False, 'message': 'Cannot apply for past dates'})
        
        # Create leave request
        leave_request = LeaveRequest.objects.create(
            employee=employee,
            leave_type=leave_type,
            start_date=start_date,
            end_date=end_date,
            reason=reason,
            status='PENDING'
        )
        
        # Create notification for admin
        Notification.objects.create(
            employee=employee,
            notification_type='ANNOUNCEMENT',
            title=f'New Leave Request: {employee.name}',
            message=f'{employee.name} has applied for {leave_type.name} leave from {start_date} to {end_date}',
            related_id=leave_request.id
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Leave request submitted successfully',
            'leave_request_id': leave_request.id
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_http_methods(["GET"])
def get_my_leave_requests(request):
    """Get employee's leave requests"""
    try:
        employee_id = request.session.get('employee_id')
        
        if not employee_id:
            return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
        
        employee = get_object_or_404(Employee, id=employee_id)
        leave_requests = LeaveRequest.objects.filter(employee=employee).select_related('leave_type')
        
        data = [{
            'id': lr.id,
            'leave_type': lr.leave_type.name if lr.leave_type else 'N/A',
            'start_date': lr.start_date.isoformat(),
            'end_date': lr.end_date.isoformat(),
            'number_of_days': lr.number_of_days,
            'reason': lr.reason,
            'status': lr.status,
            'approved_date': lr.approved_date.isoformat() if lr.approved_date else None,
            'rejection_reason': lr.rejection_reason,
            'created_at': lr.created_at.isoformat(),
        } for lr in leave_requests]
        
        return JsonResponse({'success': True, 'leave_requests': data})
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_http_methods(["GET"])
def get_leave_types(request):
    """Get all active leave types"""
    try:
        _ensure_default_leave_types()
        leave_types = LeaveType.objects.filter(is_active=True)
        
        data = [{
            'id': lt.id,
            'name': lt.name,
            'max_days_per_year': lt.max_days_per_year
        } for lt in leave_types]
        
        return JsonResponse({'success': True, 'leave_types': data})
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_http_methods(["POST"])
def admin_approve_leave(request):
    """Admin approves a leave request"""
    try:
        admin_id = request.session.get('admin_id')
        
        if not admin_id:
            return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
        
        admin = get_object_or_404(AdminUser, id=admin_id)
        leave_request = get_object_or_404(LeaveRequest, id=request.POST.get('leave_request_id'))
        
        leave_request.status = 'APPROVED'
        leave_request.approved_by = admin
        leave_request.approved_date = timezone.now()
        leave_request.save()
        
        # Create notification for employee
        Notification.objects.create(
            employee=leave_request.employee,
            notification_type='LEAVE_APPROVED',
            title='Leave Approved',
            message=f'Your {leave_request.leave_type.name} leave from {leave_request.start_date} to {leave_request.end_date} has been approved.',
            related_id=leave_request.id
        )
        
        return JsonResponse({'success': True, 'message': 'Leave approved successfully'})
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_http_methods(["POST"])
def admin_reject_leave(request):
    """Admin rejects a leave request"""
    try:
        admin_id = request.session.get('admin_id')
        
        if not admin_id:
            return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
        
        admin = get_object_or_404(AdminUser, id=admin_id)
        leave_request = get_object_or_404(LeaveRequest, id=request.POST.get('leave_request_id'))
        rejection_reason = request.POST.get('rejection_reason', '')
        
        leave_request.status = 'REJECTED'
        leave_request.approved_by = admin
        leave_request.approved_date = timezone.now()
        leave_request.rejection_reason = rejection_reason
        leave_request.save()
        
        # Create notification for employee
        Notification.objects.create(
            employee=leave_request.employee,
            notification_type='LEAVE_REJECTED',
            title='Leave Rejected',
            message=f'Your {leave_request.leave_type.name} leave has been rejected. Reason: {rejection_reason}',
            related_id=leave_request.id
        )
        
        return JsonResponse({'success': True, 'message': 'Leave rejected successfully'})
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_http_methods(["GET"])
def admin_get_pending_leaves(request):
    """Admin views all pending leave requests"""
    try:
        admin_id = request.session.get('admin_id')
        
        if not admin_id:
            return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
        
        pending_leaves = LeaveRequest.objects.filter(status='PENDING').select_related('employee', 'leave_type')
        
        data = [{
            'id': lr.id,
            'employee_name': lr.employee.name,
            'employee_id': lr.employee.employee_id,
            'leave_type': lr.leave_type.name if lr.leave_type else 'N/A',
            'start_date': lr.start_date.isoformat(),
            'end_date': lr.end_date.isoformat(),
            'number_of_days': lr.number_of_days,
            'reason': lr.reason,
            'created_at': lr.created_at.isoformat(),
        } for lr in pending_leaves]
        
        return JsonResponse({'success': True, 'pending_leaves': data})
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


# =====================================================
# DOCUMENT VAULT ENDPOINTS
# =====================================================

@require_http_methods(["POST"])
def upload_document(request):
    """Employee uploads a document"""
    try:
        employee_id = request.session.get('employee_id')
        
        if not employee_id:
            return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
        
        employee = get_object_or_404(Employee, id=employee_id)
        
        if 'file' not in request.FILES:
            return JsonResponse({'success': False, 'message': 'No file provided'})
        
        file = request.FILES['file']
        doc_type = request.POST.get('document_type')
        doc_name = request.POST.get('document_name', file.name)
        
        # Validate file size (max 10MB)
        if file.size > 10 * 1024 * 1024:
            return JsonResponse({'success': False, 'message': 'File size exceeds 10MB limit'})
        
        document = EmployeeDocument.objects.create(
            employee=employee,
            document_type=doc_type,
            document_name=doc_name,
            file=file,
            visibility='EMPLOYEE_ONLY'
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Document uploaded successfully',
            'document_id': document.id
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_http_methods(["GET"])
def get_my_documents(request):
    """Get employee's documents"""
    try:
        employee_id = request.session.get('employee_id')
        
        if not employee_id:
            return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
        
        employee = get_object_or_404(Employee, id=employee_id)
        documents = EmployeeDocument.objects.filter(employee=employee)
        
        data = [{
            'id': doc.id,
            'document_type': doc.get_document_type_display(),
            'document_name': doc.document_name,
            'uploaded_at': doc.uploaded_at.isoformat(),
            'file_url': doc.file.url if doc.file else None
        } for doc in documents]
        
        return JsonResponse({'success': True, 'documents': data})
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_http_methods(["DELETE"])
def delete_document(request, doc_id):
    """Delete a document"""
    try:
        employee_id = request.session.get('employee_id')
        
        if not employee_id:
            return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
        
        document = get_object_or_404(EmployeeDocument, id=doc_id)
        
        if document.employee.id != int(employee_id):
            return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
        
        document.file.delete()
        document.delete()
        
        return JsonResponse({'success': True, 'message': 'Document deleted successfully'})
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_http_methods(["GET"])
def download_document(request, doc_id):
    """Download a document"""
    try:
        employee_id = request.session.get('employee_id')
        
        if not employee_id:
            return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
        
        document = get_object_or_404(EmployeeDocument, id=doc_id)
        
        if document.employee.id != int(employee_id):
            return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
        
        if not document.file:
            return JsonResponse({'success': False, 'message': 'File not found'}, status=404)
        
        response = FileResponse(document.file.open('rb'))
        response['Content-Disposition'] = f'attachment; filename="{document.document_name}"'
        return response
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


# =====================================================
# NOTIFICATION ENDPOINTS
# =====================================================

def _get_admin_leave_notification_reads(request) -> set[int]:
    raw_ids = request.session.get('admin_notification_reads', [])
    try:
        return {int(item) for item in raw_ids}
    except (TypeError, ValueError):
        return set()


def _set_admin_leave_notification_reads(request, values: set[int]) -> None:
    request.session['admin_notification_reads'] = sorted(values)
    request.session.modified = True


def _build_admin_notifications(request):
    read_ids = _get_admin_leave_notification_reads(request)
    pending_leaves = LeaveRequest.objects.filter(status='PENDING').select_related('employee', 'leave_type')[:50]

    notifications = []
    for leave in pending_leaves:
        leave_name = leave.leave_type.name if leave.leave_type else 'Leave'
        notifications.append({
            'id': leave.id,
            'type': 'LEAVE_REQUEST',
            'title': f'New Leave Request: {leave.employee.name}',
            'message': (
                f'{leave.employee.name} applied for {leave_name} '
                f'from {leave.start_date} to {leave.end_date}.'
            ),
            'is_read': leave.id in read_ids,
            'created_at': leave.created_at.isoformat(),
        })

    return notifications

@require_http_methods(["GET"])
def get_notifications(request):
    """Get employee or admin notifications"""
    try:
        employee_id = request.session.get('employee_id')
        admin_id = request.session.get('admin_id')

        if employee_id:
            employee = get_object_or_404(Employee, id=employee_id)
            notifications = Notification.objects.filter(employee=employee)[:50]

            data = [{
                'id': notif.id,
                'type': notif.notification_type,
                'title': notif.title,
                'message': notif.message,
                'is_read': notif.is_read,
                'created_at': notif.created_at.isoformat(),
            } for notif in notifications]

            return JsonResponse({'success': True, 'notifications': data})

        if admin_id:
            return JsonResponse({'success': True, 'notifications': _build_admin_notifications(request)})

        return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_http_methods(["GET"])
def get_unread_notification_count(request):
    """Get unread notification count for employee or admin"""
    try:
        employee_id = request.session.get('employee_id')
        admin_id = request.session.get('admin_id')

        if employee_id:
            employee = get_object_or_404(Employee, id=employee_id)
            count = Notification.objects.filter(employee=employee, is_read=False).count()
            return JsonResponse({'success': True, 'unread_count': count})

        if admin_id:
            count = sum(1 for item in _build_admin_notifications(request) if not item['is_read'])
            return JsonResponse({'success': True, 'unread_count': count})

        return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_http_methods(["POST"])
def mark_notification_as_read(request, notif_id):
    """Mark notification as read for employee or admin"""
    try:
        employee_id = request.session.get('employee_id')
        admin_id = request.session.get('admin_id')

        if employee_id:
            notification = get_object_or_404(Notification, id=notif_id)

            if notification.employee.id != int(employee_id):
                return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)

            notification.is_read = True
            notification.save()

            return JsonResponse({'success': True, 'message': 'Notification marked as read'})

        if admin_id:
            read_ids = _get_admin_leave_notification_reads(request)
            read_ids.add(int(notif_id))
            _set_admin_leave_notification_reads(request, read_ids)
            return JsonResponse({'success': True, 'message': 'Notification marked as read'})

        return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_http_methods(["POST"])
def mark_all_notifications_as_read(request):
    """Mark all notifications as read for employee or admin"""
    try:
        employee_id = request.session.get('employee_id')
        admin_id = request.session.get('admin_id')

        if employee_id:
            employee = get_object_or_404(Employee, id=employee_id)
            Notification.objects.filter(employee=employee, is_read=False).update(is_read=True)
            return JsonResponse({'success': True, 'message': 'All notifications marked as read'})

        if admin_id:
            pending_ids = {
                leave.id for leave in LeaveRequest.objects.filter(status='PENDING').only('id')
            }
            _set_admin_leave_notification_reads(request, pending_ids)
            return JsonResponse({'success': True, 'message': 'All notifications marked as read'})

        return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


# =====================================================
# EMPLOYEE DIRECTORY ENDPOINTS
# =====================================================

@require_http_methods(["GET"])
def get_employee_directory(request):
    """Get employee directory with search and filters"""
    try:
        # Get filter parameters
        search_query = request.GET.get('search', '')
        department_id = request.GET.get('department', '')
        location = request.GET.get('location', '')
        
        # Base queryset - only active employees
        employees = Employee.objects.filter(is_active=True).select_related('department')
        
        # Apply filters
        if search_query:
            employees = employees.filter(
                Q(name__icontains=search_query) | 
                Q(employee_id__icontains=search_query) |
                Q(email__icontains=search_query)
            )
        
        if department_id:
            employees = employees.filter(department_id=department_id)
        
        if location:
            employees = employees.filter(location__icontains=location)
        
        # Get unique locations for filter options
        locations = Employee.objects.filter(is_active=True).values_list('location', flat=True).distinct()
        
        # Prepare response data (hide sensitive info)
        data = [{
            'id': emp.id,
            'employee_id': emp.employee_id,
            'name': emp.name,
            'position': emp.position,
            'department': emp.department.department_name if emp.department else 'N/A',
            'location': emp.location,
            'profile_photo': emp.profile.profile_photo.url if hasattr(emp, 'profile') and emp.profile.profile_photo else None
        } for emp in employees[:100]]  # Limit to 100 results
        
        departments = list(Department.objects.filter(is_active=True).values('id', 'department_name'))
        
        return JsonResponse({
            'success': True,
            'employees': data,
            'departments': departments,
            'locations': list(locations)
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_http_methods(["GET"])
def get_employee_profile_for_directory(request, emp_id):
    """Get employee profile for directory view"""
    try:
        employee = get_object_or_404(Employee, id=emp_id, is_active=True)
        
        profile_data = {
            'id': employee.id,
            'employee_id': employee.employee_id,
            'name': employee.name,
            'position': employee.position,
            'department': employee.department.department_name if employee.department else 'N/A',
            'location': employee.location,
            'doj': employee.doj.isoformat(),
            'profile_photo': employee.profile.profile_photo.url if hasattr(employee, 'profile') and employee.profile.profile_photo else None,
            'phone': employee.profile.phone if hasattr(employee, 'profile') else None,
            'email': employee.email,
        }
        
        return JsonResponse({'success': True, 'employee': profile_data})
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


# =====================================================
# CEO DASHBOARD ENDPOINTS
# =====================================================

@require_http_methods(["GET"])
def get_dashboard_stats(request):
    """Get CEO dashboard statistics"""
    try:
        admin_id = request.session.get('admin_id')
        
        if not admin_id:
            return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
        
        today = timezone.now().date()
        
        # Employee statistics
        total_employees = Employee.objects.filter(is_active=True).count()
        active_employees = Employee.objects.filter(is_active=True, account_activated=True).count()
        
        # Attendance statistics
        present_today = EmployeeAttendance.objects.filter(
            date=today,
            sign_in_time__isnull=False
        ).values('employee').distinct().count()
        
        absent_today = total_employees - present_today
        
        # Leave statistics
        on_leave_today = LeaveRequest.objects.filter(
            start_date__lte=today,
            end_date__gte=today,
            status='APPROVED'
        ).values('employee').distinct().count()
        
        # Payroll statistics
        total_payroll = (
            Payslip.objects.filter(
                pay_period_month=today.strftime('%B'),
                pay_period_year=today.year
            ).aggregate(total=DjangoSum('net_pay'))['total']
            or Decimal('0')
        )

        avg_salary = (total_payroll / total_employees) if total_employees > 0 else Decimal('0')
        
        stats = {
            'total_employees': total_employees,
            'active_employees': active_employees,
            'present_today': present_today,
            'absent_today': absent_today,
            'on_leave_today': on_leave_today,
            'total_payroll': float(total_payroll),
            'average_salary': float(avg_salary),
        }
        
        return JsonResponse({'success': True, 'stats': stats})
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_http_methods(["GET"])
def get_attendance_graph_data(request):
    """Get attendance graph data for CEO dashboard"""
    try:
        admin_id = request.session.get('admin_id')
        
        if not admin_id:
            return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
        
        # Get last 30 days attendance data
        today = timezone.now().date()
        dates = [today - timedelta(days=i) for i in range(30)]
        dates.reverse()
        
        graph_data = []
        
        for date in dates:
            present = EmployeeAttendance.objects.filter(
                date=date,
                sign_in_time__isnull=False
            ).values('employee').distinct().count()
            
            total_active = Employee.objects.filter(is_active=True).count()
            absent = total_active - present
            
            graph_data.append({
                'date': date.isoformat(),
                'present': present,
                'absent': absent,
            })
        
        return JsonResponse({'success': True, 'graph_data': graph_data})
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_http_methods(["GET"])
def get_leave_stats(request):
    """Get leave statistics for CEO dashboard"""
    try:
        admin_id = request.session.get('admin_id')
        
        if not admin_id:
            return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
        
        total_requests = LeaveRequest.objects.count()
        approved = LeaveRequest.objects.filter(status='APPROVED').count()
        rejected = LeaveRequest.objects.filter(status='REJECTED').count()
        pending = LeaveRequest.objects.filter(status='PENDING').count()
        
        # Leave type distribution
        leave_by_type = {}
        leave_types = LeaveType.objects.all()
        for lt in leave_types:
            count = LeaveRequest.objects.filter(leave_type=lt).count()
            leave_by_type[lt.name] = count
        
        stats = {
            'total_requests': total_requests,
            'approved': approved,
            'rejected': rejected,
            'pending': pending,
            'by_type': leave_by_type,
        }
        
        return JsonResponse({'success': True, 'stats': stats})
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_http_methods(["GET"])
def get_department_payroll_distribution(request):
    """Get payroll distribution by department"""
    try:
        admin_id = request.session.get('admin_id')
        
        if not admin_id:
            return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
        
        today = timezone.now().date()
        
        distribution = []
        departments = Department.objects.filter(is_active=True)
        
        for dept in departments:
            payroll = Payslip.objects.filter(
                employee__department=dept,
                pay_period_month=today.strftime('%B'),
                pay_period_year=today.year
            ).aggregate(total=DjangoSum('net_pay'))['total']
            
            distribution.append({
                'department': dept.department_name,
                'payroll': float(payroll) if payroll else 0,
            })
        
        return JsonResponse({'success': True, 'distribution': distribution})
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


# =====================================================
# DASHBOARD COMPATIBILITY ENDPOINTS
# =====================================================

def _require_admin_session(request):
    """Return (admin_id, error_response)."""
    admin_id = request.session.get('admin_id')
    if not admin_id:
        return None, JsonResponse({'detail': 'Unauthorized'}, status=401)
    return admin_id, None


def _current_pay_period():
    today = timezone.now().date()
    return today.strftime('%B'), today.year, today


def _next_payroll_date(today: date) -> str:
    if today.month == 12:
        next_month = date(today.year + 1, 1, 1)
    else:
        next_month = date(today.year, today.month + 1, 1)
    return next_month.isoformat()


def _humanize_time_diff(dt):
    if not dt:
        return 'Recently'
    now = timezone.now()
    delta = now - dt
    seconds = int(delta.total_seconds())
    if seconds < 60:
        return 'Just now'
    minutes = seconds // 60
    if minutes < 60:
        return f'{minutes} minute{"s" if minutes != 1 else ""} ago'
    hours = minutes // 60
    if hours < 24:
        return f'{hours} hour{"s" if hours != 1 else ""} ago'
    days = hours // 24
    return f'{days} day{"s" if days != 1 else ""} ago'


def _build_dashboard_payload():
    month_name, year, today = _current_pay_period()

    total_employees = Employee.objects.filter(is_active=True).count()
    active_employees = Employee.objects.filter(is_active=True, account_activated=True).count()
    new_hires = Employee.objects.filter(
        is_active=True,
        doj__year=today.year,
        doj__month=today.month,
    ).count()

    present_today = EmployeeAttendance.objects.filter(
        date=today,
        sign_in_time__isnull=False
    ).values('employee').distinct().count()

    attendance_qs = EmployeeAttendance.objects.filter(
        date=today,
        sign_in_time__isnull=False
    )
    late_today = 0
    for record in attendance_qs:
        if record.sign_in_time and timezone.localtime(record.sign_in_time).time() > datetime.strptime('10:00', '%H:%M').time():
            late_today += 1

    absent_today = max(total_employees - present_today, 0)
    attendance_total = total_employees

    payroll_qs = Payslip.objects.filter(
        pay_period_month=month_name,
        pay_period_year=year,
    )
    processed_total = payroll_qs.aggregate(total=DjangoSum('net_pay'))['total'] or Decimal('0')
    pending_total = payroll_qs.filter(is_released=False).aggregate(total=DjangoSum('net_pay'))['total'] or Decimal('0')

    pending_leaves = LeaveRequest.objects.filter(status='PENDING').count()
    approved_leaves = LeaveRequest.objects.filter(
        status='APPROVED',
        approved_date__year=today.year,
        approved_date__month=today.month,
    ).count()

    activity_items = []

    recent_payslips = Payslip.objects.select_related('employee').order_by('-generated_at')[:4]
    for item in recent_payslips:
        activity_items.append({
            'id': f'payroll-{item.id}',
            'type': 'payroll',
            'title': 'Payslip generated',
            'description': f'{item.employee.name} - {item.pay_period_month} {item.pay_period_year}',
            'time': _humanize_time_diff(item.generated_at),
            '_ts': item.generated_at,
        })

    recent_joins = Employee.objects.filter(is_active=True).order_by('-created_at')[:4]
    for item in recent_joins:
        activity_items.append({
            'id': f'employee-{item.id}',
            'type': 'employee',
            'title': 'New employee added',
            'description': f'{item.name} joined {item.department.department_name}',
            'time': _humanize_time_diff(item.created_at),
            '_ts': item.created_at,
        })

    recent_leaves = LeaveRequest.objects.select_related('employee', 'leave_type').order_by('-created_at')[:4]
    for item in recent_leaves:
        leave_name = item.leave_type.name if item.leave_type else 'Leave'
        activity_items.append({
            'id': f'leave-{item.id}',
            'type': 'leave',
            'title': 'Leave request submitted',
            'description': f'{item.employee.name} - {leave_name} ({item.status.title()})',
            'time': _humanize_time_diff(item.created_at),
            '_ts': item.created_at,
        })

    recent_attendance = EmployeeAttendance.objects.select_related('employee').filter(
        date=today,
        sign_in_time__isnull=False
    ).order_by('-sign_in_time')[:4]
    for item in recent_attendance:
        activity_items.append({
            'id': f'attendance-{item.id}',
            'type': 'attendance',
            'title': 'Employee signed in',
            'description': f'{item.employee.name} at {timezone.localtime(item.sign_in_time).strftime("%I:%M %p")}',
            'time': _humanize_time_diff(item.sign_in_time),
            '_ts': item.sign_in_time,
        })

    activity_items.sort(key=lambda x: x['_ts'] or timezone.now(), reverse=True)
    recent_activity = [{k: v for k, v in item.items() if k != '_ts'} for item in activity_items[:10]]

    return {
        'employee_count': {
            'count': total_employees,
        },
        'employee_summary': {
            'total': total_employees,
            'active': active_employees,
            'new_hires': new_hires,
        },
        'payroll_month_summary': {
            'total': float(processed_total),
            'processed': float(processed_total),
            'pending': float(pending_total),
            'next_payroll_date': _next_payroll_date(today),
        },
        'leave_pending_count': {
            'count': pending_leaves,
        },
        'leave_overview': {
            'pending': pending_leaves,
            'approved': approved_leaves,
        },
        'attendance_today_summary': {
            'present': present_today,
            'absent': absent_today,
            'late': late_today,
            'total': attendance_total,
        },
        'dashboard_activity': recent_activity,
        'dashboard': {
            'employees': {
                'count': total_employees,
                'summary': {
                    'total': total_employees,
                    'active': active_employees,
                    'new_hires': new_hires,
                },
            },
            'payroll': {
                'month_summary': {
                    'total': float(processed_total),
                    'processed': float(processed_total),
                    'pending': float(pending_total),
                    'next_payroll_date': _next_payroll_date(today),
                }
            },
            'leaves': {
                'pending_count': pending_leaves,
                'overview': {
                    'pending': pending_leaves,
                    'approved': approved_leaves,
                }
            },
            'attendance': {
                'today_summary': {
                    'present': present_today,
                    'absent': absent_today,
                    'late': late_today,
                    'total': attendance_total,
                }
            },
            'activity': recent_activity,
        },
    }


@require_http_methods(["GET"])
def dashboard_employee_count(request):
    admin_id, error = _require_admin_session(request)
    if error:
        return error
    _ = admin_id
    payload = _build_dashboard_payload()
    return JsonResponse(payload['employee_count'])


@require_http_methods(["GET"])
def dashboard_employee_summary(request):
    admin_id, error = _require_admin_session(request)
    if error:
        return error
    _ = admin_id
    payload = _build_dashboard_payload()
    return JsonResponse(payload['employee_summary'])


@require_http_methods(["GET"])
def dashboard_payroll_month_summary(request):
    admin_id, error = _require_admin_session(request)
    if error:
        return error
    _ = admin_id
    payload = _build_dashboard_payload()
    return JsonResponse(payload['payroll_month_summary'])


@require_http_methods(["GET"])
def dashboard_leave_pending_count(request):
    admin_id, error = _require_admin_session(request)
    if error:
        return error
    _ = admin_id
    payload = _build_dashboard_payload()
    return JsonResponse(payload['leave_pending_count'])


@require_http_methods(["GET"])
def dashboard_leave_overview(request):
    admin_id, error = _require_admin_session(request)
    if error:
        return error
    _ = admin_id
    payload = _build_dashboard_payload()
    return JsonResponse(payload['leave_overview'])


@require_http_methods(["GET"])
def dashboard_attendance_today_summary(request):
    admin_id, error = _require_admin_session(request)
    if error:
        return error
    _ = admin_id
    payload = _build_dashboard_payload()
    return JsonResponse(payload['attendance_today_summary'])


@require_http_methods(["GET"])
def dashboard_activity(request):
    admin_id, error = _require_admin_session(request)
    if error:
        return error
    _ = admin_id
    payload = _build_dashboard_payload()
    return JsonResponse(payload['dashboard_activity'], safe=False)


@require_http_methods(["GET"])
def dashboard_overview(request):
    admin_id, error = _require_admin_session(request)
    if error:
        return error
    _ = admin_id
    payload = _build_dashboard_payload()
    return JsonResponse(payload['dashboard'])
