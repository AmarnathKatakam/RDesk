"""
payroll_config.services — Business logic for salary assignment management.

Public API:
    assign_salary(employee, template, annual_ctc, effective_from, created_by, notes='') -> EmployeeSalaryAssignment
    get_active_assignment(employee) -> EmployeeSalaryAssignment | None
    get_assignment_at_date(employee, date) -> EmployeeSalaryAssignment | None
    revise_salary(employee, template, annual_ctc, effective_from, created_by, notes='') -> EmployeeSalaryAssignment
"""
from __future__ import annotations

import logging
from datetime import date

from django.db import transaction

from employees.models import Employee
from .models import EmployeeSalaryAssignment, SalaryTemplate

logger = logging.getLogger('payroll_config.services')


class SalaryAssignmentError(Exception):
    """Raised when a salary assignment operation is invalid."""


@transaction.atomic
def assign_salary(
    employee: Employee,
    template: SalaryTemplate,
    annual_ctc,
    effective_from: date,
    created_by,
    notes: str = '',
) -> EmployeeSalaryAssignment:
    """
    Create a new salary assignment for an employee.
    Raises SalaryAssignmentError if the employee already has an active assignment.
    Use revise_salary() to handle salary revisions.
    """
    existing_active = (
        EmployeeSalaryAssignment.objects
        .select_for_update()
        .filter(employee=employee, is_active=True)
        .first()
    )
    if existing_active:
        raise SalaryAssignmentError(
            f"{employee.name} already has an active salary assignment "
            f"(Template: {existing_active.template.code}, CTC: ₹{existing_active.annual_ctc:,.0f}). "
            "Use revise_salary() to create a revision."
        )

    assignment = EmployeeSalaryAssignment.objects.create(
        employee=employee,
        template=template,
        annual_ctc=annual_ctc,
        effective_from=effective_from,
        effective_to=None,
        is_active=True,
        notes=notes,
        created_by=created_by,
    )
    logger.info(
        'Salary assigned: %s → %s @ ₹%s from %s by %s',
        employee.name, template.code, annual_ctc, effective_from, created_by,
    )
    return assignment


@transaction.atomic
def revise_salary(
    employee: Employee,
    template: SalaryTemplate,
    annual_ctc,
    effective_from: date,
    created_by,
    notes: str = '',
) -> EmployeeSalaryAssignment:
    """
    Revise an employee's salary.
    Closes the current active assignment (sets effective_to = effective_from - 1 day)
    and creates a new active assignment.
    If no active assignment exists, creates a fresh one.
    """
    from datetime import timedelta

    current = (
        EmployeeSalaryAssignment.objects
        .select_for_update()
        .filter(employee=employee, is_active=True)
        .first()
    )

    if current:
        # Close the current assignment one day before the new one starts
        current.effective_to = effective_from - timedelta(days=1)
        current.is_active = False
        current.save(update_fields=['effective_to', 'is_active', 'updated_at'])
        logger.info(
            'Salary assignment closed for %s: %s until %s',
            employee.name, current.template.code, current.effective_to,
        )

    new_assignment = EmployeeSalaryAssignment.objects.create(
        employee=employee,
        template=template,
        annual_ctc=annual_ctc,
        effective_from=effective_from,
        effective_to=None,
        is_active=True,
        notes=notes,
        created_by=created_by,
    )
    logger.info(
        'Salary revised: %s → %s @ ₹%s from %s by %s',
        employee.name, template.code, annual_ctc, effective_from, created_by,
    )
    return new_assignment


def get_active_assignment(employee: Employee) -> EmployeeSalaryAssignment | None:
    """Return the currently active salary assignment for an employee, or None."""
    return (
        EmployeeSalaryAssignment.objects
        .select_related('template')
        .filter(employee=employee, is_active=True)
        .first()
    )


def get_assignment_at_date(employee: Employee, target_date: date) -> EmployeeSalaryAssignment | None:
    """
    Return the salary assignment that was active on a given date.
    Useful for historical payroll recalculation.
    """
    return (
        EmployeeSalaryAssignment.objects
        .select_related('template')
        .filter(
            employee=employee,
            effective_from__lte=target_date,
        )
        .filter(
            # effective_to is null (still active) OR effective_to >= target_date
            effective_to__isnull=True,
        )
        .first()
        or
        EmployeeSalaryAssignment.objects
        .select_related('template')
        .filter(
            employee=employee,
            effective_from__lte=target_date,
            effective_to__gte=target_date,
        )
        .first()
    )
