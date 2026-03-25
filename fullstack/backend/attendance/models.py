from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models


def default_week_off_days():
    # Saturday + Sunday
    return [5, 6]


class Shift(models.Model):
    name = models.CharField(max_length=100, unique=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    late_after = models.TimeField()
    half_day_after = models.TimeField()
    overtime_allowed = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        "authentication.AdminUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_shifts",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "attendance_shifts"
        ordering = ["name"]

    def clean(self):
        if self.late_after < self.start_time:
            raise ValidationError("late_after cannot be earlier than start_time.")
        if self.half_day_after < self.late_after:
            raise ValidationError("half_day_after cannot be earlier than late_after.")

    def __str__(self):
        return self.name

    @property
    def shift_duration_hours(self) -> Decimal:
        start_dt = datetime.combine(date.today(), self.start_time)
        end_dt = datetime.combine(date.today(), self.end_time)
        if end_dt <= start_dt:
            end_dt += timedelta(days=1)
        duration = end_dt - start_dt
        hours = Decimal(duration.total_seconds()) / Decimal("3600")
        return hours.quantize(Decimal("0.01"))


class OfficeLocation(models.Model):
    name = models.CharField(max_length=120, unique=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    allowed_radius_meters = models.PositiveIntegerField(default=200)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "attendance_office_locations"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_default:
            OfficeLocation.objects.filter(is_default=True).exclude(id=self.id).update(is_default=False)

    def __str__(self):
        return self.name


class AttendancePolicy(models.Model):
    name = models.CharField(max_length=120, unique=True)
    default_shift = models.ForeignKey(
        Shift,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="default_policy_for",
    )
    default_office_location = models.ForeignKey(
        OfficeLocation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="default_policy_for",
    )
    enforce_gps = models.BooleanField(default=True)
    allow_remote_punch = models.BooleanField(default=False)
    auto_mark_absent = models.BooleanField(default=True)
    min_half_day_hours = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal("4.00"))
    full_day_hours = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal("8.00"))
    week_off_days = models.JSONField(default=default_week_off_days, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "attendance_policies"
        ordering = ["name"]

    def clean(self):
        if self.min_half_day_hours <= 0:
            raise ValidationError("min_half_day_hours must be greater than 0.")
        if self.full_day_hours <= 0:
            raise ValidationError("full_day_hours must be greater than 0.")
        if self.min_half_day_hours > self.full_day_hours:
            raise ValidationError("min_half_day_hours cannot exceed full_day_hours.")

    def __str__(self):
        return self.name


class Holiday(models.Model):
    name = models.CharField(max_length=120)
    holiday_date = models.DateField(unique=True)
    is_optional = models.BooleanField(default=False)
    location = models.ForeignKey(
        OfficeLocation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="holidays",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "attendance_holidays"
        ordering = ["holiday_date"]

    def __str__(self):
        return f"{self.name} ({self.holiday_date})"


class EmployeeShiftAssignment(models.Model):
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="shift_assignments",
    )
    shift = models.ForeignKey(
        Shift,
        on_delete=models.PROTECT,
        related_name="employee_assignments",
    )
    office_location = models.ForeignKey(
        OfficeLocation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employee_assignments",
    )
    policy = models.ForeignKey(
        AttendancePolicy,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employee_assignments",
    )
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    assigned_by = models.ForeignKey(
        "authentication.AdminUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shift_assignments_done",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "attendance_employee_shift_assignments"
        ordering = ["-effective_from", "-id"]
        indexes = [
            models.Index(fields=["employee", "effective_from", "effective_to"]),
            models.Index(fields=["is_active"]),
        ]

    def clean(self):
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValidationError("effective_to cannot be earlier than effective_from.")

        qs = EmployeeShiftAssignment.objects.filter(employee=self.employee, is_active=True)
        if self.id:
            qs = qs.exclude(id=self.id)

        for existing in qs:
            existing_end = existing.effective_to or date.max
            current_end = self.effective_to or date.max
            overlaps = existing.effective_from <= current_end and self.effective_from <= existing_end
            if overlaps:
                raise ValidationError("Assignment period overlaps with an existing active assignment.")

    def __str__(self):
        return f"{self.employee.name} -> {self.shift.name}"

    def is_applicable(self, target_date: date) -> bool:
        if not self.is_active:
            return False
        if self.effective_from > target_date:
            return False
        if self.effective_to and self.effective_to < target_date:
            return False
        return True


class AttendanceRecord(models.Model):
    STATUS_PRESENT = "PRESENT"
    STATUS_LATE = "LATE"
    STATUS_HALF_DAY = "HALF_DAY"
    STATUS_ABSENT = "ABSENT"
    STATUS_LEAVE = "LEAVE"
    STATUS_HOLIDAY = "HOLIDAY"
    STATUS_WEEK_OFF = "WEEK_OFF"

    STATUS_CHOICES = [
        (STATUS_PRESENT, "Present"),
        (STATUS_LATE, "Late"),
        (STATUS_HALF_DAY, "Half Day"),
        (STATUS_ABSENT, "Absent"),
        (STATUS_LEAVE, "Leave"),
        (STATUS_HOLIDAY, "Holiday"),
        (STATUS_WEEK_OFF, "Week Off"),
    ]

    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="attendance_records_v2",
    )
    shift = models.ForeignKey(
        Shift,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_records",
    )
    office_location = models.ForeignKey(
        OfficeLocation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_records",
    )
    date = models.DateField()
    punch_in_time = models.DateTimeField(null=True, blank=True)
    punch_out_time = models.DateTimeField(null=True, blank=True)
    punch_in_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    punch_in_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    punch_out_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    punch_out_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_verified = models.BooleanField(default=False)
    punch_out_location_verified = models.BooleanField(default=False)
    working_hours = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    overtime_hours = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ABSENT)
    notes = models.TextField(blank=True, null=True)
    marked_by_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "attendance_records"
        ordering = ["-date", "-id"]
        unique_together = ["employee", "date"]
        indexes = [
            models.Index(fields=["date", "status"]),
            models.Index(fields=["employee", "date"]),
            models.Index(fields=["employee", "date", "status"]),
            models.Index(fields=["punch_in_time"]),
            models.Index(fields=["punch_out_time"]),
        ]

    def __str__(self):
        return f"{self.employee.name} - {self.date} ({self.status})"

    def recalculate_working_hours(self):
        if not self.punch_in_time or not self.punch_out_time:
            self.working_hours = Decimal("0.00")
            return self.working_hours
        duration_seconds = max((self.punch_out_time - self.punch_in_time).total_seconds(), 0)
        hours = Decimal(duration_seconds) / Decimal("3600")
        self.working_hours = hours.quantize(Decimal("0.01"))
        return self.working_hours


class AttendanceAuditLog(models.Model):
    ACTOR_EMPLOYEE = "EMPLOYEE"
    ACTOR_ADMIN = "ADMIN"
    ACTOR_SYSTEM = "SYSTEM"
    ACTOR_CHOICES = [
        (ACTOR_EMPLOYEE, "Employee"),
        (ACTOR_ADMIN, "Admin"),
        (ACTOR_SYSTEM, "System"),
    ]

    ACTION_PUNCH_IN = "PUNCH_IN"
    ACTION_PUNCH_OUT = "PUNCH_OUT"
    ACTION_MANUAL_UPDATE = "MANUAL_UPDATE"
    ACTION_AUTO_ABSENT = "AUTO_ABSENT"
    ACTION_CREATE = "CREATE"
    ACTION_CHOICES = [
        (ACTION_PUNCH_IN, "Punch In"),
        (ACTION_PUNCH_OUT, "Punch Out"),
        (ACTION_MANUAL_UPDATE, "Manual Update"),
        (ACTION_AUTO_ABSENT, "Auto Absent"),
        (ACTION_CREATE, "Create"),
    ]

    attendance = models.ForeignKey(
        AttendanceRecord,
        on_delete=models.CASCADE,
        related_name="audit_logs",
    )
    actor_type = models.CharField(max_length=20, choices=ACTOR_CHOICES)
    actor_employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_actions",
    )
    actor_admin = models.ForeignKey(
        "authentication.AdminUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_admin_actions",
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    before_data = models.JSONField(default=dict, blank=True)
    after_data = models.JSONField(default=dict, blank=True)
    reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "attendance_audit_logs"
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.action} - {self.attendance_id}"


class MonthlyAttendanceSummary(models.Model):
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="monthly_attendance_summaries",
    )
    month = models.PositiveSmallIntegerField()
    year = models.PositiveSmallIntegerField()
    present_days = models.PositiveSmallIntegerField(default=0)
    late_days = models.PositiveSmallIntegerField(default=0)
    leave_days = models.PositiveSmallIntegerField(default=0)
    absent_days = models.PositiveSmallIntegerField(default=0)
    half_days = models.PositiveSmallIntegerField(default=0)
    total_working_hours = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0.00"))
    overtime_hours = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0.00"))
    payable_days = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    generated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "attendance_monthly_summaries"
        unique_together = ["employee", "month", "year"]
        ordering = ["-year", "-month", "employee__name"]
        indexes = [
            models.Index(fields=["employee", "month", "year"]),
            models.Index(fields=["month", "year"]),
        ]

    def __str__(self):
        return f"{self.employee.name} - {self.month}/{self.year}"
