"""
tests_monthly_salary_seeding.py

Test suite for monthly salary seeding service and related APIs.

Covers:
1. Seeding service (seed_monthly_salary_data)
2. API endpoint (POST /payroll/monthly-inputs/process/)
3. Fetch endpoint with all employees (GET /monthly-salaries/by-period/)
4. Upsert endpoint for full salary editing
"""

from decimal import Decimal
from datetime import date, timedelta
from django.test import TestCase, TransactionTestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from employees.models import Employee, MonthlySalaryData, PayrollInputAdjustment
from departments.models import Department
from payroll_config.models import SalaryTemplate, EmployeeSalaryAssignment
from employees.monthly_salary_services import seed_monthly_salary_data


class MonthlySalarySeederTests(TransactionTestCase):
    """Test the seed_monthly_salary_data service function."""

    def setUp(self):
        """Set up test data."""
        # Create department
        self.dept = Department.objects.create(
            department_code='ENG',
            department_name='Engineering'
        )
        
        # Create admin user
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@test.com',
            password='adminpass123',
            is_staff=True,
            is_superuser=True
        )
        
        # Create salary template
        self.template = SalaryTemplate.objects.create(
            code='STD',
            name='Standard Template',
            description='Standard salary template',
            is_active=True,
            created_by=self.admin_user
        )
        
        # Create employees
        self.emp1 = Employee.objects.create(
            employee_id='EMP001',
            name='John Doe',
            position='Software Engineer',
            department=self.dept,
            dob=date(1990, 1, 15),
            doj=date(2020, 1, 1),
            pan='ABCDE1234F',
            bank_account='1234567890',
            bank_ifsc='ICIC0000001',
            is_active=True
        )
        
        self.emp2 = Employee.objects.create(
            employee_id='EMP002',
            name='Jane Smith',
            position='Product Manager',
            department=self.dept,
            dob=date(1992, 5, 20),
            doj=date(2021, 6, 1),
            pan='DEFGH5678I',
            bank_account='0987654321',
            bank_ifsc='HDFC0000001',
            is_active=True
        )
        
        # Inactive employee (should be skipped)
        self.emp3 = Employee.objects.create(
            employee_id='EMP003',
            name='Inactive User',
            position='Contractor',
            department=self.dept,
            dob=date(1995, 3, 10),
            doj=date(2022, 1, 1),
            pan='IJKLM9101K',
            bank_account='1111111111',
            bank_ifsc='AXIS0000001',
            is_active=False
        )
        
        # Create salary assignments
        EmployeeSalaryAssignment.objects.create(
            employee=self.emp1,
            template=self.template,
            annual_ctc=Decimal('600000'),
            effective_from=date(2024, 1, 1),
            is_active=True,
            created_by=self.admin_user
        )
        
        EmployeeSalaryAssignment.objects.create(
            employee=self.emp2,
            template=self.template,
            annual_ctc=Decimal('840000'),
            effective_from=date(2024, 1, 1),
            is_active=True,
            created_by=self.admin_user
        )

    def test_seed_first_month_creates_records(self):
        """Test that seeding first month creates records for active employees."""
        result = seed_monthly_salary_data('January', 2025, created_by=self.admin_user)
        
        self.assertTrue(result['success'])
        self.assertEqual(result['created'], 2)  # 2 active employees
        self.assertEqual(result['derived'], 2)  # Both derived from assignment
        self.assertEqual(result['carry_forward'], 0)  # First month, no previous data
        self.assertEqual(len(result['errors']), 0)
        
        # Verify records created
        jan_records = MonthlySalaryData.objects.filter(month='January', year=2025)
        self.assertEqual(jan_records.count(), 2)
        
        # Verify source is DERIVED
        for record in jan_records:
            self.assertEqual(record.source, 'DERIVED')
            self.assertIsNotNone(record.basic)
            self.assertGreater(record.basic, 0)

    def test_seed_skips_existing_records(self):
        """Test that seeding skips employees with existing data."""
        # Create existing record for emp1
        MonthlySalaryData.objects.create(
            employee=self.emp1,
            month='February',
            year=2025,
            salary_type='SALARY',
            basic=Decimal('20000'),
            hra=Decimal('5000'),
            da=Decimal('2000'),
            conveyance=Decimal('1600'),
            medical=Decimal('1250'),
            special_allowance=Decimal('5150'),
            pf_employee=Decimal('2400'),
            professional_tax=Decimal('200'),
            pf_employer=Decimal('2400'),
            work_days=26,
            days_in_month=30,
            lop_days=0,
            remarks='Existing record',
            source='MANUAL_ENTRY',
            uploaded_by=self.admin_user
        )
        
        # Seed the same month
        result = seed_monthly_salary_data('February', 2025, created_by=self.admin_user)
        
        self.assertTrue(result['success'])
        self.assertEqual(result['created'], 1)  # Only emp2
        self.assertEqual(result['skipped'], 1)  # emp1 skipped
        self.assertEqual(result['derived'], 1)

    def test_seed_carry_forward_from_previous_month(self):
        """Test that seeding carries forward data from previous month."""
        # Create January data
        prev_data = MonthlySalaryData.objects.create(
            employee=self.emp1,
            month='January',
            year=2025,
            salary_type='SALARY',
            basic=Decimal('20000'),
            hra=Decimal('5000'),
            da=Decimal('2000'),
            conveyance=Decimal('1600'),
            medical=Decimal('1250'),
            special_allowance=Decimal('5150'),
            pf_employee=Decimal('2400'),
            professional_tax=Decimal('200'),
            pf_employer=Decimal('2400'),
            work_days=26,
            days_in_month=30,
            lop_days=0,
            bonus=Decimal('5000'),
            remarks='January data',
            source='DERIVED',
            uploaded_by=self.admin_user
        )
        
        # Seed February
        result = seed_monthly_salary_data('February', 2025, created_by=self.admin_user)
        
        self.assertTrue(result['success'])
        self.assertEqual(result['carry_forward'], 1)  # emp1 carried forward
        
        # Verify carried forward data
        feb_data = MonthlySalaryData.objects.get(
            employee=self.emp1, month='February', year=2025
        )
        
        # Components should match
        self.assertEqual(feb_data.basic, prev_data.basic)
        self.assertEqual(feb_data.hra, prev_data.hra)
        self.assertEqual(feb_data.da, prev_data.da)
        
        # But one-time adjustments should be reset
        self.assertEqual(feb_data.bonus, Decimal('0'))
        self.assertEqual(feb_data.source, 'CARRY_FORWARD')

    def test_seed_copies_recurring_adjustments(self):
        """Test that recurring adjustments are copied to next month."""
        # Create January data
        MonthlySalaryData.objects.create(
            employee=self.emp1,
            month='January',
            year=2025,
            salary_type='SALARY',
            basic=Decimal('20000'),
            hra=Decimal('5000'),
            da=Decimal('2000'),
            conveyance=Decimal('1600'),
            medical=Decimal('1250'),
            special_allowance=Decimal('5150'),
            pf_employee=Decimal('2400'),
            professional_tax=Decimal('200'),
            pf_employer=Decimal('2400'),
            work_days=26,
            days_in_month=30,
            lop_days=0,
            source='DERIVED',
            uploaded_by=self.admin_user
        )
        
        # Create recurring and non-recurring adjustments
        PayrollInputAdjustment.objects.create(
            employee=self.emp1,
            month='January',
            year=2025,
            salary_type='SALARY',
            adjustment_type='BONUS',
            label='Diwali Bonus',
            amount=Decimal('10000'),
            is_taxable=False,
            is_recurring=False,  # One-time
            is_active=True,
            created_by=self.admin_user
        )
        
        PayrollInputAdjustment.objects.create(
            employee=self.emp1,
            month='January',
            year=2025,
            salary_type='SALARY',
            adjustment_type='EARNING',
            label='Monthly Allowance',
            amount=Decimal('500'),
            is_taxable=False,
            is_recurring=True,  # Recurring
            is_active=True,
            created_by=self.admin_user
        )
        
        # Seed February
        result = seed_monthly_salary_data('February', 2025, created_by=self.admin_user)
        
        self.assertTrue(result['success'])
        self.assertEqual(result['adjustment_copies'], 1)  # Only 1 recurring adjustment
        
        # Verify only recurring adjustment was copied
        feb_adjustments = PayrollInputAdjustment.objects.filter(
            employee=self.emp1,
            month='February',
            year=2025,
            salary_type='SALARY',
            is_active=True
        )
        
        self.assertEqual(feb_adjustments.count(), 1)
        self.assertEqual(feb_adjustments.first().label, 'Monthly Allowance')
        self.assertTrue(feb_adjustments.first().is_recurring)

    def test_seed_invalid_month_returns_error(self):
        """Test that invalid month is rejected."""
        result = seed_monthly_salary_data('InvalidMonth', 2025)
        
        self.assertFalse(result['success'])
        self.assertTrue(len(result['errors']) > 0)

    def test_seed_handles_year_boundary(self):
        """Test that year boundary transitions work correctly."""
        # Create December 2024 data
        MonthlySalaryData.objects.create(
            employee=self.emp1,
            month='December',
            year=2024,
            salary_type='SALARY',
            basic=Decimal('20000'),
            hra=Decimal('5000'),
            da=Decimal('2000'),
            conveyance=Decimal('1600'),
            medical=Decimal('1250'),
            special_allowance=Decimal('5150'),
            pf_employee=Decimal('2400'),
            professional_tax=Decimal('200'),
            pf_employer=Decimal('2400'),
            work_days=26,
            days_in_month=30,
            lop_days=0,
            source='DERIVED',
            uploaded_by=self.admin_user
        )
        
        # Seed January 2025 (should carry from December 2024)
        result = seed_monthly_salary_data('January', 2025, created_by=self.admin_user)
        
        self.assertTrue(result['success'])
        self.assertEqual(result['carry_forward'], 1)  # emp1 carried from Dec 2024


class MonthlyInputsAPITests(TestCase):
    """Test the monthly inputs APIs."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        
        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@test.com',
            password='testpass123',
            is_staff=True,
            is_superuser=True
        )
        self.client.force_authenticate(user=self.user)
        
        # Create department
        self.dept = Department.objects.create(
            department_code='TEST',
            department_name='Test Department'
        )
        
        # Create employees
        self.emp1 = Employee.objects.create(
            employee_id='T001',
            name='Test Employee 1',
            position='Engineer',
            department=self.dept,
            dob=date(1990, 1, 1),
            doj=date(2020, 1, 1),
            pan='ABCDE1234F',
            bank_account='1234567890',
            bank_ifsc='ICIC0000001',
            is_active=True
        )
        
        # Create salary template and assignment
        self.template = SalaryTemplate.objects.create(
            code='TEST',
            name='Test Template',
            is_active=True,
            created_by=self.user
        )
        
        EmployeeSalaryAssignment.objects.create(
            employee=self.emp1,
            template=self.template,
            annual_ctc=Decimal('600000'),
            effective_from=date(2024, 1, 1),
            is_active=True,
            created_by=self.user
        )

    def test_process_monthly_inputs_endpoint(self):
        """Test POST /payroll/monthly-inputs/process/ endpoint."""
        response = self.client.post(
            '/api/payroll/monthly-inputs/process/',
            {'month': 'March', 'year': 2025},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['created'], 1)
        self.assertEqual(response.data['derived'], 1)

    def test_process_missing_month(self):
        """Test that missing month is rejected."""
        response = self.client.post(
            '/api/payroll/monthly-inputs/process/',
            {'year': 2025},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_fetch_all_employees_by_period(self):
        """Test GET /monthly-salaries/by-period/ returns all active employees."""
        # Create some salary data for one employee
        MonthlySalaryData.objects.create(
            employee=self.emp1,
            month='April',
            year=2025,
            salary_type='SALARY',
            basic=Decimal('20000'),
            hra=Decimal('5000'),
            da=Decimal('2000'),
            conveyance=Decimal('1600'),
            medical=Decimal('1250'),
            special_allowance=Decimal('5150'),
            pf_employee=Decimal('2400'),
            professional_tax=Decimal('200'),
            pf_employer=Decimal('2400'),
            work_days=26,
            days_in_month=30,
            lop_days=0,
            source='MANUAL_ENTRY',
            uploaded_by=self.user
        )
        
        response = self.client.get(
            '/api/employees/monthly-salaries/by-period/',
            {'month': 'April', 'year': 2025, 'salary_type': 'SALARY'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        # Should return 1 employee (all active employees)
        self.assertEqual(response.data['count'], 1)
        
        # Verify the employee has salary data
        row = response.data['data'][0]
        self.assertEqual(row['employee'], self.emp1.id)
        self.assertIsNotNone(row['id'])  # Has a record

    def test_fetch_includes_null_rows(self):
        """Test that fetch includes null rows for employees without data."""
        # Don't create any salary data
        response = self.client.get(
            '/api/employees/monthly-salaries/by-period/',
            {'month': 'May', 'year': 2025, 'salary_type': 'SALARY'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        
        # Verify row is a placeholder (no id, no salary data)
        row = response.data['data'][0]
        self.assertEqual(row['employee'], self.emp1.id)
        self.assertIsNone(row['id'])  # No record yet
        self.assertIsNone(row['basic'])  # Empty fields

    def test_upsert_create_new_record(self):
        """Test POST /monthly-salaries/upsert/ creates new record."""
        response = self.client.post(
            '/api/employees/monthly-salaries/upsert/',
            {
                'employee': self.emp1.id,
                'month': 'June',
                'year': 2025,
                'salary_type': 'SALARY',
                'basic': 20000,
                'hra': 5000,
                'da': 2000,
                'conveyance': 1600,
                'medical': 1250,
                'special_allowance': 5150,
                'pf_employee': 2400,
                'professional_tax': 200,
                'pf_employer': 2400,
                'work_days': 26,
                'days_in_month': 30,
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertTrue(response.data['created'])  # Is creation
        self.assertEqual(response.data['data']['source'], 'MANUAL_ENTRY')

    def test_upsert_update_existing_record(self):
        """Test POST /monthly-salaries/upsert/ updates existing record."""
        # Create existing record
        existing = MonthlySalaryData.objects.create(
            employee=self.emp1,
            month='July',
            year=2025,
            salary_type='SALARY',
            basic=Decimal('15000'),
            hra=Decimal('4000'),
            da=Decimal('1500'),
            conveyance=Decimal('1600'),
            medical=Decimal('1250'),
            special_allowance=Decimal('4650'),
            pf_employee=Decimal('1800'),
            professional_tax=Decimal('200'),
            pf_employer=Decimal('1800'),
            work_days=26,
            days_in_month=30,
            lop_days=0,
            source='DERIVED',
            uploaded_by=self.user
        )
        
        # Update it
        response = self.client.post(
            '/api/employees/monthly-salaries/upsert/',
            {
                'employee': self.emp1.id,
                'month': 'July',
                'year': 2025,
                'salary_type': 'SALARY',
                'basic': 20000,  # Changed
                'hra': 5000,  # Changed
                'da': 2000,
                'conveyance': 1600,
                'medical': 1250,
                'special_allowance': 5150,
                'pf_employee': 2400,
                'professional_tax': 200,
                'pf_employer': 2400,
                'work_days': 26,
                'days_in_month': 30,
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertFalse(response.data['created'])  # Is update
        self.assertEqual(response.data['data']['basic'], '20000.00')
        self.assertEqual(response.data['data']['source'], 'MANUAL_ENTRY')
