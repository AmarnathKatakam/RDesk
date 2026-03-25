from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from departments.models import Department
from employees.models import Employee, LeaveRequest, LeaveType

from .models import AttendanceRecord, AttendancePolicy, EmployeeShiftAssignment, OfficeLocation, Shift
from .services import generate_monthly_summary, mark_absent_for_date

User = get_user_model()


class AttendanceAPITestCase(APITestCase):
    def setUp(self):
        self.department = Department.objects.create(
            department_code="ENG001",
            department_name="Engineering",
        )
        self.admin = User.objects.create_user(
            username="adminuser",
            email="admin@example.com",
            password="adminpass123",
            full_name="Admin User",
        )
        self.employee = Employee.objects.create(
            employee_id="EMP1001",
            name="John Doe",
            position="Engineer",
            department=self.department,
            dob=date(1995, 1, 1),
            doj=date(2024, 1, 1),
            pan="ABCDE1234F",
            pf_number="PF12345",
            bank_account="123456789012",
            bank_ifsc="HDFC0123456",
            pay_mode="NEFT",
            location="Bangalore",
            email="john.doe@blackroth.in",
            is_active=True,
            account_activated=True,
            onboarding_completed=True,
        )
        self.shift = Shift.objects.create(
            name="General Shift",
            start_time=time(0, 0),
            end_time=time(23, 59),
            late_after=time(23, 59),
            half_day_after=time(23, 59),
            overtime_allowed=True,
            is_active=True,
            created_by=self.admin,
        )
        self.location = OfficeLocation.objects.create(
            name="HQ",
            latitude=Decimal("12.971600"),
            longitude=Decimal("77.594600"),
            allowed_radius_meters=500,
            is_default=True,
            is_active=True,
        )
        self.policy = AttendancePolicy.objects.create(
            name="Default Policy",
            default_shift=self.shift,
            default_office_location=self.location,
            enforce_gps=True,
            allow_remote_punch=False,
            auto_mark_absent=True,
            week_off_days=[5, 6],
        )
        EmployeeShiftAssignment.objects.create(
            employee=self.employee,
            shift=self.shift,
            office_location=self.location,
            policy=self.policy,
            effective_from=date(2024, 1, 1),
            is_active=True,
            assigned_by=self.admin,
        )
        session = self.client.session
        session["employee_id"] = self.employee.id
        session.save()

    def test_punch_in_and_punch_out_success(self):
        punch_in_res = self.client.post(
            "/api/attendance/punch-in",
            {
                "latitude": "12.971610",
                "longitude": "77.594610",
            },
            format="json",
        )
        self.assertEqual(punch_in_res.status_code, 200)
        self.assertTrue(punch_in_res.data["success"])

        punch_out_res = self.client.post(
            "/api/attendance/punch-out",
            {
                "latitude": "12.971610",
                "longitude": "77.594610",
            },
            format="json",
        )
        self.assertEqual(punch_out_res.status_code, 200)
        self.assertTrue(punch_out_res.data["success"])
        self.assertIn("attendance", punch_out_res.data)

        today_record = AttendanceRecord.objects.get(employee=self.employee, date=timezone.localdate())
        self.assertIsNotNone(today_record.punch_in_time)
        self.assertIsNotNone(today_record.punch_out_time)

    def test_duplicate_punch_in_is_blocked(self):
        self.client.post(
            "/api/attendance/punch-in",
            {"latitude": "12.971610", "longitude": "77.594610"},
            format="json",
        )
        second_response = self.client.post(
            "/api/attendance/punch-in",
            {"latitude": "12.971610", "longitude": "77.594610"},
            format="json",
        )
        self.assertEqual(second_response.status_code, 409)
        self.assertFalse(second_response.data["success"])

    def test_punch_in_outside_radius_is_rejected(self):
        response = self.client.post(
            "/api/attendance/punch-in",
            {"latitude": "13.035000", "longitude": "77.700000"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(response.data["success"])

    def test_leave_day_blocks_punch_in(self):
        leave_type = LeaveType.objects.create(name="Sick Leave", max_days_per_year=12, is_active=True)
        today = timezone.localdate()
        LeaveRequest.objects.create(
            employee=self.employee,
            leave_type=leave_type,
            start_date=today,
            end_date=today,
            reason="Medical",
            status="APPROVED",
            approved_by=self.admin,
            approved_date=timezone.now(),
        )

        response = self.client.post(
            "/api/attendance/punch-in",
            {"latitude": "12.971610", "longitude": "77.594610"},
            format="json",
        )
        self.assertEqual(response.status_code, 409)
        self.assertFalse(response.data["success"])

    def test_absent_automation_marks_employee_absent(self):
        employee_two = Employee.objects.create(
            employee_id="EMP1002",
            name="Jane Doe",
            position="Analyst",
            department=self.department,
            dob=date(1994, 2, 2),
            doj=date(2024, 1, 1),
            pan="XYZAB1234C",
            pf_number="PF54321",
            bank_account="123450987654",
            bank_ifsc="ICIC0123456",
            pay_mode="NEFT",
            location="Bangalore",
            email="jane.doe@blackroth.in",
            is_active=True,
            account_activated=True,
            onboarding_completed=True,
        )
        EmployeeShiftAssignment.objects.create(
            employee=employee_two,
            shift=self.shift,
            office_location=self.location,
            policy=self.policy,
            effective_from=date(2024, 1, 1),
            is_active=True,
            assigned_by=self.admin,
        )

        target_date = timezone.localdate() - timedelta(days=1)
        # Ensure target date is weekday for deterministic absent marking.
        while target_date.weekday() >= 5:
            target_date -= timedelta(days=1)

        result = mark_absent_for_date(target_date=target_date)
        self.assertIn("created", result)

        record = AttendanceRecord.objects.get(employee=employee_two, date=target_date)
        self.assertEqual(record.status, AttendanceRecord.STATUS_ABSENT)

    def test_monthly_summary_includes_late_and_leave(self):
        today = timezone.localdate()
        month = today.month
        year = today.year

        # Create records for past weekdays in current month.
        days = []
        cursor = date(year, month, 1)
        while len(days) < 3 and cursor <= today:
            if cursor.weekday() < 5:
                days.append(cursor)
            cursor += timedelta(days=1)

        if len(days) < 3:
            self.skipTest("Not enough weekdays in range for test setup.")

        AttendanceRecord.objects.update_or_create(
            employee=self.employee,
            date=days[0],
            defaults={
                "shift": self.shift,
                "office_location": self.location,
                "status": AttendanceRecord.STATUS_PRESENT,
                "punch_in_time": timezone.make_aware(datetime.combine(days[0], time(9, 30))),
                "punch_out_time": timezone.make_aware(datetime.combine(days[0], time(18, 0))),
                "working_hours": Decimal("8.50"),
            },
        )
        AttendanceRecord.objects.update_or_create(
            employee=self.employee,
            date=days[1],
            defaults={
                "shift": self.shift,
                "office_location": self.location,
                "status": AttendanceRecord.STATUS_LATE,
                "punch_in_time": timezone.make_aware(datetime.combine(days[1], time(10, 30))),
                "punch_out_time": timezone.make_aware(datetime.combine(days[1], time(18, 0))),
                "working_hours": Decimal("7.50"),
            },
        )

        leave_type = LeaveType.objects.create(name="Casual Leave", max_days_per_year=12, is_active=True)
        LeaveRequest.objects.create(
            employee=self.employee,
            leave_type=leave_type,
            start_date=days[2],
            end_date=days[2],
            reason="Personal",
            status="APPROVED",
            approved_by=self.admin,
            approved_date=timezone.now(),
        )

        summary = generate_monthly_summary(self.employee, month=month, year=year)
        self.assertGreaterEqual(summary.present_days, 2)
        self.assertGreaterEqual(summary.late_days, 1)
        self.assertGreaterEqual(summary.leave_days, 1)
