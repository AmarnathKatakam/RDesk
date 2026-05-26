"""
Payslip Generation Views — Milestone 1 hardened

Changes vs original:
  - download_payslip: enforces is_released + employee ownership
  - bulk_generate_payslips: runs validation engine, blocks on ERRORs
  - payslip_stats: uses ORM aggregation (no more O(n) Python loops)
  - validate_payroll endpoint: dry-run validation without generating
  - audit logging on generate, release, download, email
"""
import os
import zipfile

from django.conf import settings
from django.db.models import Count
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from employees.models import Employee, MonthlySalaryData

from .audit import log_payroll_action
from .models import Payslip, PayslipGenerationTask
from .serializers import PayslipSerializer, PayslipGenerationTaskSerializer


class IsAuthenticatedOrEmployeeSession(BasePermission):
    """Allow access to JWT-authenticated admins OR session-based employees."""
    def has_permission(self, request, view):
        if request.user and request.user.is_authenticated:
            return True
        if request.session and request.session.get('employee_id'):
            return True
        return False


class PayslipDownloadThrottle(UserRateThrottle):
    """Scoped throttle for payslip downloads — 30 requests per minute per user."""
    scope = 'payslip_download'


from .tasks import generate_all_payslips
from .utils import PayslipFileManager
from .validation import issues_to_dict, persist_issues, run_payroll_validation


# ─── HTML preview (visual validation) ────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticatedOrEmployeeSession])
def payslip_html_preview(request, payslip_id):
    """
    GET /api/payslips/<id>/preview/
    Returns the raw HTML that would be rendered to PDF.
    Admins can preview any payslip. Employees can preview only their own
    released payslips.
    """
    from django.http import HttpResponse
    from .frontend_pdf_generator import FrontendPDFGenerator

    try:
        payslip = Payslip.objects.select_related(
            'employee', 'employee__department',
            'employee__bank_detail__bank',
            'employee__pf_detail',
        ).get(id=payslip_id)
    except Payslip.DoesNotExist:
        return Response({'success': False, 'message': 'Payslip not found'}, status=404)

    session_emp_id = _session_employee_id(request)
    is_admin_request = _is_admin(request) and not session_emp_id

    if session_emp_id:
        if str(payslip.employee_id) != str(session_emp_id):
            return Response(
                {'success': False, 'message': 'You are not authorised to view this payslip.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not payslip.is_released:
            return Response(
                {'success': False, 'message': 'This payslip has not been released yet.'},
                status=status.HTTP_403_FORBIDDEN,
            )
    elif not is_admin_request:
        return Response({'success': False, 'message': 'Unauthorised.'}, status=status.HTTP_401_UNAUTHORIZED)

    html = FrontendPDFGenerator().generate_html_preview(payslip)
    return HttpResponse(html, content_type='text/html; charset=utf-8')


# ─── Helper ───────────────────────────────────────────────────────────────────

def _is_admin(request) -> bool:
    """True if the request comes from an authenticated admin/JWT user."""
    return bool(getattr(request.user, 'is_authenticated', False))


def _session_employee_id(request):
    """Return the employee_id stored in the session, or None."""
    return request.session.get('employee_id')


# ─── Admin-facing list / detail ───────────────────────────────────────────────

@method_decorator(csrf_exempt, name='dispatch')
class PayslipListView(generics.ListAPIView):
    """List all payslips (admin only)."""
    queryset = Payslip.objects.all().select_related('employee', 'generated_by')
    serializer_class = PayslipSerializer
    permission_classes = [IsAuthenticated]


class PayslipDetailView(generics.RetrieveAPIView):
    """Retrieve a single payslip (admin only)."""
    queryset = Payslip.objects.all()
    serializer_class = PayslipSerializer
    permission_classes = [IsAuthenticated]


# ─── Secure download ──────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticatedOrEmployeeSession])
@throttle_classes([PayslipDownloadThrottle])
def download_payslip(request, payslip_id):
    """
    Secure payslip PDF download.

    Rules:
      - Admin (JWT-authenticated): can download any payslip regardless of release status.
      - Employee (session): can only download their own released payslips.
      - Returns 403 if employee tries to access another employee's payslip.
      - Returns 403 if payslip is not released and requester is an employee.
      - Returns 404 if file is missing on disk.
    """
    try:
        payslip = Payslip.objects.select_related('employee').get(id=payslip_id)
    except Payslip.DoesNotExist:
        return Response({'success': False, 'message': 'Payslip not found'}, status=status.HTTP_404_NOT_FOUND)

    session_emp_id = _session_employee_id(request)
    is_admin_request = _is_admin(request) and not session_emp_id

    if session_emp_id:
        # Employee session — enforce ownership
        if str(payslip.employee_id) != str(session_emp_id):
            return Response(
                {'success': False, 'message': 'You are not authorised to download this payslip.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Enforce release gate for employees
        if not payslip.is_released:
            return Response(
                {'success': False, 'message': 'This payslip has not been released yet.'},
                status=status.HTTP_403_FORBIDDEN,
            )
    elif not is_admin_request:
        return Response({'success': False, 'message': 'Unauthorised.'}, status=status.HTTP_401_UNAUTHORIZED)

    # Resolve file path
    file_manager = PayslipFileManager()
    try:
        resolved = file_manager._resolve_pdf_path(payslip.pdf_path)
    except Exception:
        resolved = os.path.join(settings.MEDIA_ROOT, payslip.pdf_path)

    if not os.path.exists(resolved):
        return Response({'success': False, 'message': 'Payslip file not found on server.'}, status=status.HTTP_404_NOT_FOUND)

    # Audit log
    log_payroll_action(
        action='DOWNLOAD',
        performed_by=request.user if is_admin_request else None,
        payslip=payslip,
        notes=f"Downloaded by {'admin' if is_admin_request else 'employee'}",
    )

    response = FileResponse(open(resolved, 'rb'), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{payslip.filename}"'
    return response


# ─── Bulk generation ──────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_generate_payslips(request):
    """
    Bulk payslip generation with pre-generation validation.

    Accepts:
      {
        "employee_ids": [1, 2, 3],
        "pay_period": {"month": "March", "year": 2026},
        "salary_method": "SALARY",
        "force": false   // set true to proceed despite WARNING issues
      }

    Blocks on ERROR-level validation issues.
    Returns validation issues in response when blocked.
    """
    employee_ids = request.data.get('employee_ids', [])
    pay_period = request.data.get('pay_period', {})
    salary_method = request.data.get('salary_method', 'SALARY')
    force = bool(request.data.get('force', False))

    if not employee_ids:
        return Response({'success': False, 'message': 'employee_ids is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if not pay_period.get('month') or not pay_period.get('year'):
        return Response({'success': False, 'message': 'pay_period.month and pay_period.year are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if salary_method not in ['SALARY', 'STIPEND']:
        return Response({'success': False, 'message': 'salary_method must be SALARY or STIPEND.'}, status=status.HTTP_400_BAD_REQUEST)

    employees = Employee.objects.filter(id__in=employee_ids, is_active=True)
    if employees.count() != len(employee_ids):
        return Response({'success': False, 'message': 'Some employees not found or inactive.'}, status=status.HTTP_400_BAD_REQUEST)

    month = pay_period['month']
    year = int(pay_period['year'])

    # ── Run validation ────────────────────────────────────────────────────────
    issues = run_payroll_validation(employee_ids, month, year, salary_type=salary_method)
    errors = [i for i in issues if i.severity == 'ERROR']
    warnings = [i for i in issues if i.severity == 'WARNING']

    if errors:
        # Persist issues for audit trail
        persist_issues(issues)
        log_payroll_action(
            action='VALIDATE',
            performed_by=request.user,
            pay_period_month=month,
            pay_period_year=year,
            notes=f"Blocked: {len(errors)} ERROR(s) found before generation.",
        )
        return Response({
            'success': False,
            'message': f'Payroll generation blocked: {len(errors)} error(s) must be resolved first.',
            'errors': issues_to_dict(errors),
            'warnings': issues_to_dict(warnings),
        }, status=status.HTTP_400_BAD_REQUEST)

    if warnings and not force:
        # Return warnings and ask frontend to confirm with force=true
        return Response({
            'success': False,
            'blocked_by_warnings': True,
            'message': f'{len(warnings)} warning(s) found. Set force=true to proceed.',
            'warnings': issues_to_dict(warnings),
        }, status=status.HTTP_400_BAD_REQUEST)

    # Persist any warnings before proceeding
    if warnings:
        persist_issues(warnings)

    try:
        task_id = generate_all_payslips(employee_ids, pay_period, salary_method, request.user.id)

        log_payroll_action(
            action='GENERATE',
            performed_by=request.user,
            pay_period_month=month,
            pay_period_year=year,
            notes=f"Bulk generation task {task_id} for {len(employee_ids)} employee(s).",
        )

        return Response({
            'success': True,
            'message': 'Payslip generation completed.',
            'task_id': task_id,
            'warnings': issues_to_dict(warnings),
        }, status=status.HTTP_200_OK)

    except Exception as exc:
        return Response({'success': False, 'message': f'Generation error: {exc}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─── Validate-only (dry run) ──────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def validate_payroll(request):
    """
    Dry-run validation — checks all employees without generating payslips.
    Returns errors and warnings without persisting anything.
    """
    employee_ids = request.data.get('employee_ids', [])
    pay_period = request.data.get('pay_period', {})
    salary_method = request.data.get('salary_method', 'SALARY')

    if not employee_ids or not pay_period.get('month') or not pay_period.get('year'):
        return Response({'success': False, 'message': 'employee_ids, pay_period.month and pay_period.year are required.'}, status=status.HTTP_400_BAD_REQUEST)

    month = pay_period['month']
    year = int(pay_period['year'])

    issues = run_payroll_validation(employee_ids, month, year, salary_type=salary_method)
    errors = [i for i in issues if i.severity == 'ERROR']
    warnings = [i for i in issues if i.severity == 'WARNING']

    return Response({
        'success': True,
        'can_generate': len(errors) == 0,
        'error_count': len(errors),
        'warning_count': len(warnings),
        'errors': issues_to_dict(errors),
        'warnings': issues_to_dict(warnings),
    })


# ─── Generation status ────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_generation_status(request, task_id):
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
            'is_complete': task.is_complete,
        })
    except PayslipGenerationTask.DoesNotExist:
        return Response({'success': False, 'message': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)


# ─── Monthly ZIP download (admin) ─────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_monthly_payslips(request, year, month):
    payslips = Payslip.objects.filter(pay_period_year=year, pay_period_month=month)
    if not payslips.exists():
        return Response({'success': False, 'message': 'No payslips found for the specified month.'}, status=status.HTTP_404_NOT_FOUND)

    zip_filename = f"payslips_{month}_{year}.zip"
    zip_path = os.path.join(settings.MEDIA_ROOT, 'temp', zip_filename)
    os.makedirs(os.path.dirname(zip_path), exist_ok=True)

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for payslip in payslips:
            file_path = os.path.join(settings.MEDIA_ROOT, payslip.pdf_path)
            if os.path.exists(file_path):
                zipf.write(file_path, payslip.filename)

    response = FileResponse(open(zip_path, 'rb'), content_type='application/zip')
    response['Content-Disposition'] = f'attachment; filename="{zip_filename}"'
    return response


# ─── File list ────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_payslip_files(request, year, month):
    payslips = Payslip.objects.filter(pay_period_year=year, pay_period_month=month).select_related('employee')
    files = []
    for payslip in payslips:
        file_path = os.path.join(settings.MEDIA_ROOT, payslip.pdf_path)
        files.append({
            'id': payslip.id,
            'filename': payslip.filename,
            # raw path omitted — use download_url for all file access
            'download_url': f'/api/payslips/{payslip.id}/download/',
            'size': os.path.getsize(file_path) if os.path.exists(file_path) else 0,
            'created_at': payslip.generated_at,
            'employee_name': payslip.employee.name,
            'employee_id': payslip.employee.employee_id,
            'is_released': payslip.is_released,
        })
    return Response({'success': True, 'data': files})


# ─── Send selected payslips ───────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_selected_payslips(request):
    payslip_ids = request.data.get('payslip_ids', [])
    override_emails = request.data.get('override_emails', {}) or {}

    if not isinstance(payslip_ids, list) or not payslip_ids:
        return Response({'success': False, 'message': 'payslip_ids must be a non-empty list.'}, status=status.HTTP_400_BAD_REQUEST)

    payslips = Payslip.objects.filter(id__in=payslip_ids).select_related('employee')
    if payslips.count() != len(payslip_ids):
        return Response({'success': False, 'message': 'Some payslips not found.'}, status=status.HTTP_400_BAD_REQUEST)

    file_manager = PayslipFileManager()
    results = []
    sent = failed = 0

    for p in payslips:
        original_email = getattr(p.employee, 'email', None)
        temp_email = override_emails.get(str(p.id)) or override_emails.get(p.id)
        if temp_email:
            setattr(p.employee, 'email', temp_email)

        ok = False
        try:
            ok = file_manager.send_payslip_email(p)
        except Exception:
            ok = False

        if temp_email:
            setattr(p.employee, 'email', original_email)

        log_payroll_action(
            action='EMAIL_SENT' if ok else 'EMAIL_FAILED',
            performed_by=request.user,
            payslip=p,
            notes=f"Sent to {temp_email or original_email}",
        )

        results.append({'payslip_id': p.id, 'employee_name': p.employee.name, 'email': temp_email or original_email, 'sent': bool(ok)})
        if ok:
            sent += 1
        else:
            failed += 1

    return Response({'success': True, 'sent': sent, 'failed': failed, 'results': results})


# ─── Stats (ORM-based, no more O(n) loops) ────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payslip_stats(request):
    total_payslips = Payslip.objects.count()

    by_month_qs = (
        Payslip.objects
        .values('pay_period_month', 'pay_period_year')
        .annotate(count=Count('id'))
        .order_by('-pay_period_year', 'pay_period_month')
    )
    by_month = {
        f"{row['pay_period_month']} {row['pay_period_year']}": row['count']
        for row in by_month_qs
    }

    by_type_qs = (
        Payslip.objects
        .values('salary_type')
        .annotate(count=Count('id'))
    )
    by_salary_type = {row['salary_type']: row['count'] for row in by_type_qs}

    released_count = Payslip.objects.filter(is_released=True).count()

    return Response({
        'success': True,
        'data': {
            'total_payslips': total_payslips,
            'released_payslips': released_count,
            'unreleased_payslips': total_payslips - released_count,
            'by_month': by_month,
            'by_salary_type': by_salary_type,
        },
    })


# ─── Audit log viewer (admin) ─────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_audit_logs(request):
    """
    Return recent payroll audit log entries.
    Optional query params: month, year, employee_id, action
    """
    from .models import PayrollAuditLog

    qs = PayrollAuditLog.objects.select_related('performed_by', 'employee', 'payslip').order_by('-timestamp')

    month = request.GET.get('month')
    year = request.GET.get('year')
    emp_id = request.GET.get('employee_id')
    action = request.GET.get('action')

    if month:
        qs = qs.filter(pay_period_month=month)
    if year:
        qs = qs.filter(pay_period_year=year)
    if emp_id:
        qs = qs.filter(employee__employee_id=emp_id)
    if action:
        qs = qs.filter(action=action)

    logs = qs[:200]
    data = [
        {
            'id': log.id,
            'action': log.action,
            'performed_by': log.performed_by.username if log.performed_by else 'system',
            'employee': log.employee.name if log.employee else None,
            'employee_id': log.employee.employee_id if log.employee else None,
            'payslip_id': log.payslip_id,
            'pay_period_month': log.pay_period_month,
            'pay_period_year': log.pay_period_year,
            'notes': log.notes,
            'timestamp': log.timestamp.isoformat(),
        }
        for log in logs
    ]
    return Response({'success': True, 'logs': data, 'count': len(data)})


# ─── Validation issues viewer (admin) ────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_validation_issues(request):
    """
    Return persisted validation issues.
    Optional query params: month, year, severity, resolved
    """
    from .models import PayrollValidationIssue

    qs = PayrollValidationIssue.objects.select_related('employee').order_by('-created_at')

    month = request.GET.get('month')
    year = request.GET.get('year')
    severity = request.GET.get('severity')
    resolved = request.GET.get('resolved')

    if month:
        qs = qs.filter(pay_period_month=month)
    if year:
        qs = qs.filter(pay_period_year=year)
    if severity:
        qs = qs.filter(severity=severity.upper())
    if resolved is not None:
        qs = qs.filter(resolved=(resolved.lower() == 'true'))

    issues = qs[:500]
    data = [
        {
            'id': i.id,
            'employee_name': i.employee.name,
            'employee_id': i.employee.employee_id,
            'issue_type': i.issue_type,
            'severity': i.severity,
            'message': i.message,
            'resolved': i.resolved,
            'pay_period_month': i.pay_period_month,
            'pay_period_year': i.pay_period_year,
            'created_at': i.created_at.isoformat(),
        }
        for i in issues
    ]
    return Response({'success': True, 'issues': data, 'count': len(data)})
