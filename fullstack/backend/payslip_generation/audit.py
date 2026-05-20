"""
Payroll Audit Logging Service — Milestone 1

Thin wrapper around PayrollAuditLog.objects.create so callers
don't need to import the model directly.

Usage:
    from payslip_generation.audit import log_payroll_action

    log_payroll_action(
        action='GENERATE',
        performed_by=request.user,
        payslip=payslip_instance,
        notes='Bulk generation task abc123',
    )
"""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger('payroll.audit')


def log_payroll_action(
    action: str,
    performed_by=None,
    payslip=None,
    employee=None,
    pay_period_month: Optional[str] = None,
    pay_period_year: Optional[int] = None,
    notes: str = '',
) -> None:
    """
    Create a PayrollAuditLog entry. Fails silently so audit logging
    never breaks the main payroll flow.
    """
    try:
        from .models import PayrollAuditLog

        # Derive period from payslip if not explicitly provided
        if payslip and not pay_period_month:
            pay_period_month = payslip.pay_period_month
        if payslip and not pay_period_year:
            pay_period_year = payslip.pay_period_year
        if payslip and not employee:
            employee = payslip.employee

        PayrollAuditLog.objects.create(
            action=action,
            performed_by=performed_by if (performed_by and getattr(performed_by, 'pk', None)) else None,
            payslip=payslip,
            employee=employee,
            pay_period_month=pay_period_month,
            pay_period_year=pay_period_year,
            notes=notes,
        )
    except Exception as exc:
        # Never let audit logging crash the main flow
        logger.error('Failed to write payroll audit log: action=%s error=%s', action, exc)
