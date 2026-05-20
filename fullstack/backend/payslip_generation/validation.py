"""
Payroll Validation Engine — Milestone 1

Runs pre-generation checks on a list of employees for a given pay period.
Returns a list of PayrollValidationIssue instances (unsaved) so the caller
can decide whether to persist them and whether to block generation.

Usage:
    from payslip_generation.validation import run_payroll_validation

    issues = run_payroll_validation(employee_ids, month, year)
    errors  = [i for i in issues if i.severity == 'ERROR']
    if errors:
        # block generation
"""
from __future__ import annotations

from decimal import Decimal
from typing import List

from employees.models import Employee, MonthlySalaryData
from .models import Payslip, PayrollValidationIssue


def run_payroll_validation(
    employee_ids: List[int],
    month: str,
    year: int,
    salary_type: str = 'SALARY',
    task=None,
) -> List[PayrollValidationIssue]:
    """
    Run all validation checks and return a list of unsaved
    PayrollValidationIssue instances.

    Pass task= if you want issues linked to a PayslipGenerationTask.
    """
    issues: List[PayrollValidationIssue] = []

    employees = Employee.objects.filter(id__in=employee_ids).select_related(
        'department', 'bank_detail', 'pf_detail'
    )

    for employee in employees:
        def _issue(issue_type, severity, message):
            return PayrollValidationIssue(
                generation_task=task,
                employee=employee,
                pay_period_month=month,
                pay_period_year=year,
                issue_type=issue_type,
                severity=severity,
                message=message,
            )

        # 1. Employee must be active
        if not employee.is_active:
            issues.append(_issue(
                'INACTIVE_EMPLOYEE', 'ERROR',
                f"{employee.name} ({employee.employee_id}) is inactive."
            ))
            continue  # no point checking further for inactive employees

        # 2. Monthly salary data must exist
        monthly_salary = MonthlySalaryData.objects.filter(
            employee=employee, month=month, year=year
        ).first()

        if not monthly_salary:
            issues.append(_issue(
                'MISSING_SALARY_DATA', 'ERROR',
                f"No monthly salary data found for {employee.name} for {month} {year}. "
                f"Please upload salary data before generating payslips."
            ))
            # Cannot check net pay without salary data — skip remaining checks
            continue

        # 3. Duplicate payslip check
        duplicate = Payslip.objects.filter(
            employee=employee,
            pay_period_month=month,
            pay_period_year=year,
            salary_type=salary_type,
        ).exists()

        if duplicate:
            issues.append(_issue(
                'DUPLICATE_PAYSLIP', 'WARNING',
                f"A payslip already exists for {employee.name} for {month} {year} "
                f"({salary_type}). Generating will overwrite the existing record."
            ))

        # 4. Negative net pay check
        computed_net = monthly_salary.net_pay
        if computed_net < Decimal('0'):
            issues.append(_issue(
                'NEGATIVE_NET_PAY', 'ERROR',
                f"{employee.name}'s computed net pay is ₹{computed_net:.2f} for {month} {year}. "
                f"Deductions exceed earnings. Please review salary data."
            ))

        # 5. Missing bank details
        has_bank = (
            bool(employee.bank_account) and bool(employee.bank_ifsc)
        )
        if not has_bank:
            # Also check the employee_finance bank_detail if it exists
            finance_bank = getattr(employee, 'bank_detail', None)
            if not finance_bank or not finance_bank.bank_account_no:
                issues.append(_issue(
                    'MISSING_BANK_DETAILS', 'WARNING',
                    f"{employee.name} ({employee.employee_id}) has no bank account or IFSC on file. "
                    f"Salary transfer may fail."
                ))

        # 6. Missing PF details (only warn if PF contribution is non-zero)
        pf_contribution = monthly_salary.pf_employee
        if pf_contribution and pf_contribution > Decimal('0'):
            pf_detail = getattr(employee, 'pf_detail', None)
            has_pf = bool(employee.pf_number) or (pf_detail and pf_detail.is_covered and pf_detail.uan)
            if not has_pf:
                issues.append(_issue(
                    'MISSING_PF_DETAILS', 'WARNING',
                    f"{employee.name} has a PF deduction of ₹{pf_contribution:.2f} but no PF number or UAN on file."
                ))

    return issues


def persist_issues(issues: List[PayrollValidationIssue]) -> None:
    """Bulk-save a list of validation issue instances."""
    PayrollValidationIssue.objects.bulk_create(issues, ignore_conflicts=False)


def issues_to_dict(issues: List[PayrollValidationIssue]) -> list:
    """Serialize issues for API response."""
    return [
        {
            'employee_id': i.employee.employee_id,
            'employee_name': i.employee.name,
            'issue_type': i.issue_type,
            'severity': i.severity,
            'message': i.message,
        }
        for i in issues
    ]
