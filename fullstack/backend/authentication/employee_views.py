from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.response import Response
from django.contrib.auth import login, logout
from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.db.models import Q
from datetime import timedelta, datetime
import re
from django.core.mail import send_mail
from django.conf import settings

from employees.models import Employee, EmployeeInvitation, EmployeeProfile, EmployeeAttendance, LeaveRequest, LeaveType
from payslip_generation.models import Payslip, PayrollRunItem, PayrollRunItemLine
from attendance.models import AttendanceRecord, Holiday
from attendance.services import generate_monthly_summary


class IsAuthenticatedOrEmployeeSession(BasePermission):
    def has_permission(self, request, view):
        if request.user and request.user.is_authenticated:
            return True
        if request.session and request.session.get('employee_id'):
            return True
        return False


class IsAuthenticatedOrAdminSession(BasePermission):
    def has_permission(self, request, view):
        if request.user and request.user.is_authenticated:
            return True
        if request.session and request.session.get('admin_id'):
            return True
        return False


def _validate_password_strength(password: str) -> str | None:
    if len(password or "") < 8:
        return "Password must be at least 8 characters long."
    if not re.search(r"[a-z]", password):
        return "Password must include a lowercase letter."
    if not re.search(r"[A-Z]", password):
        return "Password must include an uppercase letter."
    if not re.search(r"\d", password):
        return "Password must include a number."
    return None


def _has_admin_access(request) -> bool:
    """
    Checks if the current request has admin privileges via JWT or Session.
    """
    is_jwt_authenticated = bool(request.user and request.user.is_authenticated)
    is_session_admin = bool(request.session and request.session.get('admin_id'))
    return is_jwt_authenticated or is_session_admin


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def employee_login_view(request):
    import logging
    log = logging.getLogger('authentication')

    username = (
        request.data.get('username')
        or request.data.get('email')
        or request.data.get('employee_id')
        or ''
    ).strip()
    password = request.data.get('password') or ''

    if not username or not password:
        return Response({
            'success': False,
            'message': 'Employee ID/email and password are required'
        }, status=status.HTTP_400_BAD_REQUEST)

    employee = Employee.objects.filter(
        Q(employee_id__iexact=username) | Q(email__iexact=username)
    ).first()

    log.info('Login attempt: identifier=%s found=%s', username, bool(employee))

    if not employee:
        return Response({
            'success': False,
            'message': 'Invalid credentials'
        }, status=status.HTTP_401_UNAUTHORIZED)

    if not employee.is_active:
        return Response({
            'success': False,
            'message': 'Account is inactive'
        }, status=status.HTTP_400_BAD_REQUEST)

    if not _verify_employee_password(employee, password):
        log.warning('Login failed (wrong password): identifier=%s employee_id=%s', username, employee.employee_id)
        return Response({
            'success': False,
            'message': 'Invalid credentials'
        }, status=status.HTTP_401_UNAUTHORIZED)

    if not employee.account_activated:
        return Response({
            'success': False,
            'message': 'Account not activated. Please use your invitation link first.'
        }, status=status.HTTP_400_BAD_REQUEST)

    request.session['employee_id'] = employee.id
    request.session.pop('admin_id', None)

    if not employee.onboarding_completed:
        return Response({
            'success': False,
            'message': 'Please complete onboarding first.',
            'requires_onboarding': True,
            'employee_id': employee.id
        }, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        'success': True,
        'message': 'Login successful',
        'role': 'employee',
        'user': {
            'id': employee.id,
            'name': employee.name,
            'email': employee.email,
            'employee_id': employee.employee_id,
            'role': 'employee'
        }
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticatedOrEmployeeSession])
def employee_payslips_view(request):
    employee_id, error_response = _resolve_employee_id(request)
    if error_response:
        return error_response

    payslip_rows = Payslip.objects.filter(
        employee_id=employee_id,
        is_released=True
    ).order_by('-pay_period_year', '-generated_at')

    payload = [{
        'id': payslip.id,
        'pay_period_month': payslip.pay_period_month,
        'pay_period_year': payslip.pay_period_year,
        'net_pay': payslip.net_pay,
        # Never expose raw pdf_path — employee must use the secure endpoints
        'preview_url': f'/api/payslips/{payslip.id}/preview/',
        'download_url': f'/api/payslips/{payslip.id}/download/',
        'generated_at': payslip.generated_at,
        'is_released': payslip.is_released,
    } for payslip in payslip_rows]

    return Response({'success': True, 'payslips': payload}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def sign_in_view(request):
    return employee_login_view(request)


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def sign_out_view(request):
    request.session.pop('employee_id', None)
    request.session.pop('admin_id', None)
    logout(request)
    return Response({'success': True, 'message': 'Logout successful'}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticatedOrEmployeeSession])
def attendance_history_view(request):
    employee_id, error_response = _resolve_employee_id(request)
    if error_response:
        return error_response

    records = AttendanceRecord.objects.filter(employee_id=employee_id).order_by('-date')[:30]
    return Response({
        'success': True,
        'attendance': [{
            'date': row.date.isoformat(),
            'status': row.status,
            'punch_in_time': row.punch_in_time,
            'punch_out_time': row.punch_out_time,
            'working_hours': row.working_hours,
            'overtime_hours': row.overtime_hours,
        } for row in records]
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticatedOrAdminSession])
@csrf_exempt
def send_invitation_view(request):
    if not _has_admin_access(request):
        return Response({
            'success': False,
            'message': 'Unauthorized'
        }, status=status.HTTP_401_UNAUTHORIZED)

    employee_id = request.data.get('employee_id')
    if not employee_id:
        return Response({
            'success': False,
            'message': 'employee_id is required'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        employee = Employee.objects.get(id=employee_id, is_active=True)
    except Employee.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Employee not found'
        }, status=status.HTTP_404_NOT_FOUND)

    if not employee.email:
        return Response({
            'success': False,
            'message': 'Employee does not have an official email configured.'
        }, status=status.HTTP_400_BAD_REQUEST)

    token = EmployeeInvitation.generate_token()
    invitation, _ = EmployeeInvitation.objects.update_or_create(
        employee=employee,
        defaults={
            'email': employee.email,
            'token': token,
            'status': 'PENDING',
            'expires_at': timezone.now() + timedelta(hours=48),
            'activated_at': None,
        },
    )

    activation_link = f"{settings.FRONTEND_URL}/activate/{invitation.token}"
    subject = "RDesk Account Activation - BlackRoth"
    body = (
        f"Hello {employee.name},\n\n"
        "Your employee account has been created.\n"
        "Please activate your account using this secure link:\n\n"
        f"{activation_link}\n\n"
        "This link expires in 48 hours.\n\n"
        "Regards,\nRothDesk Team"
    )

    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[employee.email],
            fail_silently=False,
        )
        return Response({
            'success': True,
            'message': f'Invitation sent successfully to {employee.email}.',
            'email_sent': True,
        }, status=status.HTTP_200_OK)
    except Exception as exc:
        return Response({
            'success': True,
            'message': 'Invitation generated, but email was not delivered automatically.',
            'email_sent': False,
            'activation_link': activation_link,
            'delivery_hint': str(exc),
        }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticatedOrAdminSession])
@csrf_exempt
def release_payslip_view(request):
    if not _has_admin_access(request):
        return Response({
            'success': False,
            'message': 'Unauthorized'
        }, status=status.HTTP_401_UNAUTHORIZED)

    employee_id = request.data.get('employee_id')
    month = request.data.get('month')
    year = request.data.get('year')

    if not employee_id:
        return Response({
            'success': False,
            'message': 'employee_id is required'
        }, status=status.HTTP_400_BAD_REQUEST)

    queryset = Payslip.objects.filter(employee_id=employee_id)
    if month:
        queryset = queryset.filter(pay_period_month=month)
    if year:
        queryset = queryset.filter(pay_period_year=year)

    if not queryset.exists():
        return Response({
            'success': False,
            'message': 'No payslips found for the requested employee/period.'
        }, status=status.HTTP_404_NOT_FOUND)

    unreleased = queryset.filter(is_released=False)
    if not unreleased.exists():
        return Response({
            'success': True,
            'message': 'No pending payslips to release.'
        }, status=status.HTTP_200_OK)

    update_payload = {
        'is_released': True,
        'released_at': timezone.now(),
    }
    if getattr(request.user, 'is_authenticated', False):
        update_payload['released_by_id'] = request.user.id

    released_count = unreleased.update(**update_payload)

    # Audit log each released payslip
    from payslip_generation.audit import log_payroll_action
    for payslip in unreleased:
        log_payroll_action(
            action='RELEASE',
            performed_by=request.user if getattr(request.user, 'is_authenticated', False) else None,
            payslip=payslip,
            notes='Released via release_payslip_view',
        )

    return Response({
        'success': True,
        'message': f'{released_count} payslip(s) released successfully.',
        'released_count': released_count,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def activate_account_view(request):
    try:
        token = (request.data.get('token') or '').strip()
        password = request.data.get('password') or ''
        confirm_password = request.data.get('confirm_password') or ''

        if not token:
            return Response({
                'success': False,
                'message': 'Activation token is required.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not password or not confirm_password:
            return Response({
                'success': False,
                'message': 'Password and confirm password are required.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if password != confirm_password:
            return Response({
                'success': False,
                'message': 'Passwords do not match.'
            }, status=status.HTTP_400_BAD_REQUEST)

        strength_error = _validate_password_strength(password)
        if strength_error:
            return Response({
                'success': False,
                'message': strength_error
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            invitation = EmployeeInvitation.objects.select_related('employee').get(token=token)
        except EmployeeInvitation.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Invalid activation token.'
            }, status=status.HTTP_404_NOT_FOUND)

        if invitation.status == 'ACTIVATED':
            return Response({
                'success': False,
                'message': 'This activation link has already been used.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if invitation.is_expired:
            invitation.status = 'EXPIRED'
            invitation.save(update_fields=['status'])
            return Response({
                'success': False,
                'message': 'Activation link has expired.'
            }, status=status.HTTP_400_BAD_REQUEST)

        employee = invitation.employee
        now = timezone.now()
        employee.password = make_password(password)
        employee.password_changed = True
        employee.password_set_date = now
        employee.account_activated = True
        employee.account_activated_at = now
        employee.save(update_fields=[
            'password',
            'password_changed',
            'password_set_date',
            'account_activated',
            'account_activated_at',
            'updated_at'
        ])

        invitation.status = 'ACTIVATED'
        invitation.activated_at = now
        invitation.save(update_fields=['status', 'activated_at'])

        # Keep employee in session so onboarding can run immediately after activation.
        request.session['employee_id'] = employee.id
        request.session.pop('admin_id', None)

        return Response({
            'success': True,
            'message': 'Account activated successfully.',
            'employee_id': employee.id
        }, status=status.HTTP_200_OK)

    except Exception as exc:
        import logging
        logging.getLogger('authentication').exception('Failed to activate employee account for token: %s', token)
        return Response({
            'success': False,
            'message': 'Internal server error during activation. Please try again or contact support.',
            'error': str(exc)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticatedOrEmployeeSession])
@csrf_exempt
def complete_onboarding_view(request):
    employee_id, error_response = _resolve_employee_id(request)
    if error_response:
        return error_response

    try:
        employee = Employee.objects.get(id=employee_id, is_active=True)
    except Employee.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Employee not found'
        }, status=status.HTTP_404_NOT_FOUND)

    required_fields = ['dob', 'pan_number', 'pf_number', 'bank_account', 'ifsc_code', 'phone', 'address', 'personal_email']
    missing = [field for field in required_fields if not (request.data.get(field) or '').strip()]
    if missing:
        return Response({
            'success': False,
            'message': f"Missing required fields: {', '.join(missing)}"
        }, status=status.HTTP_400_BAD_REQUEST)

    employee.dob = request.data.get('dob')
    employee.pan = (request.data.get('pan_number') or '').strip().upper()
    employee.pf_number = (request.data.get('pf_number') or '').strip()
    employee.bank_account = (request.data.get('bank_account') or '').strip()
    employee.bank_ifsc = (request.data.get('ifsc_code') or '').strip().upper()
    employee.personal_email = (request.data.get('personal_email') or '').strip().lower()
    employee.onboarding_completed = True
    employee.save(update_fields=[
        'dob',
        'pan',
        'pf_number',
        'bank_account',
        'bank_ifsc',
        'personal_email',
        'onboarding_completed',
        'updated_at'
    ])

    profile, _ = EmployeeProfile.objects.get_or_create(employee=employee)
    profile.phone = (request.data.get('phone') or '').strip()
    profile.address = (request.data.get('address') or '').strip()
    profile.bank_account = employee.bank_account
    profile.ifsc_code = employee.bank_ifsc
    profile.pan_number = employee.pan
    if request.FILES.get('profile_photo'):
        profile.profile_photo = request.FILES['profile_photo']
    profile.save()

    return Response({
        'success': True,
        'message': 'Onboarding completed successfully.'
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def employee_profile_view(request):
    employee_id, error_response = _resolve_employee_id(request)
    if error_response:
        return error_response

    try:
        employee = Employee.objects.select_related('department').get(id=employee_id, is_active=True)
    except Employee.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Employee not found'
        }, status=status.HTTP_404_NOT_FOUND)

    profile, _ = EmployeeProfile.objects.get_or_create(employee=employee)

    return Response({
        'success': True,
        'profile': {
            'employee_id': employee.employee_id,
            'name': employee.name,
            'email': employee.email,
            'personal_email': employee.personal_email,
            'department': employee.department.department_name if employee.department else None,
            'position': employee.position,
            'location': employee.location,
            'date_of_joining': employee.doj.isoformat() if employee.doj else None,
            'phone': profile.phone,
            'address': profile.address,
            'bank_account': employee.bank_account,
            'ifsc_code': employee.bank_ifsc,
            'pan_number': employee.pan,
            'pf_number': employee.pf_number,
            'profile_photo': profile.profile_photo.url if profile.profile_photo else None,
        }
    }, status=status.HTTP_200_OK)


@api_view(['PUT', 'PATCH'])
@permission_classes([AllowAny])
@csrf_exempt
def update_employee_profile_view(request):
    employee_id, error_response = _resolve_employee_id(request)
    if error_response:
        return error_response

    try:
        employee = Employee.objects.get(id=employee_id, is_active=True)
    except Employee.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Employee not found'
        }, status=status.HTTP_404_NOT_FOUND)

    profile, _ = EmployeeProfile.objects.get_or_create(employee=employee)

    mutable_fields = {
        'personal_email': 'personal_email',
        'bank_account': 'bank_account',
        'ifsc_code': 'bank_ifsc',
        'pf_number': 'pf_number',
        'pan_number': 'pan',
    }
    employee_updates = []
    for request_key, model_field in mutable_fields.items():
        if request_key in request.data:
            value = (request.data.get(request_key) or '').strip()
            if request_key in {'ifsc_code', 'pan_number'}:
                value = value.upper()
            if request_key == 'personal_email':
                value = value.lower()
            setattr(employee, model_field, value)
            employee_updates.append(model_field)

    if employee_updates:
        employee.save(update_fields=employee_updates + ['updated_at'])

    if 'phone' in request.data:
        profile.phone = (request.data.get('phone') or '').strip()
    if 'address' in request.data:
        profile.address = (request.data.get('address') or '').strip()
    if request.FILES.get('profile_photo'):
        profile.profile_photo = request.FILES['profile_photo']
    profile.bank_account = employee.bank_account
    profile.ifsc_code = employee.bank_ifsc
    profile.pan_number = employee.pan
    profile.save()

    return Response({
        'success': True,
        'message': 'Profile updated successfully.'
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticatedOrAdminSession])
@csrf_exempt
def bulk_release_payslips_view(request):
    """
    Bulk release payslips for a given month and year.

    Request body may provide employee IDs using either `employee_ids`
    or the admin UI-friendly alias `selected_employees`.
    """
    employee_ids = request.data.get('employee_ids') or request.data.get('selected_employees') or []
    month = request.data.get('month')
    year = request.data.get('year')

    if isinstance(employee_ids, int):
        employee_ids = [employee_ids]
    if not isinstance(employee_ids, list) or not employee_ids:
        return Response({
            'success': False,
            'message': 'employee_ids must be a non-empty list'
        }, status=status.HTTP_400_BAD_REQUEST)

    if not month or not year:
        return Response({
            'success': False,
            'message': 'month and year are required'
        }, status=status.HTTP_400_BAD_REQUEST)

    payslip_qs = Payslip.objects.filter(
        employee_id__in=employee_ids,
        pay_period_month=month,
        pay_period_year=year,
    )
    update_payload = {
        'is_released': True,
        'released_at': timezone.now(),
    }
    if getattr(request.user, 'is_authenticated', False):
        update_payload['released_by_id'] = request.user.id

    updated = payslip_qs.update(**update_payload)

    # Audit log
    from payslip_generation.audit import log_payroll_action
    log_payroll_action(
        action='BULK_RELEASE',
        performed_by=request.user if getattr(request.user, 'is_authenticated', False) else None,
        pay_period_month=month,
        pay_period_year=int(year),
        notes=f"Bulk released {updated} payslip(s) for {len(employee_ids)} employee(s).",
    )

    return Response({
        'success': True,
        'message': f'{updated} payslip(s) released successfully.'
    }, status=status.HTTP_200_OK)


def _resolve_employee_id(request, provided_employee_id=None):
    """
    Resolve target employee ID with access control.
    """
    session_employee_id = request.session.get('employee_id')
    request_employee_id = (
        provided_employee_id
        or request.GET.get('employee_id')
        or request.data.get('employee_id')
        or request.POST.get('employee_id')
    )

    if session_employee_id:
        if request_employee_id and str(request_employee_id) != str(session_employee_id):
            return None, Response({
                'success': False,
                'message': 'Forbidden'
            }, status=status.HTTP_403_FORBIDDEN)
        return int(session_employee_id), None

    if getattr(request.user, 'is_authenticated', False):
        if not request_employee_id:
            return None, Response({
                'success': False,
                'message': 'Employee ID is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        try:
            return int(request_employee_id), None
        except (TypeError, ValueError):
            return None, Response({
                'success': False,
                'message': 'Invalid employee ID'
            }, status=status.HTTP_400_BAD_REQUEST)

    return None, Response({
        'success': False,
        'message': 'Unauthorized'
    }, status=status.HTTP_401_UNAUTHORIZED)


def _is_hashed_password(value: str | None) -> bool:
    if not value:
        return False
    try:
        identify_hasher(value)
        return True
    except Exception:
        return False


def _verify_employee_password(employee: Employee, raw_password: str) -> bool:
    stored = employee.password
    if not stored:
        return False

    if _is_hashed_password(stored):
        return check_password(raw_password, stored)

    # Legacy plaintext compatibility
    if stored == raw_password:
        employee.password = make_password(raw_password)
        employee.password_set_date = timezone.now()
        employee.save(update_fields=['password', 'password_set_date', 'updated_at'])
        return True
    return False


@api_view(['GET'])
@permission_classes([IsAuthenticatedOrEmployeeSession])
def employee_dashboard_view(request):
    """
    Employee dashboard data - team stats, late arrivals, holidays, team leave.
    """
    employee_id, error_response = _resolve_employee_id(request, request.GET.get('employee_id'))
    if error_response:
        return error_response

    try:
        employee = Employee.objects.select_related('department').get(id=employee_id)
    except Employee.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Employee not found'
        }, status=status.HTTP_404_NOT_FOUND)

    today = timezone.localdate()
    
    # Team members (same department)
    team_members = Employee.objects.filter(
        department=employee.department,
        is_active=True
    ).exclude(id=employee_id)

    # Who is in? (today's attendance)
    present_today = AttendanceRecord.objects.filter(
        employee__in=team_members,
        date=today,
        punch_in_time__isnull=False
    ).values('employee').distinct().count()
    
    # Late calculation using attendance service logic
    late_today = 0
    for record in AttendanceRecord.objects.filter(
        employee__in=team_members,
        date=today,
        punch_in_time__isnull=False
    ).select_related('shift'):
        if record.shift and record.punch_in_time:
            local_time = timezone.localtime(record.punch_in_time).time()
            if local_time > record.shift.late_after:
                late_today += 1
    
    on_time = present_today - late_today

    # Team on leave today
    team_on_leave = LeaveRequest.objects.filter(
        employee__in=team_members,
        status='APPROVED',
        start_date__lte=today,
        end_date__gte=today
    ).select_related('employee', 'leave_type').all()
    
    team_leave_list = [{
        'id': lr.id,
        'employee_name': lr.employee.name,
        'leave_type': lr.leave_type.name if lr.leave_type else 'Leave',
        'start_date': lr.start_date.isoformat(),
        'end_date': lr.end_date.isoformat()
    } for lr in team_on_leave]

    # Upcoming holidays (next 30 days)
    upcoming_holidays = Holiday.objects.filter(
        date__gte=today,
        date__lte=today + timedelta(days=30),
        holiday_type='NATIONAL',
        is_active=True,
        calendar__is_active=True,
    ).order_by('date')[:5]

    holidays_list = [{
        'name': h.name,
        'date': h.date.isoformat(),
        'is_optional': h.holiday_type != 'NATIONAL'
    } for h in upcoming_holidays]

    # Review items (placeholder)
    review_items = [
        {'title': 'Hurrah! You have nothing to review.', 'status': 'completed'}
    ]

    # Latest payslip
    latest_payslip = Payslip.objects.filter(
        employee=employee,
        is_released=True
    ).order_by('-generated_at').first()

    monthly_summary = generate_monthly_summary(employee, month=today.month, year=today.year)

    return Response({
        'success': True,
        'employee': {
            'name': employee.name,
            'employee_id': employee.employee_id,
            'department': employee.department.department_name if employee.department else None
        },
        'today': {
            'date': today.isoformat(),
            'team_present': on_time,
            'team_late': late_today,
            'team_total': team_members.count()
        },
        'cards': {
            'review': review_items,
            'who_is_in': {
                'on_time': on_time,
                'late': late_today
            },
            'upcoming_holidays': holidays_list,
            'team_on_leave': team_leave_list,
            'payslip': {
                'has_latest': bool(latest_payslip),
                'month': latest_payslip.pay_period_month if latest_payslip else None,
                'year': latest_payslip.pay_period_year if latest_payslip else None
            },
            'summary': {
                'present_days': monthly_summary.present_days,
                'late_days': monthly_summary.late_days,
                'leave_days': monthly_summary.leave_days,
                'absent_days': monthly_summary.absent_days,
                'half_days': monthly_summary.half_days,
                'total_working_hours': monthly_summary.total_working_hours,
                'overtime_hours': monthly_summary.overtime_hours,
                'payable_days': monthly_summary.payable_days,
            }
        }
    }, status=status.HTTP_200_OK)


MONTH_NUMBER = {
    'january': 1, 'february': 2, 'march': 3, 'april': 4,
    'may': 5, 'june': 6, 'july': 7, 'august': 8,
    'september': 9, 'october': 10, 'november': 11, 'december': 12,
}


def _get_employee_ytd_period() -> dict:
    """Return the current fiscal year window from April to current month."""
    today = timezone.localdate()
    month_number = today.month
    year = today.year

    start_year = year if month_number >= 4 else year - 1
    month_names = {v: k.capitalize() for k, v in MONTH_NUMBER.items()}
    period = {
        'start_month': month_names[4],
        'start_year': start_year,
        'end_month': month_names[month_number],
        'end_year': year,
        'months': 0,
    }

    current_month = 4
    current_year = start_year
    months = []
    while True:
        months.append((month_names[current_month], current_year))
        period['months'] += 1
        if current_month == month_number and current_year == year:
            break
        current_month += 1
        if current_month > 12:
            current_month = 1
            current_year += 1

    period['month_year_pairs'] = months
    return period


@api_view(['GET'])
@permission_classes([IsAuthenticatedOrEmployeeSession])
def employee_ytd_view(request):
    """
    GET /api/auth/employee/ytd/
    Returns current fiscal year YTD payroll summary for the logged-in employee.
    """
    employee_id, error_response = _resolve_employee_id(request)
    if error_response:
        return error_response

    try:
        employee = Employee.objects.get(id=employee_id, is_active=True)
    except Employee.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Employee not found'
        }, status=status.HTTP_404_NOT_FOUND)

    period = _get_employee_ytd_period()

    months_by_year: dict[int, list[str]] = {}
    for month_name, month_year in period['month_year_pairs']:
        months_by_year.setdefault(month_year, []).append(month_name)

    query = Q()
    for month_year, month_names in months_by_year.items():
        query |= Q(run__year=month_year, run__month__in=month_names)

    items = (
        PayrollRunItem.objects
        .filter(query, employee=employee, status='INCLUDED')
        .select_related('run')
        .prefetch_related('lines')
        .order_by('run__year', 'run__month')
    )

    ytd_gross = 0.0
    ytd_deductions = 0.0
    ytd_net = 0.0
    ytd_pf_employee = 0.0
    ytd_tds = 0.0
    months_count = 0

    monthly_breakdown = []
    for item in items:
        pf_employee = sum(float(line.amount) for line in item.lines.all() if line.code == 'PF_EMP')

        monthly_breakdown.append({
            'month': item.run.month,
            'year': item.run.year,
            'gross': float(item.gross_earnings),
            'deductions': float(item.total_deductions),
            'net': float(item.net_pay),
            'pf_employee': pf_employee,
            'tds': float(item.tds_amount),
        })

        ytd_gross += float(item.gross_earnings)
        ytd_deductions += float(item.total_deductions)
        ytd_net += float(item.net_pay)
        ytd_pf_employee += pf_employee
        ytd_tds += float(item.tds_amount)
        months_count += 1

    return Response({
        'success': True,
        'period': {
            'start_month': period['start_month'],
            'start_year': period['start_year'],
            'end_month': period['end_month'],
            'end_year': period['end_year'],
            'months': period['months'],
        },
        'ytd_summary': {
            'gross': round(ytd_gross, 2),
            'deductions': round(ytd_deductions, 2),
            'net': round(ytd_net, 2),
            'pf_employee': round(ytd_pf_employee, 2),
            'tds': round(ytd_tds, 2),
            'months_count': months_count,
        },
        'monthly_breakdown': monthly_breakdown,
    }, status=status.HTTP_200_OK)
