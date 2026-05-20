"""Milestone 3C Tests — Component-wise payroll calculation engine."""
import datetime
from decimal import Decimal
from django.test import TestCase
from authentication.models import AdminUser
from departments.models import Department
from employees.models import Employee
from payroll_config.models import (
    SalaryComponent, SalaryTemplate, SalaryTemplateComponent,
    StatutoryConfig, ProfessionalTaxSlab,
)
from payroll_config.services import assign_salary
from payslip_generation.models import PayrollRun, PayrollRunItem, PayrollRunItemLine
from payslip_generation.calculation_engine import build_line_items_from_assignment, calculate_employee_payroll
from payslip_generation.payroll_service import calculate_run, hold_employee, reprocess_employee, PayrollRunError


def _admin():
    return AdminUser.objects.get_or_create(
        username='admin_3c', defaults={'email': 'admin_3c@test.local', 'is_staff': True})[0]


def _dept():
    return Department.objects.get_or_create(department_name='Eng3C')[0]


def _employee(suffix):
    return Employee.objects.get_or_create(
        employee_id=f'EMP_{suffix}',
        defaults={
            'name': f'Employee {suffix}', 'position': 'Engineer', 'department': _dept(),
            'dob': datetime.date(1990, 1, 1), 'doj': datetime.date(2022, 1, 1),
            'pan': 'ABCDE1234F', 'bank_account': '1234567890',
            'bank_ifsc': 'HDFC0001234', 'location': 'Bangalore', 'is_active': True,
        })[0]


def _statutory(state='KA'):
    cfg, _ = StatutoryConfig.objects.get_or_create(
        financial_year='2025-26', state=state,
        defaults={
            'is_active': True, 'pf_enabled': True,
            'pf_employee_rate': Decimal('0.1200'), 'pf_employer_rate': Decimal('0.1200'),
            'pf_wage_ceiling': Decimal('15000'), 'pf_rounding': 'ROUND',
            'pf_include_employer_in_ctc': True, 'esi_enabled': True,
            'esi_employee_rate': Decimal('0.0075'), 'esi_employer_rate': Decimal('0.0325'),
            'esi_wage_threshold': Decimal('21000'), 'pt_enabled': True,
            'lwf_enabled': False, 'lwf_employee_amount': Decimal('0'),
            'lwf_employer_amount': Decimal('0'), 'lwf_applicable_months': [],
            'tds_enabled': False, 'effective_from': datetime.date(2025, 4, 1),
            'effective_to': datetime.date(2026, 3, 31),
        })
    if not cfg.pt_slabs.exists():
        ProfessionalTaxSlab.objects.create(
            statutory_config=cfg, min_monthly_wage=Decimal('0'),
            max_monthly_wage=Decimal('14999.99'), pt_amount=Decimal('0'), display_order=10)
        ProfessionalTaxSlab.objects.create(
            statutory_config=cfg, min_monthly_wage=Decimal('15000'),
            max_monthly_wage=None, pt_amount=Decimal('200'), display_order=20)
    return cfg


def _template(code):
    """BASIC=40%CTC, HRA=40%BASIC, SPECIAL_ALLOWANCE=FIXED 5000."""
    admin = _admin()
    t, _ = SalaryTemplate.objects.get_or_create(code=code, defaults={'name': code, 'created_by': admin})
    basic = SalaryComponent.objects.get(code='BASIC')
    hra = SalaryComponent.objects.get(code='HRA')
    sa = SalaryComponent.objects.get(code='SPECIAL_ALLOWANCE')
    SalaryTemplateComponent.objects.get_or_create(
        template=t, component=basic,
        defaults={'calculation_type_override': 'PERCENTAGE_OF_CTC', 'value': Decimal('40'), 'display_order': 10})
    SalaryTemplateComponent.objects.get_or_create(
        template=t, component=hra,
        defaults={'calculation_type_override': 'PERCENTAGE_OF_BASIC', 'value': Decimal('40'), 'display_order': 20})
    SalaryTemplateComponent.objects.get_or_create(
        template=t, component=sa,
        defaults={'calculation_type_override': 'FIXED_AMOUNT', 'value': Decimal('5000'), 'display_order': 30})
    return t


class BuildLineItemsTest(TestCase):
    def setUp(self):
        _statutory("KA")
        self.admin = _admin()
        self.emp = _employee("BLI1")
        self.tmpl = _template("BLI_TMPL")
        self.asgn = assign_salary(employee=self.emp, template=self.tmpl,
            annual_ctc=Decimal("600000"), effective_from=datetime.date(2025, 4, 1), created_by=self.admin)

    def _c(self, lop=0):
        return build_line_items_from_assignment(self.asgn,
            payroll_date=datetime.date(2025, 10, 31), lop_days=lop, days_in_month=31, employee_state="KA")

    def test_earning_codes_present(self):
        codes = [l["code"] for l in self._c()["lines"] if l["component_type"] == "EARNING"]
        self.assertIn("BASIC", codes)
        self.assertIn("HRA", codes)
        self.assertIn("SPECIAL_ALLOWANCE", codes)

    def test_basic_40pct_ctc(self):
        basic = next(l for l in self._c()["lines"] if l["code"] == "BASIC")
        expected = (Decimal("600000") / 12 * Decimal("40") / 100).quantize(Decimal("0.01"))
        self.assertEqual(basic["amount"], expected)

    def test_hra_40pct_basic(self):
        r = self._c()
        basic_amt = next(l for l in r["lines"] if l["code"] == "BASIC")["amount"]
        hra_amt = next(l for l in r["lines"] if l["code"] == "HRA")["amount"]
        self.assertEqual(hra_amt, (basic_amt * Decimal("40") / 100).quantize(Decimal("0.01")))

    def test_special_allowance_fixed_5000(self):
        sa = next(l for l in self._c()["lines"] if l["code"] == "SPECIAL_ALLOWANCE")
        self.assertEqual(sa["amount"], Decimal("5000.00"))

    def test_gross_equals_sum_of_earnings(self):
        r = self._c()
        self.assertEqual(r["gross_earnings"], sum(l["amount"] for l in r["lines"] if l["component_type"] == "EARNING"))

    def test_net_pay_equals_gross_minus_deductions(self):
        r = self._c()
        self.assertEqual(r["net_pay"], r["gross_earnings"] - r["total_deductions"])

    def test_statutory_deduction_lines_injected(self):
        codes = [l["code"] for l in self._c()["lines"] if l["component_type"] == "DEDUCTION"]
        self.assertIn("PF_EMP", codes)
        self.assertIn("PT", codes)

    def test_employer_contribution_lines_injected(self):
        codes = [l["code"] for l in self._c()["lines"] if l["component_type"] == "EMPLOYER_CONTRIBUTION"]
        self.assertIn("PF_EMPLOYER", codes)

    def test_employer_contributions_not_in_net_pay(self):
        r = self._c()
        emp_ded = sum(l["amount"] for l in r["lines"] if l["component_type"] == "DEDUCTION" and l["affects_net_pay"])
        self.assertEqual(r["net_pay"], r["gross_earnings"] - emp_ded)

    def test_pf_capped_at_ceiling(self):
        pf = next(l for l in self._c()["lines"] if l["code"] == "PF_EMP")
        self.assertEqual(pf["amount"], Decimal("1800"))

    def test_pt_200_for_high_earner(self):
        pt = next(l for l in self._c()["lines"] if l["code"] == "PT")
        self.assertEqual(pt["amount"], Decimal("200"))


class ProratedCalculationTest(TestCase):
    def setUp(self):
        _statutory("KA")
        self.admin = _admin()
        self.emp = _employee("PRORATE1")
        self.tmpl = _template("PRORATE_TMPL")
        self.asgn = assign_salary(employee=self.emp, template=self.tmpl,
            annual_ctc=Decimal("600000"), effective_from=datetime.date(2025, 4, 1), created_by=self.admin)

    def _c(self, lop=0):
        return build_line_items_from_assignment(self.asgn,
            payroll_date=datetime.date(2025, 10, 31), lop_days=lop, days_in_month=31, employee_state="KA")

    def test_full_month_factor_is_one(self):
        self.assertEqual(self._c(0)["proration_factor"], Decimal("1"))

    def test_lop_reduces_gross(self):
        self.assertLess(self._c(5)["gross_earnings"], self._c(0)["gross_earnings"])

    def test_proration_factor_correct(self):
        r = self._c(5)
        self.assertAlmostEqual(float(r["proration_factor"]), float(Decimal("26") / Decimal("31")), places=4)

    def test_payable_days_correct(self):
        self.assertEqual(self._c(3)["payable_days"], 28)


class CalculateEmployeePayrollTest(TestCase):
    def setUp(self):
        _statutory("KA")
        self.admin = _admin()
        self.emp = _employee("CEP1")
        self.tmpl = _template("CEP_TMPL")
        self.asgn = assign_salary(employee=self.emp, template=self.tmpl,
            annual_ctc=Decimal("600000"), effective_from=datetime.date(2025, 4, 1), created_by=self.admin)
        self.run = PayrollRun.objects.create(month="March", year=2026, salary_type="SALARY",
            status="DRAFT", created_by=self.admin)
        self.item = PayrollRunItem.objects.create(run=self.run, employee=self.emp, status="INCLUDED")

    def _calc(self):
        return calculate_employee_payroll(run_item=self.item,
            payroll_date=datetime.date(2026, 3, 31), days_in_month=31, employee_state="KA")

    def test_line_items_created(self):
        self._calc()
        self.assertGreater(PayrollRunItemLine.objects.filter(run_item=self.item).count(), 0)

    def test_run_item_totals_updated(self):
        self._calc()
        self.item.refresh_from_db()
        self.assertGreater(self.item.gross_earnings, 0)
        self.assertGreater(self.item.net_pay, 0)
        self.assertEqual(self.item.calculation_source, "SALARY_ASSIGNMENT")

    def test_run_item_links_assignment(self):
        self._calc()
        self.item.refresh_from_db()
        self.assertEqual(self.item.salary_assignment_id, self.asgn.id)

    def test_reprocess_replaces_lines(self):
        self._calc()
        c1 = PayrollRunItemLine.objects.filter(run_item=self.item).count()
        self._calc()
        c2 = PayrollRunItemLine.objects.filter(run_item=self.item).count()
        self.assertEqual(c1, c2)

    def test_no_assignment_raises_value_error(self):
        emp2 = _employee("CEP_NOASSIGN")
        item2 = PayrollRunItem.objects.create(run=self.run, employee=emp2, status="INCLUDED")
        with self.assertRaises(ValueError):
            calculate_employee_payroll(run_item=item2,
                payroll_date=datetime.date(2026, 3, 31), days_in_month=31, employee_state="KA")

    def test_snapshot_stable_after_template_change(self):
        self._calc()
        before = PayrollRunItemLine.objects.get(run_item=self.item, code="BASIC").amount
        tc = self.tmpl.components.get(component__code="BASIC")
        tc.value = Decimal("50")
        tc.save()
        after = PayrollRunItemLine.objects.get(run_item=self.item, code="BASIC").amount
        self.assertEqual(before, after)


class CalculateRunWith3CEngineTest(TestCase):
    def setUp(self):
        _statutory("KA")
        self.admin = _admin()
        self.emp = _employee("CR3C1")
        self.tmpl = _template("CR3C_TMPL")
        self.asgn = assign_salary(employee=self.emp, template=self.tmpl,
            annual_ctc=Decimal("600000"), effective_from=datetime.date(2025, 4, 1), created_by=self.admin)
        self.run = PayrollRun.objects.create(month="March", year=2026, salary_type="SALARY",
            status="DRAFT", created_by=self.admin)

    def test_creates_line_items(self):
        result = calculate_run(self.run, self.admin)
        self.assertEqual(result["included"], 1)
        self.assertEqual(result["engine_used"], 1)
        self.assertEqual(result["legacy_used"], 0)
        item = PayrollRunItem.objects.get(run=self.run, employee=self.emp)
        self.assertGreater(PayrollRunItemLine.objects.filter(run_item=item).count(), 0)

    def test_item_source_is_salary_assignment(self):
        calculate_run(self.run, self.admin)
        item = PayrollRunItem.objects.get(run=self.run, employee=self.emp)
        self.assertEqual(item.calculation_source, "SALARY_ASSIGNMENT")

    def test_run_totals_match_item(self):
        calculate_run(self.run, self.admin)
        self.run.refresh_from_db()
        item = PayrollRunItem.objects.get(run=self.run, employee=self.emp)
        self.assertEqual(self.run.total_net, item.net_pay)
        self.assertEqual(self.run.total_gross, item.gross_earnings)

    def test_held_employee_excluded_from_totals(self):
        calculate_run(self.run, self.admin)
        self.run.status = "CALCULATED"
        self.run.save(update_fields=["status"])
        hold_employee(self.run, self.emp, "Test hold", self.admin)
        self.run.refresh_from_db()
        self.assertEqual(self.run.total_net, Decimal("0"))
        self.assertEqual(self.run.total_employees, 0)


class ReprocessWith3CEngineTest(TestCase):
    def setUp(self):
        _statutory("KA")
        self.admin = _admin()
        self.emp = _employee("REPROC3C")
        self.tmpl = _template("REPROC3C_TMPL")
        self.asgn = assign_salary(employee=self.emp, template=self.tmpl,
            annual_ctc=Decimal("600000"), effective_from=datetime.date(2025, 4, 1), created_by=self.admin)
        self.run = PayrollRun.objects.create(month="March", year=2026, salary_type="SALARY",
            status="CALCULATED", created_by=self.admin)
        self.item = PayrollRunItem.objects.create(run=self.run, employee=self.emp, status="INCLUDED")

    def test_reprocess_creates_line_items(self):
        reprocess_employee(self.run, self.emp, self.admin)
        self.assertGreater(PayrollRunItemLine.objects.filter(run_item=self.item).count(), 0)

    def test_reprocess_replaces_old_lines(self):
        reprocess_employee(self.run, self.emp, self.admin)
        c1 = PayrollRunItemLine.objects.filter(run_item=self.item).count()
        reprocess_employee(self.run, self.emp, self.admin)
        c2 = PayrollRunItemLine.objects.filter(run_item=self.item).count()
        self.assertEqual(c1, c2)

    def test_reprocess_updates_run_totals(self):
        reprocess_employee(self.run, self.emp, self.admin)
        self.run.refresh_from_db()
        self.item.refresh_from_db()
        self.assertEqual(self.run.total_net, self.item.net_pay)


class LineItemClassificationTest(TestCase):
    def setUp(self):
        _statutory("KA")
        self.admin = _admin()
        self.emp = _employee("CLASS1")
        self.tmpl = _template("CLASS_TMPL")
        self.asgn = assign_salary(employee=self.emp, template=self.tmpl,
            annual_ctc=Decimal("600000"), effective_from=datetime.date(2025, 4, 1), created_by=self.admin)

    def _c(self):
        return build_line_items_from_assignment(self.asgn,
            payroll_date=datetime.date(2025, 10, 31), days_in_month=31, employee_state="KA")

    def test_earning_lines_affect_gross(self):
        for l in self._c()["lines"]:
            if l["component_type"] == "EARNING":
                self.assertTrue(l["affects_gross"], f"{l['code']} should affect_gross")

    def test_deduction_lines_affect_net_pay(self):
        for l in self._c()["lines"]:
            if l["component_type"] == "DEDUCTION":
                self.assertTrue(l["affects_net_pay"], f"{l['code']} should affect_net_pay")

    def test_employer_lines_do_not_affect_net_pay(self):
        for l in self._c()["lines"]:
            if l["component_type"] == "EMPLOYER_CONTRIBUTION":
                self.assertFalse(l["affects_net_pay"], f"{l['code']} must NOT affect_net_pay")

    def test_statutory_lines_flagged(self):
        statutory_codes = {"PF_EMP", "ESI_EMP", "PT", "LWF_EMP", "PF_EMPLOYER", "ESI_EMPLOYER", "LWF_EMPLOYER"}
        for l in self._c()["lines"]:
            if l["code"] in statutory_codes:
                self.assertTrue(l["is_statutory"], f"{l['code']} should be is_statutory")


class ESIApplicabilityInEngineTest(TestCase):
    def setUp(self):
        _statutory("KA")
        self.admin = _admin()

    def test_esi_zero_for_high_earner(self):
        emp = _employee("ESI_HIGH")
        tmpl = _template("ESI_HIGH_TMPL")
        asgn = assign_salary(employee=emp, template=tmpl, annual_ctc=Decimal("600000"),
            effective_from=datetime.date(2025, 4, 1), created_by=self.admin)
        result = build_line_items_from_assignment(asgn,
            payroll_date=datetime.date(2025, 10, 31), days_in_month=31, employee_state="KA")
        esi = next(l for l in result["lines"] if l["code"] == "ESI_EMP")
        self.assertEqual(esi["amount"], Decimal("0"))

    def test_esi_nonzero_for_low_earner(self):
        emp = _employee("ESI_LOW")
        tmpl = _template("ESI_LOW_TMPL")
        asgn = assign_salary(employee=emp, template=tmpl, annual_ctc=Decimal("180000"),
            effective_from=datetime.date(2025, 4, 1), created_by=self.admin)
        result = build_line_items_from_assignment(asgn,
            payroll_date=datetime.date(2025, 10, 31), days_in_month=31, employee_state="KA")
        esi = next(l for l in result["lines"] if l["code"] == "ESI_EMP")
        self.assertGreater(esi["amount"], Decimal("0"))
