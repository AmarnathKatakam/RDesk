"""
monthly_salary_services.py

Service functions for managing monthly salary data seeding and carry-forward logic.

Public API:
    seed_monthly_salary_data(month, year, created_by=None) -> dict
        Seed monthly salary data for all active employees for a given month/year.
        Returns a summary of created and skipped records.
"""

import logging
from datetime import datetime
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from employees.models import Employee, MonthlySalaryData, PayrollInputAdjustment, SalaryStructure
from payroll_config.models import SalaryComponent, EmployeeSalaryAssignment

logger = logging.getLogger('employees.monthly_salary_services')

# Month ordering for carry-forward logic
MONTH_ORDER = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]


def _get_previous_month(month: str, year: int) -> tuple:
    """
    Get the previous month and year.
    
    Args:
        month: Full month name (e.g., 'January')
        year: Year as integer
        
    Returns:
        Tuple of (previous_month: str, previous_year: int)
    """
    try:
        current_idx = MONTH_ORDER.index(month)
    except ValueError:
        raise ValueError(f"Invalid month: {month}")
    
    if current_idx == 0:
        # January -> December of previous year
        return MONTH_ORDER[-1], year - 1
    else:
        return MONTH_ORDER[current_idx - 1], year


def _derive_monthly_components(annual_ctc: Decimal) -> dict:
    """
    Derive monthly salary components from annual CTC using standard structure.
    
    Uses the same logic as SalaryStructure.property methods:
    - Basic = 40% of (annual / 12)
    - HRA = 20% of basic
    - DA = 10% of basic
    - Conveyance = 1600 (fixed)
    - Medical = 1250 (fixed)
    - Professional Tax = 200 (fixed)
    - PF Employee = 12% of basic
    - PF Employer = 12% of basic
    - Special Allowance = remainder to match annual
    
    Args:
        annual_ctc: Annual CTC as Decimal
        
    Returns:
        Dict of salary components
    """
    monthly_ctc = annual_ctc / Decimal('12')
    basic = monthly_ctc * Decimal('0.40')
    
    return {
        'basic': basic,
        'hra': basic * Decimal('0.20'),
        'da': basic * Decimal('0.10'),
        'conveyance': Decimal('1600'),
        'medical': Decimal('1250'),
        'professional_tax': Decimal('200'),
        'pf_employee': basic * Decimal('0.12'),
        'pf_employer': basic * Decimal('0.12'),
        # Special allowance = total - (basic + da + hra + medical + conveyance + pf_employer)
        'special_allowance': monthly_ctc - (
            basic + (basic * Decimal('0.10')) + (basic * Decimal('0.20')) +
            Decimal('1250') + Decimal('1600') + (basic * Decimal('0.12'))
        ),
    }


def _get_active_salary_assignment(employee: Employee, target_date=None) -> EmployeeSalaryAssignment:
    """
    Get the active salary assignment for an employee.
    
    Args:
        employee: Employee instance
        target_date: Date to check assignment validity (default: today)
        
    Returns:
        EmployeeSalaryAssignment or None
    """
    if target_date is None:
        target_date = datetime.now().date()
    
    # Find assignment that:
    # 1. is_active = True
    # 2. effective_from <= target_date
    # 3. effective_to is NULL or >= target_date
    return (
        EmployeeSalaryAssignment.objects
        .filter(
            employee=employee,
            is_active=True,
            effective_from__lte=target_date,
        )
        .exclude(effective_to__lt=target_date)
        .first()
    )


def _get_salary_structure_fallback(employee: Employee) -> SalaryStructure:
    """
    Get the most recent active SalaryStructure for an employee.
    
    Args:
        employee: Employee instance
        
    Returns:
        SalaryStructure or None
    """
    return (
        SalaryStructure.objects
        .filter(employee=employee, is_active=True)
        .order_by('-effective_from')
        .first()
    )


@transaction.atomic
def seed_monthly_salary_data(month: str, year: int, created_by=None) -> dict:
    """
    Seed monthly salary data for all active employees for a given month/year.
    
    Logic:
    1. For each active employee:
       a. Check if MonthlySalaryData exists for this month/year
          - If YES → skip
       b. Try to fetch previous month data
          - If exists → copy values and mark as CARRY_FORWARD
       c. Else:
          - Fetch active EmployeeSalaryAssignment (or fallback to SalaryStructure)
          - Derive monthly components from annual CTC
          - Mark as DERIVED
    2. Copy only recurring adjustments (is_recurring=True) from previous month
    
    Args:
        month: Full month name (e.g., 'January')
        year: Year as integer
        created_by: User instance who triggered the seeding (for audit)
        
    Returns:
        Dict with keys:
            - 'success': bool
            - 'created': int (number of new records created)
            - 'skipped': int (number of records skipped)
            - 'carry_forward': int (records from previous month)
            - 'derived': int (records derived from salary assignment/structure)
            - 'adjustment_copies': int (recurring adjustments copied)
            - 'errors': list of error messages
    """
    created = 0
    skipped = 0
    carry_forward = 0
    derived = 0
    adjustment_copies = 0
    errors = []
    
    # Validate month
    if month not in MONTH_ORDER:
        return {
            'success': False,
            'created': 0,
            'skipped': 0,
            'carry_forward': 0,
            'derived': 0,
            'adjustment_copies': 0,
            'errors': [f"Invalid month: {month}"],
        }
    
    # Get all active employees
    active_employees = Employee.objects.filter(is_active=True).order_by('name')
    
    if not active_employees.exists():
        return {
            'success': True,
            'created': 0,
            'skipped': 0,
            'carry_forward': 0,
            'derived': 0,
            'adjustment_copies': 0,
            'errors': [],
        }
    
    # Get previous month
    prev_month, prev_year = _get_previous_month(month, year)
    
    try:
        for employee in active_employees:
            try:
                # Step 1: Check if already exists
                existing = MonthlySalaryData.objects.filter(
                    employee=employee,
                    month=month,
                    year=year
                ).first()
                
                if existing:
                    logger.info(f"Skipping {employee.name}: Monthly data already exists for {month} {year}")
                    skipped += 1
                    continue
                
                # Step 2: Try to fetch and carry forward from previous month
                prev_month_data = MonthlySalaryData.objects.filter(
                    employee=employee,
                    month=prev_month,
                    year=prev_year
                ).first()
                
                if prev_month_data:
                    # Carry forward all salary components
                    new_salary = MonthlySalaryData.objects.create(
                        employee=employee,
                        month=month,
                        year=year,
                        salary_type=prev_month_data.salary_type,
                        # Base components
                        basic=prev_month_data.basic,
                        hra=prev_month_data.hra,
                        da=prev_month_data.da,
                        conveyance=prev_month_data.conveyance,
                        medical=prev_month_data.medical,
                        special_allowance=prev_month_data.special_allowance,
                        pf_employee=prev_month_data.pf_employee,
                        # Deductions
                        professional_tax=prev_month_data.professional_tax,
                        pf_employer=prev_month_data.pf_employer,
                        other_deductions=prev_month_data.other_deductions,
                        salary_advance=prev_month_data.salary_advance,
                        # Work days (reset to default)
                        work_days=prev_month_data.work_days,
                        days_in_month=prev_month_data.days_in_month,
                        lop_days=0,  # Reset LOP days
                        lop_override=None,
                        # One-time adjustments (NOT carried forward - reset to 0)
                        bonus=Decimal('0'),
                        incentive=Decimal('0'),
                        arrears=Decimal('0'),
                        reimbursement=Decimal('0'),
                        other_earning_adjustment=Decimal('0'),
                        other_deduction_adjustment=Decimal('0'),
                        # Metadata
                        remarks=f"Carried forward from {prev_month} {prev_year}",
                        source='CARRY_FORWARD',
                        uploaded_by=created_by or self._get_system_user(),
                    )
                    
                    carry_forward += 1
                    created += 1
                    
                    logger.info(f"Created {month} {year} for {employee.name} (CARRY_FORWARD from {prev_month})")
                    
                else:
                    # Step 3: Derive from EmployeeSalaryAssignment or SalaryStructure
                    assignment = _get_active_salary_assignment(employee)
                    
                    if not assignment:
                        # Fallback to SalaryStructure
                        salary_struct = _get_salary_structure_fallback(employee)
                        if not salary_struct:
                            error_msg = f"No salary data found for {employee.name} (ID: {employee.employee_id})"
                            logger.warning(error_msg)
                            errors.append(error_msg)
                            continue
                        annual_ctc = salary_struct.annual_ctc
                        salary_type = salary_struct.salary_type
                    else:
                        annual_ctc = assignment.annual_ctc
                        salary_type = assignment.template.salary_type if hasattr(assignment.template, 'salary_type') else 'SALARY'
                    
                    # Derive monthly components
                    components = _derive_monthly_components(annual_ctc)
                    
                    # Create new record
                    new_salary = MonthlySalaryData.objects.create(
                        employee=employee,
                        month=month,
                        year=year,
                        salary_type=salary_type,
                        # Components from derived calculation
                        basic=components['basic'],
                        hra=components['hra'],
                        da=components['da'],
                        conveyance=components['conveyance'],
                        medical=components['medical'],
                        special_allowance=components['special_allowance'],
                        pf_employee=components['pf_employee'],
                        professional_tax=components['professional_tax'],
                        pf_employer=components['pf_employer'],
                        other_deductions=Decimal('0'),
                        salary_advance=Decimal('0'),
                        # Assume full month
                        work_days=26,  # Standard working days
                        days_in_month=30,  # Standard month days
                        lop_days=0,
                        lop_override=None,
                        # One-time adjustments (defaults)
                        bonus=Decimal('0'),
                        incentive=Decimal('0'),
                        arrears=Decimal('0'),
                        reimbursement=Decimal('0'),
                        other_earning_adjustment=Decimal('0'),
                        other_deduction_adjustment=Decimal('0'),
                        # Metadata
                        remarks=f"Derived from salary assignment/structure",
                        source='DERIVED',
                        uploaded_by=created_by or self._get_system_user(),
                    )
                    
                    derived += 1
                    created += 1
                    
                    logger.info(f"Created {month} {year} for {employee.name} (DERIVED from salary structure)")
                
                # Step 4: Copy recurring adjustments from previous month
                if prev_month_data:
                    recurring_adjustments = PayrollInputAdjustment.objects.filter(
                        employee=employee,
                        month=prev_month,
                        year=prev_year,
                        is_recurring=True,
                        is_active=True,
                    ).select_related('component')
                    
                    for adj in recurring_adjustments:
                        try:
                            PayrollInputAdjustment.objects.create(
                                employee=employee,
                                month=month,
                                year=year,
                                salary_type=adj.salary_type,
                                adjustment_type=adj.adjustment_type,
                                component=adj.component,
                                label=adj.label,
                                amount=adj.amount,
                                is_taxable=adj.is_taxable,
                                is_recurring=adj.is_recurring,
                                remarks=f"Auto-copied from {prev_month} {prev_year}",
                                is_active=True,
                                created_by=created_by,
                            )
                            adjustment_copies += 1
                        except Exception as e:
                            error_msg = f"Error copying adjustment for {employee.name}: {str(e)}"
                            logger.error(error_msg)
                            errors.append(error_msg)
            
            except Exception as e:
                error_msg = f"Error processing employee {employee.name} (ID: {employee.employee_id}): {str(e)}"
                logger.error(error_msg, exc_info=True)
                errors.append(error_msg)
    
    except Exception as e:
        error_msg = f"Critical error in seed_monthly_salary_data: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {
            'success': False,
            'created': created,
            'skipped': skipped,
            'carry_forward': carry_forward,
            'derived': derived,
            'adjustment_copies': adjustment_copies,
            'errors': [error_msg],
        }
    
    return {
        'success': True,
        'created': created,
        'skipped': skipped,
        'carry_forward': carry_forward,
        'derived': derived,
        'adjustment_copies': adjustment_copies,
        'errors': errors,
    }


def _get_system_user():
    """
    Get or create a system user for automated operations.
    Falls back to the first admin user if available.
    """
    from authentication.models import AdminUser
    
    # Try to get or create system user
    try:
        from django.contrib.auth.models import User
        system_user, _ = User.objects.get_or_create(
            username='payroll_system',
            defaults={'is_staff': True, 'is_superuser': False}
        )
        return system_user
    except Exception:
        # Fallback: return first admin user
        admin = AdminUser.objects.filter(is_superuser=True).first()
        return admin or AdminUser.objects.first()
