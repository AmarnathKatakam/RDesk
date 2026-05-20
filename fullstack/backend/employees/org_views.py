"""
Organisation Chart & Reporting Hierarchy API views.
"""
from __future__ import annotations

import logging
from django.db import transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Employee

logger = logging.getLogger(__name__)


def _employee_node(emp: Employee) -> dict:
    return {
        'id': emp.id,
        'employee_id': emp.employee_id,
        'name': emp.name,
        'position': emp.position or '',
        'department': emp.department.department_name if emp.department else '',
        'department_id': emp.department_id,
        'location': emp.location or '',
        'is_active': emp.is_active,
        'is_top_level_manager': emp.is_top_level_manager,
        'reporting_manager_id': emp.reporting_manager_id,
        'reporting_manager_name': emp.reporting_manager.name if emp.reporting_manager else None,
    }


def _build_tree(manager: Employee, all_employees: list[Employee]) -> dict:
    """Recursively build org tree for a manager node."""
    node = _employee_node(manager)
    node['children'] = [
        _build_tree(emp, all_employees)
        for emp in all_employees
        if emp.reporting_manager_id == manager.id
    ]
    return node


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def org_chart_tree(request):
    """
    Returns the full org chart tree.
    Top-level nodes are employees with is_top_level_manager=True.
    Unassigned employees (no manager, not top-level) are returned separately.
    """
    employees = list(
        Employee.objects.filter(is_active=True)
        .select_related('department', 'reporting_manager')
        .order_by('name')
    )

    top_level = [e for e in employees if e.is_top_level_manager]
    tree = [_build_tree(mgr, employees) for mgr in top_level]

    # Unassigned: active, not top-level, no reporting manager
    assigned_ids = {e.id for e in employees if e.reporting_manager_id or e.is_top_level_manager}
    unassigned = [_employee_node(e) for e in employees if e.id not in assigned_ids]

    return Response({
        'success': True,
        'tree': tree,
        'unassigned': unassigned,
        'total_employees': len(employees),
        'unassigned_count': len(unassigned),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assign_manager(request):
    """
    Assign a reporting manager to one or more employees.
    Body: { employee_ids: [int], manager_id: int | null }
    """
    employee_ids = request.data.get('employee_ids', [])
    manager_id = request.data.get('manager_id')  # null = remove manager

    if not employee_ids:
        return Response({'success': False, 'message': 'employee_ids is required.'}, status=400)

    manager = None
    if manager_id:
        try:
            manager = Employee.objects.get(id=manager_id, is_active=True)
        except Employee.DoesNotExist:
            return Response({'success': False, 'message': 'Manager not found.'}, status=404)

        # Prevent self-assignment
        if manager_id in employee_ids:
            return Response({'success': False, 'message': 'An employee cannot be their own manager.'}, status=400)

    updated = Employee.objects.filter(id__in=employee_ids, is_active=True).update(
        reporting_manager=manager
    )
    return Response({
        'success': True,
        'message': f'{updated} employee(s) updated.',
        'manager_id': manager_id,
        'manager_name': manager.name if manager else None,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assign_top_level_manager(request):
    """
    Mark/unmark employees as top-level managers.
    Body: { employee_ids: [int], is_top_level: bool }
    """
    employee_ids = request.data.get('employee_ids', [])
    is_top_level = bool(request.data.get('is_top_level', True))

    if not employee_ids:
        return Response({'success': False, 'message': 'employee_ids is required.'}, status=400)

    updated = Employee.objects.filter(id__in=employee_ids, is_active=True).update(
        is_top_level_manager=is_top_level
    )
    return Response({
        'success': True,
        'message': f'{updated} employee(s) marked as {"top-level manager" if is_top_level else "regular employee"}.',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mass_transfer(request):
    """
    Move all direct reports from one manager to another.
    Body: { from_manager_id: int, to_manager_id: int }
    """
    from_id = request.data.get('from_manager_id')
    to_id = request.data.get('to_manager_id')

    if not from_id or not to_id:
        return Response({'success': False, 'message': 'from_manager_id and to_manager_id are required.'}, status=400)

    if from_id == to_id:
        return Response({'success': False, 'message': 'Source and destination managers must be different.'}, status=400)

    try:
        to_manager = Employee.objects.get(id=to_id, is_active=True)
    except Employee.DoesNotExist:
        return Response({'success': False, 'message': 'Destination manager not found.'}, status=404)

    updated = Employee.objects.filter(reporting_manager_id=from_id, is_active=True).update(
        reporting_manager=to_manager
    )
    return Response({
        'success': True,
        'message': f'{updated} employee(s) transferred to {to_manager.name}.',
        'transferred_count': updated,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manager_team(request, manager_id):
    """
    Get direct reports of a manager with today's attendance status.
    """
    from django.utils import timezone
    from attendance.models import AttendanceRecord

    try:
        manager = Employee.objects.get(id=manager_id, is_active=True)
    except Employee.DoesNotExist:
        return Response({'success': False, 'message': 'Manager not found.'}, status=404)

    today = timezone.localdate()
    direct_reports = Employee.objects.filter(
        reporting_manager=manager, is_active=True
    ).select_related('department')

    attendance_today = {
        rec.employee_id: rec
        for rec in AttendanceRecord.objects.filter(
            employee__in=direct_reports, date=today
        )
    }

    team = []
    for emp in direct_reports:
        rec = attendance_today.get(emp.id)
        team.append({
            **_employee_node(emp),
            'today_status': rec.status if rec else 'NOT_MARKED',
            'punch_in_time': rec.punch_in_time.isoformat() if rec and rec.punch_in_time else None,
            'punch_out_time': rec.punch_out_time.isoformat() if rec and rec.punch_out_time else None,
            'working_hours': float(rec.working_hours) if rec else 0,
        })

    return Response({
        'success': True,
        'manager': _employee_node(manager),
        'team': team,
        'team_count': len(team),
        'date': today.isoformat(),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manager_leave_queue(request, manager_id):
    """
    Get pending leave requests for a manager's direct reports.
    """
    from employees.models import LeaveRequest

    try:
        manager = Employee.objects.get(id=manager_id, is_active=True)
    except Employee.DoesNotExist:
        return Response({'success': False, 'message': 'Manager not found.'}, status=404)

    direct_report_ids = Employee.objects.filter(
        reporting_manager=manager, is_active=True
    ).values_list('id', flat=True)

    pending = LeaveRequest.objects.filter(
        employee_id__in=direct_report_ids,
        status='PENDING',
    ).select_related('employee', 'leave_type').order_by('-created_at')

    data = [{
        'id': lr.id,
        'employee_id': lr.employee.id,
        'employee_name': lr.employee.name,
        'employee_code': lr.employee.employee_id,
        'leave_type': lr.leave_type.name if lr.leave_type else 'N/A',
        'start_date': lr.start_date.isoformat(),
        'end_date': lr.end_date.isoformat(),
        'days': lr.number_of_days,
        'reason': lr.reason,
        'status': lr.status,
        'created_at': lr.created_at.isoformat(),
    } for lr in pending]

    return Response({'success': True, 'pending_leaves': data, 'count': len(data)})
