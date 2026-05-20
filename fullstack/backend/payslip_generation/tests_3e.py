"""
Milestone 3E Tests — Monthly Salary Data Editor + Payroll Input Adjustments

Tests:
  1. MonthlySalaryData create/update via upsert API
  2. PayrollInputAdjustment CRUD
  3. Payroll calculation including adjustments (3E engine injection)
  4. Net pay impact from adjustments
  5. Duplicate prevention (unique_together on employee/month/year/salary_type)
  6. API filtering by month/year/salary_type
  7. Preview endpoint
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from employees.models import Employee, MonthlySalaryData, PayrollInputAdjustment
from departments.models import Department

User = get_user_model()


def _make_admin(username='hradmin3e'):
    return User.objects.create_user(username=username, password='pass', is_staff=True)


def _make_department():
    dept, _ = Department.objects.get_or_create(
        department_code='TEST3E',
        defaults={'department_name': 'Test 3E Dept', 'is_active': True},
    )
    return dept


def _make_employee(dept, emp_id='EMP3E001'):
    return Employee.objects.create(
        employee_id=emp_id,
        name='Test Employee 3E',
        position='Engineer',
        department=dept,
        dob='1990-01-01',
        doj='2022-01-01',
        pan='ABCDE1234F',
        bank_account='1234567890',
        bank_ifsc='HDFC0001234',
        pay_mode='NEFT',
        location='Bangalore',
        is_active=True,
    )


def _make_salary_data(employee, admin, month='March', year=2025, salary_type='SALARY'):
    return MonthlySalaryData.objects.create(
        employee=employee,
        month=month,
        year=year,
        salary_type=salary_type,
        basic=Decimal('20000'),
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


class MonthlySalaryDataModelTest(TestCase):
    """Test MonthlySalaryData model properties including 3E fields."""

    def setUp(self):
        self.admin = _make_admin('model_admin')
        self.dept = _make_department()
        self.emp = _make_employee(self.dept)

    def test_gross_earnings_includes_one_time(self):
        sd = _make_salary_data(self.emp, self.admin)
        sd.bonus = Decimal('5000')
        sd.incentive = Decimal('2000')
        sd.save()
        # base gross = 20000+8000+2000+1600+1250+5000 = 37850
        # + bonus 5000 + incentive 2000 = 44850
        self.assertEqual(sd.gross_earnings, Decimal('44850'))

    def test_total_deductions_includes_one_time(self):
        sd = _make_salary_data(self.emp, self.admin)
        sd.other_deduction_adjustment = Decimal('1000')
        sd.save()
        # pf_emp 2400 + pt 200 + other_ded 0 + advance 0 + other_ded_adj 1000 = 3600
        self.assertEqual(sd.total_deductions, Decimal('3600'))

    def test_net_pay_formula(self):
        sd = _make_salary_data(self.emp, self.admin)
        self.assertEqual(sd.net_pay, sd.gross_earnings - sd.total_deductions)

    def test_effective_lop_uses_override(self):
        sd = _make_salary_data(self.emp, self.admin)
        sd.lop_days = 3
        sd.lop_override = 5
        sd.save()
        self.assertEqual(sd.effective_lop, 5)

    def test_effective_lop_falls_back_to_lop_days(self):
        sd = _make_salary_data(self.emp, self.admin)
        sd.lop_days = 3
        sd.lop_override = None
        sd.save()
        self.assertEqual(sd.effective_lop, 3)

    def test_unique_together_includes_salary_type(self):
        """Two records with same employee/month/year but different salary_type are allowed."""
        _make_salary_data(self.emp, self.admin, salary_type='SALARY')
        # Should not raise
        _make_salary_data(self.emp, self.admin, salary_type='STIPEND')
        self.assertEqual(MonthlySalaryData.objects.filter(employee=self.emp).count(), 2)

    def test_duplicate_salary_type_raises(self):
        from django.db import IntegrityError
        _make_salary_data(self.emp, self.admin, salary_type='SALARY')
        with self.assertRaises(IntegrityError):
            _make_salary_data(self.emp, self.admin, salary_type='SALARY')


class PayrollInputAdjustmentModelTest(TestCase):
    """Test PayrollInputAdjustment model."""

    def setUp(self):
        self.admin = _make_admin('adj_admin')
        self.dept = _make_department()
        self.emp = _make_employee(self.dept, 'EMP3E002')

    def _make_adj(self, adj_type='BONUS', amount='5000', label='Diwali Bonus'):
        return PayrollInputAdjustment.objects.create(
            employee=self.emp,
            month='March',
            year=2025,
            salary_type='SALARY',
            adjustment_type=adj_type,
            label=label,
            amount=Decimal(amount),
            created_by=self.admin,
        )

    def test_create_adjustment(self):
        adj = self._make_adj()
        self.assertEqual(adj.adjustment_type, 'BONUS')
        self.assertEqual(adj.amount, Decimal('5000'))
        self.assertTrue(adj.is_active)

    def test_str_representation(self):
        adj = self._make_adj()
        self.assertIn('Diwali Bonus', str(adj))

    def test_deactivate_adjustment(self):
        adj = self._make_adj()
        adj.is_active = False
        adj.save()
        active = PayrollInputAdjustment.objects.filter(employee=self.emp, is_active=True)
        self.assertEqual(active.count(), 0)

    def test_multiple_adjustments_same_period(self):
        self._make_adj('BONUS', '5000', 'Diwali Bonus')
        self._make_adj('DEDUCTION', '1000', 'Loan EMI')
        self._make_adj('REIMBURSEMENT', '2000', 'Travel Reimbursement')
        self.assertEqual(
            PayrollInputAdjustment.objects.filter(employee=self.emp).count(), 3
        )


class MonthlySalaryUpsertAPITest(TestCase):
    """Test the monthly_salary_upsert API endpoint."""

    def setUp(self):
        self.admin = _make_admin('upsert_admin')
        self.dept = _make_department()
        self.emp = _make_employee(self.dept, 'EMP3E003')
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.url = '/api/employees/monthly-salaries/upsert/'

    def _payload(self, **overrides):
        base = {
            'employee': self.emp.id,
            'month': 'March',
            'year': 2025,
            'salary_type': 'SALARY',
            'basic': '20000',
            'hra': '8000',
            'da': '2000',
            'conveyance': '1600',
            'medical': '1250',
            'special_allowance': '5000',
            'pf_employee': '2400',
            'professional_tax': '200',
            'pf_employer': '2400',
            'other_deductions': '0',
            'salary_advance': '0',
            'work_days': 26,
            'days_in_month': 31,
            'lop_days': 0,
        }
        base.update(overrides)
        return base

    def test_create_new_record(self):
        resp = self.client.post(self.url, self._payload(), format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['success'])
        self.assertTrue(resp.data['created'])
        self.assertEqual(MonthlySalaryData.objects.filter(employee=self.emp).count(), 1)

    def test_update_existing_record(self):
        _make_salary_data(self.emp, self.admin)
        resp = self.client.post(self.url, self._payload(bonus='5000'), format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data['created'])
        sd = MonthlySalaryData.objects.get(employee=self.emp, month='March', year=2025)
        self.assertEqual(sd.bonus, Decimal('5000'))

    def test_source_set_to_manual_entry(self):
        resp = self.client.post(self.url, self._payload(), format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        sd = MonthlySalaryData.objects.get(employee=self.emp)
        self.assertEqual(sd.source, 'MANUAL_ENTRY')

    def test_invalid_month_rejected(self):
        resp = self.client.post(self.url, self._payload(month='Marchh'), format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_bonus_rejected(self):
        resp = self.client.post(self.url, self._payload(bonus='-100'), format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthenticated_rejected(self):
        self.client.logout()
        resp = self.client.post(self.url, self._payload(), format='json')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class PayrollAdjustmentAPITest(TestCase):
    """Test payroll adjustment CRUD API."""

    def setUp(self):
        self.admin = _make_admin('adj_api_admin')
        self.dept = _make_department()
        self.emp = _make_employee(self.dept, 'EMP3E004')
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.list_url = '/api/employees/payroll-adjustments/'

    def _payload(self, **overrides):
        base = {
            'employee': self.emp.id,
            'month': 'March',
            'year': 2025,
            'salary_type': 'SALARY',
            'adjustment_type': 'BONUS',
            'label': 'Diwali Bonus',
            'amount': '5000.00',
        }
        base.update(overrides)
        return base

    def test_create_adjustment(self):
        resp = self.client.post(self.list_url, self._payload(), format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data['success'])
        self.assertEqual(PayrollInputAdjustment.objects.count(), 1)

    def test_list_adjustments_filtered(self):
        PayrollInputAdjustment.objects.create(
            employee=self.emp, month='March', year=2025, salary_type='SALARY',
            adjustment_type='BONUS', label='Bonus', amount=Decimal('5000'),
            created_by=self.admin,
        )
        PayrollInputAdjustment.objects.create(
            employee=self.emp, month='April', year=2025, salary_type='SALARY',
            adjustment_type='DEDUCTION', label='Loan', amount=Decimal('1000'),
            created_by=self.admin,
        )
        resp = self.client.get(self.list_url, {'month': 'March', 'year': 2025})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['count'], 1)

    def test_update_adjustment(self):
        adj = PayrollInputAdjustment.objects.create(
            employee=self.emp, month='March', year=2025, salary_type='SALARY',
            adjustment_type='BONUS', label='Old Label', amount=Decimal('5000'),
            created_by=self.admin,
        )
        url = f'/api/employees/payroll-adjustments/{adj.id}/'
        resp = self.client.patch(url, {'label': 'New Label', 'amount': '6000'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        adj.refresh_from_db()
        self.assertEqual(adj.label, 'New Label')
        self.assertEqual(adj.amount, Decimal('6000'))

    def test_delete_adjustment(self):
        adj = PayrollInputAdjustment.objects.create(
            employee=self.emp, month='March', year=2025, salary_type='SALARY',
            adjustment_type='BONUS', label='Bonus', amount=Decimal('5000'),
            created_by=self.admin,
        )
        url = f'/api/employees/payroll-adjustments/{adj.id}/'
        resp = self.client.delete(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(PayrollInputAdjustment.objects.count(), 0)

    def test_negative_amount_rejected(self):
        resp = self.client.post(self.list_url, self._payload(amount='-100'), format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_filter_by_salary_type(self):
        PayrollInputAdjustment.objects.create(
            employee=self.emp, month='March', year=2025, salary_type='SALARY',
            adjustment_type='BONUS', label='Salary Bonus', amount=Decimal('5000'),
            created_by=self.admin,
        )
        PayrollInputAdjustment.objects.create(
            employee=self.emp, month='March', year=2025, salary_type='STIPEND',
            adjustment_type='BONUS', label='Stipend Bonus', amount=Decimal('2000'),
            created_by=self.admin,
        )
        resp = self.client.get(self.list_url, {'month': 'March', 'year': 2025, 'salary_type': 'STIPEND'})
        self.assertEqual(resp.data['count'], 1)
        self.assertEqual(resp.data['data'][0]['label'], 'Stipend Bonus')


class MonthlyPayrollPreviewAPITest(TestCase):
    """Test the monthly payroll preview endpoint."""

    def setUp(self):
        self.admin = _make_admin('preview_admin')
        self.dept = _make_department()
        self.emp = _make_employee(self.dept, 'EMP3E005')
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.url = '/api/employees/monthly-salaries/preview/'

    def test_preview_with_no_data(self):
        resp = self.client.get(self.url, {
            'employee': self.emp.id, 'month': 'March', 'year': 2025
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data['has_salary_data'])
        self.assertEqual(resp.data['base_net'], 0.0)

    def test_preview_with_salary_data(self):
        sd = _make_salary_data(self.emp, self.admin)
        resp = self.client.get(self.url, {
            'employee': self.emp.id, 'month': 'March', 'year': 2025
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['has_salary_data'])
        self.assertAlmostEqual(resp.data['base_net'], float(sd.net_pay), places=2)

    def test_preview_includes_adjustment_impact(self):
        _make_salary_data(self.emp, self.admin)
        PayrollInputAdjustment.objects.create(
            employee=self.emp, month='March', year=2025, salary_type='SALARY',
            adjustment_type='BONUS', label='Bonus', amount=Decimal('5000'),
            created_by=self.admin,
        )
        PayrollInputAdjustment.objects.create(
            employee=self.emp, month='March', year=2025, salary_type='SALARY',
            adjustment_type='DEDUCTION', label='Loan', amount=Decimal('1000'),
            created_by=self.admin,
        )
        resp = self.client.get(self.url, {
            'employee': self.emp.id, 'month': 'March', 'year': 2025
        })
        self.assertEqual(resp.data['adjustment_earnings'], 5000.0)
        self.assertEqual(resp.data['adjustment_deductions'], 1000.0)
        # preview_net = base_net + 5000 - 1000
        sd = MonthlySalaryData.objects.get(employee=self.emp)
        expected_net = float(sd.net_pay) + 5000 - 1000
        self.assertAlmostEqual(resp.data['preview_net'], expected_net, places=2)

    def test_inactive_adjustments_excluded(self):
        _make_salary_data(self.emp, self.admin)
        PayrollInputAdjustment.objects.create(
            employee=self.emp, month='March', year=2025, salary_type='SALARY',
            adjustment_type='BONUS', label='Inactive Bonus', amount=Decimal('5000'),
            is_active=False, created_by=self.admin,
        )
        resp = self.client.get(self.url, {
            'employee': self.emp.id, 'month': 'March', 'year': 2025
        })
        self.assertEqual(resp.data['adjustment_earnings'], 0.0)

    def test_missing_params_returns_400(self):
        resp = self.client.get(self.url, {'month': 'March'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class AdjustmentInjectionInCalculationTest(TestCase):
    """
    Test that PayrollInputAdjustment records are injected as line items
    during the 3C calculation engine run.
    """

    def setUp(self):
        from payroll_config.models import (
            SalaryComponent, SalaryTemplate, SalaryTemplateComponent,
            EmployeeSalaryAssignment, StatutoryConfig,
        )
        from payslip_generation.models import PayrollRun, PayrollRunItem

        self.admin = _make_admin('calc_admin_3e')
        self.dept = _make_department()
        self.emp = _make_employee(self.dept, 'EMP3E006')

        # Minimal salary template
        basic = SalaryComponent.objects.create(
            code='BASIC_3E', name='Basic', component_type='EARNING',
            calculation_type='PERCENTAGE_OF_CTC', default_value=Decimal('40'),
            is_active=True, is_pf_applicable=True,
        )
        template = SalaryTemplate.objects.create(
            code='TMPL_3E', name='Test Template 3E', is_active=True,
        )
        SalaryTemplateComponent.objects.create(
            template=template, component=basic, display_order=1,
        )
        EmployeeSalaryAssignment.objects.create(
            employee=self.emp, template=template,
            annual_ctc=Decimal('600000'),
            effective_from='2024-01-01', is_active=True,
        )

        # Statutory config — use get_or_create since seed migration may have created it
        StatutoryConfig.objects.get_or_create(
            state='KA',
            financial_year='2025-26',
            is_active=True,
            defaults={
                'effective_from': '2025-04-01',
                'pf_employee_rate': Decimal('0.12'),
                'pf_employer_rate': Decimal('0.12'),
                'pf_wage_ceiling': Decimal('15000'),
                'esi_employee_rate': Decimal('0.0075'),
                'esi_employer_rate': Decimal('0.0325'),
                'esi_wage_threshold': Decimal('21000'),
            },
        )

        # PayrollRun
        self.run = PayrollRun.objects.create(
            month='March', year=2025, salary_type='SALARY',
            status='DRAFT', created_by=self.admin,
        )
        self.item, _ = PayrollRunItem.objects.get_or_create(
            run=self.run, employee=self.emp,
            defaults={'status': 'INCLUDED'},
        )

    def test_adjustment_becomes_line_item(self):
        from payslip_generation.calculation_engine import calculate_employee_payroll
        from payslip_generation.models import PayrollRunItemLine
        from datetime import date

        PayrollInputAdjustment.objects.create(
            employee=self.emp, month='March', year=2025, salary_type='SALARY',
            adjustment_type='BONUS', label='Diwali Bonus', amount=Decimal('5000'),
            created_by=self.admin,
        )

        result = calculate_employee_payroll(
            run_item=self.item,
            payroll_date=date(2025, 3, 31),
            lop_days=0,
            work_days=26,
            days_in_month=31,
            employee_state='KA',
        )

        # Check line items contain the adjustment
        adj_lines = [l for l in result['lines'] if l.get('calculation_type') == 'ADJUSTMENT']
        self.assertEqual(len(adj_lines), 1)
        self.assertEqual(adj_lines[0]['name'], 'Diwali Bonus')
        self.assertEqual(adj_lines[0]['amount'], Decimal('5000'))

        # Check DB line items
        db_adj_lines = PayrollRunItemLine.objects.filter(
            run_item=self.item, calculation_type='ADJUSTMENT'
        )
        self.assertEqual(db_adj_lines.count(), 1)

    def test_earning_adjustment_increases_gross(self):
        from payslip_generation.calculation_engine import calculate_employee_payroll
        from datetime import date

        # Calculate without adjustment first
        result_base = calculate_employee_payroll(
            run_item=self.item,
            payroll_date=date(2025, 3, 31),
            lop_days=0, work_days=26, days_in_month=31, employee_state='KA',
        )
        base_gross = result_base['gross_earnings']

        # Add earning adjustment
        PayrollInputAdjustment.objects.create(
            employee=self.emp, month='March', year=2025, salary_type='SALARY',
            adjustment_type='BONUS', label='Bonus', amount=Decimal('5000'),
            created_by=self.admin,
        )

        result_with_adj = calculate_employee_payroll(
            run_item=self.item,
            payroll_date=date(2025, 3, 31),
            lop_days=0, work_days=26, days_in_month=31, employee_state='KA',
        )

        self.assertEqual(result_with_adj['gross_earnings'], base_gross + Decimal('5000'))
        self.assertEqual(result_with_adj['net_pay'], result_with_adj['gross_earnings'] - result_with_adj['total_deductions'])

    def test_deduction_adjustment_reduces_net(self):
        from payslip_generation.calculation_engine import calculate_employee_payroll
        from datetime import date

        result_base = calculate_employee_payroll(
            run_item=self.item,
            payroll_date=date(2025, 3, 31),
            lop_days=0, work_days=26, days_in_month=31, employee_state='KA',
        )
        base_net = result_base['net_pay']

        PayrollInputAdjustment.objects.create(
            employee=self.emp, month='March', year=2025, salary_type='SALARY',
            adjustment_type='LOAN', label='Loan EMI', amount=Decimal('2000'),
            created_by=self.admin,
        )

        result_with_adj = calculate_employee_payroll(
            run_item=self.item,
            payroll_date=date(2025, 3, 31),
            lop_days=0, work_days=26, days_in_month=31, employee_state='KA',
        )

        self.assertEqual(result_with_adj['net_pay'], base_net - Decimal('2000'))

    def test_inactive_adjustment_not_injected(self):
        from payslip_generation.calculation_engine import calculate_employee_payroll
        from datetime import date

        result_base = calculate_employee_payroll(
            run_item=self.item,
            payroll_date=date(2025, 3, 31),
            lop_days=0, work_days=26, days_in_month=31, employee_state='KA',
        )
        base_gross = result_base['gross_earnings']

        PayrollInputAdjustment.objects.create(
            employee=self.emp, month='March', year=2025, salary_type='SALARY',
            adjustment_type='BONUS', label='Inactive Bonus', amount=Decimal('9999'),
            is_active=False, created_by=self.admin,
        )

        result = calculate_employee_payroll(
            run_item=self.item,
            payroll_date=date(2025, 3, 31),
            lop_days=0, work_days=26, days_in_month=31, employee_state='KA',
        )

        self.assertEqual(result['gross_earnings'], base_gross)
