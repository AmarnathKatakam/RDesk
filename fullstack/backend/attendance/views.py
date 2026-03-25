from __future__ import annotations

import calendar
import logging
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from employees.models import Employee

from .models import (
    AttendancePolicy,
    AttendanceRecord,
    EmployeeShiftAssignment,
    Holiday,
    OfficeLocation,
    Shift,
)
from .serializers import (
    AttendancePolicySerializer,
    AttendanceRecordSerializer,
    EmployeeShiftAssignmentSerializer,
    HolidaySerializer,
    MonthlyAttendanceSummarySerializer,
    OfficeLocationSerializer,
    ShiftSerializer,
)
from .services import (
    AttendanceServiceError,
    check_attendance_configurations,
    generate_monthly_summaries,
    generate_monthly_summary,
    get_active_assignment,
    get_active_policy,
    get_day_status,
    get_payroll_metrics,
    is_admin_request,
    mark_absent_for_date,
    punch_in as punch_in_service,
    punch_out as punch_out_service,
    resolve_actor_context,
    resolve_employee_for_request,
)


logger = logging.getLogger(__name__)


DEFAULT_IT_SHIFTS = [
    {
        "name": "General",
        "start_time": "09:30",
        "end_time": "18:30",
        "late_after": "09:45",
        "half_day_after": "11:00",
        "overtime_allowed": True,
    },
    {
        "name": "Morning",
        "start_time": "06:00",
        "end_time": "15:00",
        "late_after": "06:15",
        "half_day_after": "07:30",
        "overtime_allowed": True,
    },
    {
        "name": "Evening",
        "start_time": "14:00",
        "end_time": "23:00",
        "late_after": "14:15",
        "half_day_after": "15:30",
        "overtime_allowed": True,
    },
    {
        "name": "Night",
        "start_time": "22:00",
        "end_time": "07:00",
        "late_after": "22:15",
        "half_day_after": "23:30",
        "overtime_allowed": True,
    },
]


def _ensure_default_it_shifts(user=None):
    created_by = user if getattr(user, "is_authenticated", False) else None
    for item in DEFAULT_IT_SHIFTS:
        shift, created = Shift.objects.get_or_create(
            name=item["name"],
            defaults={
                "start_time": item["start_time"],
                "end_time": item["end_time"],
                "late_after": item["late_after"],
                "half_day_after": item["half_day_after"],
                "overtime_allowed": item["overtime_allowed"],
                "is_active": True,
                "created_by": created_by,
            },
        )
        if not created and not shift.is_active:
            shift.is_active = True
            shift.save(update_fields=["is_active", "updated_at"])


def _parse_decimal(value, field_name: str) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise AttendanceServiceError(f"Invalid {field_name}.", status_code=400) from exc


def _parse_date(value: str | None, default_value: date | None = None) -> date:
    if not value:
        if default_value is None:
            raise AttendanceServiceError("Date value is required.", status_code=400)
        return default_value
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise AttendanceServiceError("Invalid date format. Use YYYY-MM-DD.", status_code=400) from exc


def _ensure_admin(request):
    if not is_admin_request(request):
        raise AttendanceServiceError("Admin authorization required.", status_code=401)


def _parse_month_year(request):
    today = timezone.localdate()
    month = int(request.GET.get("month", today.month))
    year = int(request.GET.get("year", today.year))
    if month < 1 or month > 12:
        raise AttendanceServiceError("month must be between 1 and 12.", status_code=400)
    if year < 1970 or year > 3000:
        raise AttendanceServiceError("year is out of valid range.", status_code=400)
    return month, year


def _build_calendar(employee: Employee, month: int, year: int):
    month_last_day = calendar.monthrange(year, month)[1]
    today = timezone.localdate()
    output = []
    for day in range(1, month_last_day + 1):
        current = date(year, month, day)
        day_payload = get_day_status(employee, current)
        if current > today and day_payload["status"] == "ABSENT":
            day_payload["status"] = "NOT_MARKED"
        output.append(day_payload)
    return output


@api_view(["POST"])
@permission_classes([AllowAny])
def punch_in(request):
    try:
        employee = resolve_employee_for_request(request, request.data.get("employee_id"))
        actor = resolve_actor_context(request)
        latitude = _parse_decimal(request.data.get("latitude"), "latitude")
        longitude = _parse_decimal(request.data.get("longitude"), "longitude")

        record, meta = punch_in_service(
            employee=employee,
            actor=actor,
            latitude=latitude,
            longitude=longitude,
            notes=request.data.get("notes"),
        )
        return Response(
            {
                "success": True,
                "message": "Punch in recorded successfully.",
                "attendance": AttendanceRecordSerializer(record).data,
                "distance_meters": meta.get("distance_meters"),
            },
            status=status.HTTP_200_OK,
        )
    except ValidationError as exc:
        return Response({"success": False, "message": exc.message_dict or exc.messages}, status=status.HTTP_400_BAD_REQUEST)
    except AttendanceServiceError as exc:
        return Response({"success": False, "message": exc.message}, status=exc.status_code)
    except Exception as exc:
        logger.exception("Unexpected error in attendance punch_in endpoint")
        return Response({"success": False, "message": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
@permission_classes([AllowAny])
def punch_out(request):
    try:
        employee = resolve_employee_for_request(request, request.data.get("employee_id"))
        actor = resolve_actor_context(request)
        latitude = _parse_decimal(request.data.get("latitude"), "latitude")
        longitude = _parse_decimal(request.data.get("longitude"), "longitude")

        record, meta = punch_out_service(
            employee=employee,
            actor=actor,
            latitude=latitude,
            longitude=longitude,
            notes=request.data.get("notes"),
        )
        return Response(
            {
                "success": True,
                "message": "Punch out recorded successfully.",
                "attendance": AttendanceRecordSerializer(record).data,
                "distance_meters": meta.get("distance_meters"),
            },
            status=status.HTTP_200_OK,
        )
    except AttendanceServiceError as exc:
        return Response({"success": False, "message": exc.message}, status=exc.status_code)
    except Exception as exc:
        logger.exception("Unexpected error in attendance punch_out endpoint")
        return Response({"success": False, "message": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([AllowAny])
def attendance_today(request):
    try:
        employee = resolve_employee_for_request(request, request.GET.get("employee_id"))
        payload = get_day_status(employee, timezone.localdate())
        return Response({"success": True, "data": payload}, status=status.HTTP_200_OK)
    except AttendanceServiceError as exc:
        return Response({"success": False, "message": exc.message}, status=exc.status_code)
    except Exception as exc:
        return Response({"success": False, "message": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([AllowAny])
def attendance_monthly(request):
    try:
        month, year = _parse_month_year(request)
        employee_id = request.GET.get("employee_id")
        is_admin = is_admin_request(request)

        if employee_id or not is_admin:
            employee = resolve_employee_for_request(request, employee_id)
            summary = generate_monthly_summary(employee, month=month, year=year)
            calendar_days = _build_calendar(employee, month, year)
            return Response(
                {
                    "success": True,
                    "summary": MonthlyAttendanceSummarySerializer(summary).data,
                    "calendar": calendar_days,
                    "payroll": get_payroll_metrics(employee, month, year),
                },
                status=status.HTTP_200_OK,
            )

        _ensure_admin(request)
        summaries = generate_monthly_summaries(month=month, year=year)
        serializer = MonthlyAttendanceSummarySerializer(summaries, many=True)
        return Response(
            {
                "success": True,
                "month": month,
                "year": year,
                "summaries": serializer.data,
                "count": len(serializer.data),
            },
            status=status.HTTP_200_OK,
        )
    except AttendanceServiceError as exc:
        return Response({"success": False, "message": exc.message}, status=exc.status_code)
    except Exception as exc:
        return Response({"success": False, "message": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([AllowAny])
def attendance_report(request):
    try:
        if not is_admin_request(request):
            # Employee can only access own records.
            employee = resolve_employee_for_request(request, request.GET.get("employee_id"))
            queryset = AttendanceRecord.objects.filter(employee=employee)
        else:
            queryset = AttendanceRecord.objects.all()

            employee_id = request.GET.get("employee_id")
            department = request.GET.get("department")
            location = request.GET.get("location")
            shift_id = request.GET.get("shift")

            if employee_id:
                queryset = queryset.filter(employee_id=employee_id)
            if department:
                queryset = queryset.filter(employee__department_id=department)
            if location:
                queryset = queryset.filter(employee__location__icontains=location)
            if shift_id:
                queryset = queryset.filter(shift_id=shift_id)

        start_date = request.GET.get("start_date")
        end_date = request.GET.get("end_date")
        if start_date:
            queryset = queryset.filter(date__gte=_parse_date(start_date))
        if end_date:
            queryset = queryset.filter(date__lte=_parse_date(end_date))

        queryset = queryset.select_related("employee", "shift", "office_location").order_by("-date", "employee__name")
        rows = AttendanceRecordSerializer(queryset, many=True).data

        status_counts = {
            "present": 0,
            "late": 0,
            "half_day": 0,
            "leave": 0,
            "absent": 0,
        }
        total_working_hours = Decimal("0.00")
        total_overtime_hours = Decimal("0.00")

        for record in queryset:
            total_working_hours += Decimal(str(record.working_hours or 0))
            total_overtime_hours += Decimal(str(record.overtime_hours or 0))
            if record.status == AttendanceRecord.STATUS_PRESENT:
                status_counts["present"] += 1
            elif record.status == AttendanceRecord.STATUS_LATE:
                status_counts["late"] += 1
            elif record.status == AttendanceRecord.STATUS_HALF_DAY:
                status_counts["half_day"] += 1
            elif record.status == AttendanceRecord.STATUS_LEAVE:
                status_counts["leave"] += 1
            elif record.status == AttendanceRecord.STATUS_ABSENT:
                status_counts["absent"] += 1

        return Response(
            {
                "success": True,
                "count": len(rows),
                "report": rows,
                "summary": {
                    **status_counts,
                    "total_working_hours": float(total_working_hours.quantize(Decimal("0.01"))),
                    "total_overtime_hours": float(total_overtime_hours.quantize(Decimal("0.01"))),
                },
            },
            status=status.HTTP_200_OK,
        )
    except AttendanceServiceError as exc:
        return Response({"success": False, "message": exc.message}, status=exc.status_code)
    except Exception as exc:
        return Response({"success": False, "message": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([AllowAny])
def attendance_dashboard(request):
    try:
        _ensure_admin(request)
        target_date = _parse_date(request.GET.get("date"), default_value=timezone.localdate())

        employees = Employee.objects.filter(is_active=True, doj__lte=target_date).select_related("department", "shift")
        department = request.GET.get("department")
        location = request.GET.get("location")
        shift = request.GET.get("shift")

        if department:
            employees = employees.filter(department_id=department)
        if location:
            employees = employees.filter(location__icontains=location)
        if shift:
            assigned_ids = EmployeeShiftAssignment.objects.filter(
                is_active=True,
                shift_id=shift,
                effective_from__lte=target_date,
            ).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=target_date)).values_list("employee_id", flat=True)
            employees = employees.filter(id__in=assigned_ids)

        employee_rows = []
        present = 0
        late = 0
        leave = 0
        absent = 0

        for employee in employees:
            day_data = get_day_status(employee, target_date)
            status_code = day_data.get("status")
            if status_code in {AttendanceRecord.STATUS_PRESENT, AttendanceRecord.STATUS_LATE, AttendanceRecord.STATUS_HALF_DAY}:
                present += 1
            if status_code == AttendanceRecord.STATUS_LATE:
                late += 1
            if status_code == AttendanceRecord.STATUS_LEAVE:
                leave += 1
            if status_code in {AttendanceRecord.STATUS_ABSENT, "NOT_MARKED"}:
                absent += 1

            assigned_shift = day_data.get("shift") or (employee.shift.name if employee.shift else None)
            assigned_shift_id = day_data.get("shift_id") or employee.shift_id
            employee_rows.append(
                {
                    "employee_id": employee.id,
                    "employee_code": employee.employee_id,
                    "name": employee.name,
                    "department": employee.department.department_name if employee.department else None,
                    "location": employee.location,
                    "status": status_code,
                    "punch_in_time": day_data.get("punch_in_time"),
                    "punch_out_time": day_data.get("punch_out_time"),
                    "working_hours": day_data.get("working_hours", 0),
                    "assigned_shift_id": assigned_shift_id,
                    "assigned_shift": assigned_shift,
                    "shift_assignment_status": "Shift Assigned" if assigned_shift else "Not Assigned",
                }
            )

        trend = []
        for offset in range(6, -1, -1):
            day = target_date - timedelta(days=offset)
            day_present = 0
            day_late = 0
            day_leave = 0
            day_absent = 0
            for employee in employees:
                status_code = get_day_status(employee, day).get("status")
                if status_code in {AttendanceRecord.STATUS_PRESENT, AttendanceRecord.STATUS_LATE, AttendanceRecord.STATUS_HALF_DAY}:
                    day_present += 1
                if status_code == AttendanceRecord.STATUS_LATE:
                    day_late += 1
                if status_code == AttendanceRecord.STATUS_LEAVE:
                    day_leave += 1
                if status_code in {AttendanceRecord.STATUS_ABSENT, "NOT_MARKED"}:
                    day_absent += 1
            trend.append(
                {
                    "date": day.isoformat(),
                    "present": day_present,
                    "late": day_late,
                    "leave": day_leave,
                    "absent": day_absent,
                }
            )

        shift_breakdown = []
        assignments = (
            EmployeeShiftAssignment.objects.select_related("shift")
            .filter(
                is_active=True,
                effective_from__lte=target_date,
            )
            .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=target_date))
        )
        if employees:
            assignments = assignments.filter(employee_id__in=employees.values_list("id", flat=True))

        shift_count = {}
        for assignment in assignments:
            shift_name = assignment.shift.name if assignment.shift else "Unassigned"
            shift_count[shift_name] = shift_count.get(shift_name, 0) + 1
        for key, value in shift_count.items():
            shift_breakdown.append({"shift": key, "employees": value})

        return Response(
            {
                "success": True,
                "date": target_date.isoformat(),
                "summary": {
                    "total_employees": employees.count(),
                    "present": present,
                    "late": late,
                    "leave": leave,
                    "absent": absent,
                },
                "filters": {
                    "department": department,
                    "location": location,
                    "shift": shift,
                },
                "trend": trend,
                "shift_breakdown": shift_breakdown,
                "employees": employee_rows,
            },
            status=status.HTTP_200_OK,
        )
    except AttendanceServiceError as exc:
        return Response({"success": False, "message": exc.message}, status=exc.status_code)
    except Exception as exc:
        return Response({"success": False, "message": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def shifts_collection(request):
    if request.method == "GET":
        _ensure_default_it_shifts(request.user)
        shifts = Shift.objects.filter(is_active=True).order_by("name")
        return Response({"success": True, "shifts": ShiftSerializer(shifts, many=True).data})

    serializer = ShiftSerializer(data=request.data)
    if serializer.is_valid():
        shift = serializer.save(created_by=request.user)
        return Response(
            {"success": True, "message": "Shift created successfully.", "shift": ShiftSerializer(shift).data},
            status=status.HTTP_201_CREATED,
        )
    return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def shift_detail(request, shift_id):
    try:
        shift = Shift.objects.get(id=shift_id)
    except Shift.DoesNotExist:
        return Response({"success": False, "message": "Shift not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        shift.is_active = False
        shift.save(update_fields=["is_active", "updated_at"])
        return Response({"success": True, "message": "Shift deactivated."})

    serializer = ShiftSerializer(shift, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({"success": True, "shift": serializer.data})
    return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def office_location_collection(request):
    if request.method == "GET":
        locations = OfficeLocation.objects.all().order_by("name")
        return Response({"success": True, "office_locations": OfficeLocationSerializer(locations, many=True).data})

    serializer = OfficeLocationSerializer(data=request.data)
    if serializer.is_valid():
        location = serializer.save()
        return Response(
            {
                "success": True,
                "message": "Office location created successfully.",
                "office_location": OfficeLocationSerializer(location).data,
            },
            status=status.HTTP_201_CREATED,
        )
    return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def office_location_detail(request, location_id):
    try:
        location = OfficeLocation.objects.get(id=location_id)
    except OfficeLocation.DoesNotExist:
        return Response({"success": False, "message": "Office location not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        location.is_active = False
        location.save(update_fields=["is_active", "updated_at"])
        return Response({"success": True, "message": "Office location deactivated."})

    serializer = OfficeLocationSerializer(location, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({"success": True, "office_location": serializer.data})
    return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def attendance_policy_collection(request):
    if request.method == "GET":
        policies = AttendancePolicy.objects.all().order_by("name")
        return Response({"success": True, "policies": AttendancePolicySerializer(policies, many=True).data})

    serializer = AttendancePolicySerializer(data=request.data)
    if serializer.is_valid():
        policy = serializer.save()
        return Response(
            {"success": True, "message": "Attendance policy created.", "policy": AttendancePolicySerializer(policy).data},
            status=status.HTTP_201_CREATED,
        )
    return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def attendance_policy_detail(request, policy_id):
    try:
        policy = AttendancePolicy.objects.get(id=policy_id)
    except AttendancePolicy.DoesNotExist:
        return Response({"success": False, "message": "Policy not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        policy.is_active = False
        policy.save(update_fields=["is_active", "updated_at"])
        return Response({"success": True, "message": "Policy deactivated."})

    serializer = AttendancePolicySerializer(policy, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({"success": True, "policy": serializer.data})
    return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def holiday_collection(request):
    if request.method == "GET":
        holidays = Holiday.objects.all().order_by("holiday_date")
        return Response({"success": True, "holidays": HolidaySerializer(holidays, many=True).data})

    serializer = HolidaySerializer(data=request.data)
    if serializer.is_valid():
        holiday = serializer.save()
        return Response(
            {"success": True, "message": "Holiday created.", "holiday": HolidaySerializer(holiday).data},
            status=status.HTTP_201_CREATED,
        )
    return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def holiday_detail(request, holiday_id):
    try:
        holiday = Holiday.objects.get(id=holiday_id)
    except Holiday.DoesNotExist:
        return Response({"success": False, "message": "Holiday not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        holiday.delete()
        return Response({"success": True, "message": "Holiday deleted."})

    serializer = HolidaySerializer(holiday, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({"success": True, "holiday": serializer.data})
    return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def shift_assignment_collection(request):
    if request.method == "GET":
        employee_id = request.GET.get("employee_id")
        queryset = EmployeeShiftAssignment.objects.select_related("employee", "shift", "office_location", "policy")
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        queryset = queryset.order_by("-effective_from")
        serializer = EmployeeShiftAssignmentSerializer(queryset, many=True)
        return Response({"success": True, "assignments": serializer.data})

    try:
        employee_id = request.data.get("employee_id")
        shift_id = request.data.get("shift_id")
        office_location_id = request.data.get("office_location_id")
        policy_id = request.data.get("policy_id")
        effective_from = _parse_date(request.data.get("effective_from"), default_value=timezone.localdate())
        effective_to_raw = request.data.get("effective_to")
        effective_to = _parse_date(effective_to_raw) if effective_to_raw else None

        employee = Employee.objects.get(id=employee_id, is_active=True)
        shift = Shift.objects.get(id=shift_id, is_active=True)
        office_location = (
            OfficeLocation.objects.filter(id=office_location_id).first() if office_location_id else None
        )
        policy = AttendancePolicy.objects.filter(id=policy_id, is_active=True).first() if policy_id else None

        # Auto-close current open assignment before creating a new one.
        open_assignments = EmployeeShiftAssignment.objects.filter(
            employee=employee,
            is_active=True,
            effective_to__isnull=True,
            effective_from__lt=effective_from,
        )
        for existing in open_assignments:
            existing.effective_to = effective_from - timedelta(days=1)
            existing.save(update_fields=["effective_to", "updated_at"])

        assignment = EmployeeShiftAssignment(
            employee=employee,
            shift=shift,
            office_location=office_location,
            policy=policy,
            effective_from=effective_from,
            effective_to=effective_to,
            assigned_by=request.user,
            is_active=True,
        )
        assignment.full_clean()
        assignment.save()
        employee.shift = shift
        employee.save(update_fields=["shift", "updated_at"])

        record_queryset = AttendanceRecord.objects.filter(
            employee=employee,
            date__gte=effective_from,
            shift__isnull=True,
        )
        if effective_to:
            record_queryset = record_queryset.filter(date__lte=effective_to)
        else:
            record_queryset = record_queryset.filter(date__lte=timezone.localdate())
        record_queryset.update(shift=shift)

        serializer = EmployeeShiftAssignmentSerializer(assignment)
        return Response(
            {
                "success": True,
                "message": "Shift assigned successfully.",
                "assignment": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )
    except (Employee.DoesNotExist, Shift.DoesNotExist):
        return Response({"success": False, "message": "Employee or shift not found."}, status=status.HTTP_404_NOT_FOUND)
    except AttendanceServiceError as exc:
        return Response({"success": False, "message": exc.message}, status=exc.status_code)
    except Exception as exc:
        return Response({"success": False, "message": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([AllowAny])
def payroll_attendance_data(request):
    try:
        month, year = _parse_month_year(request)
        employee = resolve_employee_for_request(request, request.GET.get("employee_id"))
        metrics = get_payroll_metrics(employee, month, year)
        return Response({"success": True, "payroll_data": metrics}, status=status.HTTP_200_OK)
    except AttendanceServiceError as exc:
        return Response({"success": False, "message": exc.message}, status=exc.status_code)
    except Exception as exc:
        return Response({"success": False, "message": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def run_absent_automation(request):
    try:
        target_date = _parse_date(request.data.get("date"), default_value=timezone.localdate())
        result = mark_absent_for_date(target_date=target_date)
        return Response(
            {
                "success": True,
                "message": "Absent automation completed.",
                "result": result,
            },
            status=status.HTTP_200_OK,
        )
    except AttendanceServiceError as exc:
        return Response({"success": False, "message": exc.message}, status=exc.status_code)
    except Exception as exc:
        return Response({"success": False, "message": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([AllowAny])
def attendance_config_status(request):
    """
    Get the current attendance configuration status.
    Returns warnings about missing configurations.
    """
    config = check_attendance_configurations()
    return Response(
        {
            "success": True,
            "configured": config["configured"],
            "shifts_exist": config["shifts_exist"],
            "office_locations_exist": config["office_locations_exist"],
            "policies_exist": config["policies_exist"],
            "warnings": config["warnings"],
        },
        status=status.HTTP_200_OK,
    )
