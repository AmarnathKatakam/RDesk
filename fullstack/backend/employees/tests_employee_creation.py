from datetime import time

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from attendance.models import Shift
from authentication.models import AdminUser
from departments.models import Department
from employees.models import Employee, EmployeeInvitation


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class EmployeeCreationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = AdminUser.objects.create_user(
            username="admin",
            email="admin@blackroth.in",
            password="password123",
            full_name="Admin User",
        )
        self.client.force_authenticate(user=self.admin)
        self.department = Department.objects.create(
            department_code="DEV001",
            department_name="Development",
        )
        self.shift = Shift.objects.create(
            name="General",
            start_time=time(9, 0),
            end_time=time(18, 0),
            late_after=time(9, 15),
            half_day_after=time(13, 0),
        )

    def test_create_employee_uses_official_email_when_personal_email_missing(self):
        response = self.client.post(
            "/api/employees/",
            {
                "employee_id": "br26py9900",
                "name": "Ajay Sirivaram",
                "email": "Ajaysirivaram@blackroth.in",
                "position": "Software enginner",
                "department_id": self.department.id,
                "shift_id": self.shift.id,
                "location": "Hyderabad",
                "doj": "01-11-2025",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        employee = Employee.objects.get(employee_id="BR26PY9900")
        self.assertEqual(employee.email, "ajaysirivaram@blackroth.in")
        self.assertIsNone(employee.personal_email)
        self.assertEqual(employee.shift, self.shift)

        invitation = EmployeeInvitation.objects.get(employee=employee)
        self.assertEqual(invitation.email, "ajaysirivaram@blackroth.in")

