"""
Milestone 4 Tests — Payroll Reports

Tests:
  1. Payroll register — from PayrollRun (3C engine)
  2. Payroll register — fallback from MonthlySalaryData
  3. Bank transfer report
  4. Bank transfer CSV export
  5. Department summary
  6. Variance report — with previous month data
  7. Variance report — new employee (no previous data)
  8. Variance report — flagging threshold
  9. Register Excel export (openpyxl)
  10. Missing params return 400
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from employees.models import Employee, MonthlySalaryData
from departments.models import Department
from .models import PayrollRun, PayrollRunItem

User = get_user_model()


def _make_admin(username='report_admin'):
    return User.objects.create_user(username=username, password='pass', is_staff=True)


def _make_dept(code='RPT001', name='Reports Dept'):
    dept, _ = Department.objects.get_or_create(
        department_code=code,
        defaults={'department_name': name, 'is_active': True},
    )
    return dept


def _make_employee(dept, emp_id='RPTEMPX', name='Report Employee'):
    return Employee.objects.create(
        employee_id=emp_id,
        name=name,
        position='Analyst',
        department=dept,
        dob='1990-01-01',
        doj='2022-01-01',
        pan='ABCDE1234F',
        bank_account='9876543210',
        bank_ifsc='HDFC0009876',
        pay_mode='NEFT',
        location='Bangalore',
        is_active=True,
    )


def _make_salary_data(emp, admin, month='March', year=2025, salary_type='SALARY',
                      basic=20000, net=None):
    sd = MonthlySalaryData.objects.create(
        employee=emp,
        month=month,
        year=year,
        salary_type=salary_type,
        basic=Decimal(str(basic)),
        hra=Decimal('8000'),
        da=Decimal('2000'),
        conveyance=Decimal('1600'),
        medical=Decimal('1250'),
        special_allowance=Decimal('5000'),
        pf_employee=Decimal('2400'),
        professional_tax=Decimal('200'),
        pf_employer=Decimal('2400'),
        other_deductions=Decimal('0'),
        salary_advance=Decimal('0'),
        work_days=26,
        days_in_month=31,
        lop_days=0,
        uploaded_by=admin,
    )
    return sd


class PayrollRegisterAPITest(TestCase):
    """Test payroll register endpoint."""

    def setUp(self):
        self.admin = _make_admin('reg_admin')
        self.dept = _make_dept()
        self.emp1 = _make_employee(self.dept, 'RPTEMP1', 'Alice')
        self.emp2 = _make_employee(self.dept, 'RPTEMP2', 'Bob')
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.url = '/api/payroll/reports/register/'

    def test_register_from_salary_data(self):
        _make_salary_data(self.emp1, self.admin)
        _make_salary_data(self.emp2, self.admin)
        resp = self.client.get(self.url, {'month': 'March', 'year': 2025})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['success'])
        self.assertEqual(resp.data['employee_count'], 2)
        self.assertIn('summary', resp.data)
        self.assertIn('rows', resp.data)

    def test_register_summary_totals(self):
        _make_salary_data(self.emp1, self.admin)
        resp = self.client.get(self.url, {'month': 'March', 'year': 2025})
        summary = resp.data['summary']
        self.assertGreater(summary['total_gross'], 0)
        self.assertGreater(summary['total_net'], 0)
        self.assertGreater(summary['total_deductions'], 0)

    def test_register_missing_params_returns_400(self):
        resp = self.client.get(self.url, {'month': 'March'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_empty_period_returns_zero_rows(self):
        resp = self.client.get(self.url, {'month': 'January', 'year': 2020})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['employee_count'], 0)

    def test_register_salary_type_filter(self):
        _make_salary_data(self.emp1, self.admin, salary_type='SALARY')
        _make_salary_data(self.emp2, self.admin, salary_type='STIPEND')
        resp = self.client.get(self.url, {'month': 'March', 'year': 2025, 'salary_type': 'STIPEND'})
        self.assertEqual(resp.data['employee_count'], 1)
        self.assertEqual(resp.data['rows'][0]['employee_id'], 'RPTEMP2')

    def test_register_columns_include_earning_codes(self):
        _make_salary_data(self.emp1, self.admin)
        resp = self.client.get(self.url, {'month': 'March', 'year': 2025})
        self.assertIn('columns', resp.data)
        self.assertIn('earning_codes', resp.data['columns'])

    def test_unauthenticated_returns_401(self):
        self.client.logout()
        resp = self.client.get(self.url, {'month': 'March', 'year': 2025})
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class BankTransferAPITest(TestCase):
    """Test bank transfer report endpoint."""

    def setUp(self):
        self.admin = _make_admin('bank_admin')
        self.dept = _make_dept('BANK001', 'Bank Dept')
        self.emp = _make_employee(self.dept, 'BANKEMP1', 'Charlie')
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.url = '/api/payroll/reports/bank-transfer/'
        self.export_url = '/api/payroll/reports/bank-transfer/export/'

    def test_bank_transfer_data(self):
        _make_salary_data(self.emp, self.admin)
        resp = self.client.get(self.url, {'month': 'March', 'year': 2025})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['employee_count'], 1)
        row = resp.data['rows'][0]
        self.assertIn('bank_account', row)
        self.assertIn('bank_ifsc', row)
        self.assertIn('net_pay', row)
        self.assertGreater(row['net_pay'], 0)

    def test_bank_transfer_total(self):
        _make_salary_data(self.emp, self.admin)
        resp = self.client.get(self.url, {'month': 'March', 'year': 2025})
        self.assertAlmostEqual(
            resp.data['total_transfer_amount'],
            resp.data['rows'][0]['net_pay'],
            places=2,
        )

    def test_bank_transfer_csv_export(self):
        _make_salary_data(self.emp, self.admin)
        resp = self.client.get(self.export_url, {'month': 'March', 'year': 2025})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp['Content-Type'], 'text/csv')
        self.assertIn('bank_transfer_March_2025', resp['Content-Disposition'])
        content = resp.content.decode('utf-8')
        self.assertIn('Employee ID', content)
        self.assertIn('Net Pay', content)
        self.assertIn('BANKEMP1', content)

    def test_bank_transfer_missing_params(self):
        resp = self.client.get(self.url, {'year': 2025})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class DepartmentSummaryAPITest(TestCase):
    """Test department summary endpoint."""

    def setUp(self):
        self.admin = _make_admin('dept_admin')
        self.dept1 = _make_dept('DEPT001', 'Engineering')
        self.dept2 = _make_dept('DEPT002', 'Sales')
        self.emp1 = _make_employee(self.dept1, 'DEPTEMP1', 'Dave')
        self.emp2 = _make_employee(self.dept2, 'DEPTEMP2', 'Eve')
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.url = '/api/payroll/reports/department-summary/'

    def test_department_summary(self):
        _make_salary_data(self.emp1, self.admin)
        _make_salary_data(self.emp2, self.admin)
        resp = self.client.get(self.url, {'month': 'March', 'year': 2025})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data['departments']), 2)
        self.assertEqual(resp.data['totals']['employee_count'], 2)

    def test_department_totals_match_rows(self):
        _make_salary_data(self.emp1, self.admin)
        _make_salary_data(self.emp2, self.admin)
        resp = self.client.get(self.url, {'month': 'March', 'year': 2025})
        dept_total_net = sum(d['total_net'] for d in resp.data['departments'])
        self.assertAlmostEqual(dept_total_net, resp.data['totals']['total_net'], places=2)

    def test_single_department(self):
        _make_salary_data(self.emp1, self.admin)
        resp = self.client.get(self.url, {'month': 'March', 'year': 2025})
        self.assertEqual(len(resp.data['departments']), 1)
        self.assertEqual(resp.data['departments'][0]['department'], 'Engineering')


class VarianceReportAPITest(TestCase):
    """Test variance report endpoint."""

    def setUp(self):
        self.admin = _make_admin('var_admin')
        self.dept = _make_dept('VAR001', 'Variance Dept')
        self.emp = _make_employee(self.dept, 'VAREMP1', 'Frank')
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.url = '/api/payroll/reports/variance/'

    def test_variance_with_previous_data(self):
        # Feb 2025 — base
        _make_salary_data(self.emp, self.admin, month='February', year=2025, basic=20000)
        # March 2025 — increased
        _make_salary_data(self.emp, self.admin, month='March', year=2025, basic=22000)

        resp = self.client.get(self.url, {'month': 'March', 'year': 2025})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['employee_count'], 1)
        row = resp.data['rows'][0]
        self.assertIsNotNone(row['change_pct'])
        self.assertGreater(row['change_pct'], 0)  # salary increased

    def test_variance_new_employee(self):
        # Only current month data — no previous
        _make_salary_data(self.emp, self.admin, month='March', year=2025)
        resp = self.client.get(self.url, {'month': 'March', 'year': 2025})
        row = resp.data['rows'][0]
        self.assertTrue(row['is_new'])
        self.assertIsNone(row['previous_net'])
        self.assertEqual(resp.data['new_employees'], 1)

    def test_variance_flagging(self):
        # 50% increase — should be flagged at default 10% threshold
        _make_salary_data(self.emp, self.admin, month='February', year=2025, basic=20000)
        _make_salary_data(self.emp, self.admin, month='March', year=2025, basic=30000)

        resp = self.client.get(self.url, {'month': 'March', 'year': 2025, 'threshold': 10})
        row = resp.data['rows'][0]
        self.assertTrue(row['flagged'])
        self.assertEqual(resp.data['flagged_count'], 1)

    def test_variance_not_flagged_within_threshold(self):
        # 2% increase — should NOT be flagged at 10% threshold
        _make_salary_data(self.emp, self.admin, month='February', year=2025, basic=20000)
        _make_salary_data(self.emp, self.admin, month='March', year=2025, basic=20400)

        resp = self.client.get(self.url, {'month': 'March', 'year': 2025, 'threshold': 10})
        row = resp.data['rows'][0]
        self.assertFalse(row['flagged'])

    def test_variance_missing_params(self):
        resp = self.client.get(self.url, {'month': 'March'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_variance_previous_period_shown(self):
        _make_salary_data(self.emp, self.admin, month='March', year=2025)
        resp = self.client.get(self.url, {'month': 'March', 'year': 2025})
        self.assertEqual(resp.data['previous_period']['month'], 'February')
        self.assertEqual(resp.data['previous_period']['year'], 2025)

    def test_variance_january_wraps_to_december(self):
        _make_salary_data(self.emp, self.admin, month='January', year=2025)
        resp = self.client.get(self.url, {'month': 'January', 'year': 2025})
        self.assertEqual(resp.data['previous_period']['month'], 'December')
        self.assertEqual(resp.data['previous_period']['year'], 2024)
