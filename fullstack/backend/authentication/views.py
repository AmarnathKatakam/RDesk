from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.contrib.auth import get_user_model
from django.db.models import Q
from employees.models import Employee

User = get_user_model()


def _resolve_admin_role(user):
    """
    Derive role for frontend redirects.
    Priority: group-based role, then username hint, then default admin.
    """
    group_names = {group.name.lower() for group in user.groups.all()}
    if 'ceo' in group_names or user.username.lower() == 'ceo':
        return 'ceo'
    if 'hr' in group_names:
        return 'hr'
    return 'admin'


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
        employee.save(update_fields=['password', 'updated_at'])
        return True

    return False


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Unified login endpoint.
    Supports:
    - Admin users (AdminUser model)
    - Employees (Employee model) using employee ID or official email
    """
    username = request.data.get('username') or request.data.get('email') or request.data.get('employee_id')
    password = request.data.get('password')
    
    if not username or not password:
        return Response({
            'success': False,
            'message': 'Email/Employee ID and password are required'
        }, status=status.HTTP_400_BAD_REQUEST)

    login_username = username
    if '@' in username:
        matched_user = User.objects.filter(email__iexact=username).first()
        if matched_user:
            login_username = matched_user.username

    user = authenticate(request, username=login_username, password=password)
    
    if user is not None:
        if user.is_active:
            login(request, user)
            request.session['admin_id'] = user.id
            request.session.pop('employee_id', None)
            role = _resolve_admin_role(user)

            refresh = RefreshToken.for_user(user)

            return Response({
                'success': True,
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'message': 'Login successful',
                'role': role,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'full_name': user.full_name,
                    'is_active': user.is_active,
                    'role': role
                }
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'success': False,
                'message': 'Account is inactive'
            }, status=status.HTTP_400_BAD_REQUEST)

    # Employee login fallback
    try:
        employee = Employee.objects.get(
            Q(employee_id__iexact=username) | Q(email__iexact=username)
        )
    except Employee.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Invalid credentials'
        }, status=status.HTTP_401_UNAUTHORIZED)
    except Employee.MultipleObjectsReturned:
        employee = Employee.objects.filter(
            Q(employee_id__iexact=username) | Q(email__iexact=username)
        ).order_by('id').first()

    if not _verify_employee_password(employee, password):
        return Response({
            'success': False,
            'message': 'Invalid credentials'
        }, status=status.HTTP_401_UNAUTHORIZED)

    if not employee.is_active:
        return Response({
            'success': False,
            'message': 'Account is inactive'
        }, status=status.HTTP_400_BAD_REQUEST)

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

    # Use session-based auth for employee portal (mobile/web session cookie). Do not issue admin JWT for employee model.
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


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def logout_view(request):
    """
    Admin logout endpoint.
    """
    request.session.pop('admin_id', None)
    request.session.pop('employee_id', None)
    logout(request)
    return Response({
        'success': True,
        'message': 'Logout successful'
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    """
    Get current user profile.
    """
    user = request.user
    role = _resolve_admin_role(user)
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'full_name': user.full_name,
        'is_active': user.is_active,
        'role': role,
        'created_at': user.created_at,
        'updated_at': user.updated_at
    }, status=status.HTTP_200_OK)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_profile_view(request):
    """
    Update current user profile.
    """
    user = request.user
    role = _resolve_admin_role(user)
    
    # Update allowed fields
    if 'full_name' in request.data:
        user.full_name = request.data['full_name']
    
    if 'email' in request.data:
        user.email = request.data['email']
    
    user.save()
    
    return Response({
        'success': True,
        'message': 'Profile updated successfully',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': user.full_name,
            'is_active': user.is_active,
            'role': role
        }
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    """
    Change user password.
    """
    user = request.user
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')
    
    if not current_password or not new_password:
        return Response({
            'success': False,
            'message': 'Current password and new password are required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if not user.check_password(current_password):
        return Response({
            'success': False,
            'message': 'Current password is incorrect'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    user.set_password(new_password)
    user.save()
    
    return Response({
        'success': True,
        'message': 'Password changed successfully'
    }, status=status.HTTP_200_OK)
