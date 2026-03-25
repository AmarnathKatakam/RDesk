from rest_framework import serializers

from .models import (
    AttendancePolicy,
    AttendanceRecord,
    EmployeeShiftAssignment,
    Holiday,
    MonthlyAttendanceSummary,
    OfficeLocation,
    Shift,
)


class ShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shift
        fields = [
            "id",
            "name",
            "start_time",
            "end_time",
            "late_after",
            "half_day_after",
            "overtime_allowed",
            "is_active",
            "created_at",
            "updated_at",
        ]


class OfficeLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = OfficeLocation
        fields = [
            "id",
            "name",
            "latitude",
            "longitude",
            "allowed_radius_meters",
            "is_active",
            "is_default",
            "created_at",
            "updated_at",
        ]


class AttendancePolicySerializer(serializers.ModelSerializer):
    default_shift_name = serializers.CharField(source="default_shift.name", read_only=True)
    default_office_location_name = serializers.CharField(
        source="default_office_location.name",
        read_only=True,
    )

    class Meta:
        model = AttendancePolicy
        fields = [
            "id",
            "name",
            "default_shift",
            "default_shift_name",
            "default_office_location",
            "default_office_location_name",
            "enforce_gps",
            "allow_remote_punch",
            "auto_mark_absent",
            "min_half_day_hours",
            "full_day_hours",
            "week_off_days",
            "is_active",
            "created_at",
            "updated_at",
        ]


class HolidaySerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source="location.name", read_only=True)

    class Meta:
        model = Holiday
        fields = [
            "id",
            "name",
            "holiday_date",
            "is_optional",
            "location",
            "location_name",
            "created_at",
            "updated_at",
        ]


class EmployeeShiftAssignmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_id", read_only=True)
    shift_name = serializers.CharField(source="shift.name", read_only=True)
    office_location_name = serializers.CharField(source="office_location.name", read_only=True)
    policy_name = serializers.CharField(source="policy.name", read_only=True)

    class Meta:
        model = EmployeeShiftAssignment
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_code",
            "shift",
            "shift_name",
            "office_location",
            "office_location_name",
            "policy",
            "policy_name",
            "effective_from",
            "effective_to",
            "is_active",
            "created_at",
            "updated_at",
        ]


class AttendanceRecordSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_id", read_only=True)
    shift_name = serializers.CharField(source="shift.name", read_only=True)
    office_location_name = serializers.CharField(source="office_location.name", read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_code",
            "shift",
            "shift_name",
            "office_location",
            "office_location_name",
            "date",
            "punch_in_time",
            "punch_out_time",
            "punch_in_latitude",
            "punch_in_longitude",
            "punch_out_latitude",
            "punch_out_longitude",
            "location_verified",
            "punch_out_location_verified",
            "working_hours",
            "overtime_hours",
            "status",
            "notes",
            "marked_by_system",
            "created_at",
            "updated_at",
        ]


class MonthlyAttendanceSummarySerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_id", read_only=True)

    class Meta:
        model = MonthlyAttendanceSummary
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_code",
            "month",
            "year",
            "present_days",
            "late_days",
            "leave_days",
            "absent_days",
            "half_days",
            "total_working_hours",
            "overtime_hours",
            "payable_days",
            "generated_at",
        ]
