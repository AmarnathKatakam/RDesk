import os
import uuid
from datetime import datetime
from decimal import Decimal
from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .models import PayslipGenerationTask, Payslip
from .utils import PayslipFileManager
from .frontend_pdf_generator import FrontendPDFGenerator
from employees.models import Employee, MonthlySalaryData

User = get_user_model()


def generate_payslip_batch(task_id, employee_ids, pay_period, salary_type, batch_number, total_batches):
    """
    Generate payslips for a batch of employees.
    """
    try:
        # Try to get the task, create a dummy one if it doesn't exist (for testing)
        try:
            task = PayslipGenerationTask.objects.get(task_id=task_id)
        except PayslipGenerationTask.DoesNotExist:
            # Create a dummy task for testing purposes
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.first()
            task = PayslipGenerationTask.objects.create(
                task_id=task_id,
                employee_ids=employee_ids,
                pay_period_month=pay_period['month'],
                pay_period_year=pay_period['year'],
                salary_type=salary_type,
                total_employees=len(employee_ids),
                batch_size=25,
                created_by=user
            )
        
        # Update task status
        task.status = 'IN_PROGRESS'
        task.current_batch = batch_number
        task.save()
        
        # Get employees for this batch
        employees = Employee.objects.filter(
            id__in=employee_ids,
            is_active=True
        ).select_related('department')
        
        pdf_generator = FrontendPDFGenerator()
        file_manager = PayslipFileManager()
        
        batch_errors = []
        completed_count = 0
        
        for employee in employees:
            try:
                # Get monthly salary data for the specific month and year
                monthly_salary = MonthlySalaryData.objects.filter(
                    employee=employee,
                    month=pay_period['month'],
                    year=pay_period['year']
                ).first()
                
                if not monthly_salary:
                    batch_errors.append(f"No monthly salary data found for {employee.name} for {pay_period['month']} {pay_period['year']}")
                    continue
                
                # Use monthly salary data directly
                salary_data = {
                    'work_days': monthly_salary.work_days,
                    'days_in_month': monthly_salary.days_in_month,
                    'lop_days': monthly_salary.lop_days,
                    'basic': monthly_salary.basic,
                    'hra': monthly_salary.hra,
                    'da': monthly_salary.da,
                    'conveyance': monthly_salary.conveyance,
                    'medical': monthly_salary.medical,
                    'special_allowance': monthly_salary.special_allowance,
                    'pf_employee': monthly_salary.pf_employee,
                    'total_earnings': monthly_salary.total_earnings,
                    'professional_tax': monthly_salary.professional_tax,
                    'pf_employer': monthly_salary.pf_employer,
                    'other_deductions': monthly_salary.other_deductions,
                    'salary_advance': monthly_salary.salary_advance,
                    'total_deductions': monthly_salary.total_deductions,
                    'net_pay': monthly_salary.net_pay,
                }
                
                # Generate QR code data
                qr_data = generate_qr_code_data(employee, salary_data, pay_period)
                
                # Generate PDF
                pdf_path = file_manager.get_payslip_path(
                    pay_period['year'],
                    pay_period['month'],
                    employee.name
                )
                
                # Check if payslip already exists
                existing_payslip = Payslip.objects.filter(
                    employee=employee,
                    pay_period_month=pay_period['month'],
                    pay_period_year=pay_period['year'],
                    salary_type=salary_type
                ).first()
                
                if existing_payslip:
                    # Update existing payslip
                    payslip = existing_payslip
                    payslip.work_days = salary_data['work_days']
                    payslip.days_in_month = salary_data['days_in_month']
                    payslip.lop_days = salary_data['lop_days']
                    payslip.basic = salary_data['basic']
                    payslip.hra = salary_data['hra']
                    payslip.da = salary_data['da']
                    payslip.conveyance = salary_data['conveyance']
                    payslip.medical = salary_data['medical']
                    payslip.special_allowance = salary_data['special_allowance']
                    payslip.pf_employee = salary_data['pf_employee']
                    payslip.total_earnings = salary_data['total_earnings']
                    payslip.professional_tax = salary_data['professional_tax']
                    payslip.pf_employer = salary_data['pf_employer']
                    payslip.other_deductions = salary_data['other_deductions']
                    payslip.salary_advance = salary_data['salary_advance']
                    payslip.total_deductions = salary_data['total_deductions']
                    payslip.net_pay = salary_data['net_pay']
                    payslip.pdf_path = str(pdf_path)
                    payslip.qr_code_data = qr_data
                    payslip.generated_by = task.created_by
                    payslip.save()
                else:
                    # Create new payslip record
                    with transaction.atomic():
                        payslip = Payslip.objects.create(
                            employee=employee,
                            pay_period_month=pay_period['month'],
                            pay_period_year=pay_period['year'],
                            salary_type=salary_type,
                            work_days=salary_data['work_days'],
                            days_in_month=salary_data['days_in_month'],
                            lop_days=salary_data['lop_days'],
                            basic=salary_data['basic'],
                            hra=salary_data['hra'],
                            da=salary_data['da'],
                            conveyance=salary_data['conveyance'],
                            medical=salary_data['medical'],
                            special_allowance=salary_data['special_allowance'],
                            pf_employee=salary_data['pf_employee'],
                            total_earnings=salary_data['total_earnings'],
                            professional_tax=salary_data['professional_tax'],
                            pf_employer=salary_data['pf_employer'],
                            other_deductions=salary_data['other_deductions'],
                            salary_advance=salary_data['salary_advance'],
                            total_deductions=salary_data['total_deductions'],
                            net_pay=salary_data['net_pay'],
                            pdf_path=str(pdf_path),
                            qr_code_data=qr_data,
                            generated_by=task.created_by
                        )
                
                # Generate PDF file
                pdf_generator.generate_payslip_pdf(payslip, pdf_path)
                
                # Email payslip if employee has email
                try:
                    sent = file_manager.send_payslip_email(payslip)
                    if not sent:
                        task.errors.append(f"Email not sent for {employee.name} (email missing or send error)")
                except Exception as e:
                    task.errors.append(f"Email error for {employee.name}: {str(e)}")
                
                completed_count += 1
                
            except Exception as e:
                batch_errors.append(f"Error generating payslip for {employee.name}: {str(e)}")
                continue
        
        # Update task progress
        task.completed_employees += completed_count
        task.failed_employees += len(batch_errors)
        task.errors.extend(batch_errors)
        task.save()
        
        return {
            'batch_number': batch_number,
            'completed': completed_count,
            'errors': batch_errors
        }
        
    except Exception as e:
        # Update task with error
        task = PayslipGenerationTask.objects.get(task_id=task_id)
        task.status = 'FAILED'
        task.errors.append(f"Batch {batch_number} failed: {str(e)}")
        task.save()
        raise


def generate_all_payslips(employee_ids, pay_period, salary_type, created_by_id):
    """
    Coordinate bulk payslip generation for all employees.
    """
    try:
        # Create task record
        task_id = str(uuid.uuid4())
        created_by = User.objects.get(id=created_by_id)
        
        task = PayslipGenerationTask.objects.create(
            task_id=task_id,
            employee_ids=employee_ids,
            pay_period_month=pay_period['month'],
            pay_period_year=pay_period['year'],
            salary_type=salary_type,
            total_employees=len(employee_ids),
            batch_size=25,  # Process 25 employees per batch
            created_by=created_by
        )
        
        # Calculate batches
        batch_size = 25
        total_batches = (len(employee_ids) + batch_size - 1) // batch_size
        task.total_batches = total_batches
        task.save()
        
        # Process employees in batches synchronously
        for i in range(0, len(employee_ids), batch_size):
            batch_employee_ids = employee_ids[i:i + batch_size]
            batch_number = (i // batch_size) + 1
            
            # Call batch generation task synchronously
            generate_payslip_batch(
                task_id,
                batch_employee_ids,
                pay_period,
                salary_type,
                batch_number,
                total_batches
            )
        
        # Mark task as completed
        task.status = 'COMPLETED'
        task.completed_at = timezone.now()
        task.save()
        
        return task_id
        
    except Exception as e:
        raise


# check_completion function removed - no longer needed for synchronous processing


def calculate_salary_components(salary_structure, pay_period):
    """
    Calculate salary components for a payslip.
    """
    # Get month details
    month_details = get_month_details(pay_period['month'], pay_period['year'])
    working_days = month_details['working_days']
    lop_days = 0
    payable_days = Decimal(str(working_days))

    # Payroll integration with attendance summaries.
    try:
        from attendance.services import get_payroll_metrics

        month_number = datetime.strptime(pay_period['month'], '%B').month
        attendance_metrics = get_payroll_metrics(
            salary_structure.employee,
            month_number,
            int(pay_period['year']),
        )
        working_days = int(attendance_metrics.get('working_days') or working_days)
        lop_days = int(attendance_metrics.get('absent_days') or 0)
        payable_days = Decimal(str(attendance_metrics.get('payable_days') or working_days))
    except Exception:
        # Fallback to static month details if attendance summary is unavailable.
        pass
    
    # Calculate basic components
    monthly_salary = salary_structure.monthly_salary
    basic = salary_structure.basic_salary
    hra = salary_structure.hra
    da = salary_structure.da
    conveyance = salary_structure.conveyance
    medical = salary_structure.medical
    special_allowance = salary_structure.special_allowance
    pf_employee = salary_structure.pf_employee
    pf_employer = salary_structure.pf_employer
    professional_tax = salary_structure.professional_tax
    
    # Calculate totals
    total_earnings = basic + hra + da + conveyance + medical + special_allowance + pf_employee
    lop_deduction = Decimal('0')
    if working_days > 0 and payable_days < Decimal(str(working_days)):
        monthly_base = Decimal(str(monthly_salary))
        salary_per_day = monthly_base / Decimal(str(working_days))
        payable_salary = salary_per_day * payable_days
        lop_deduction = max(monthly_base - payable_salary, Decimal('0')).quantize(Decimal('0.01'))

    total_deductions = professional_tax + pf_employer + lop_deduction
    net_pay = total_earnings - total_deductions

    return {
        'work_days': working_days,
        'days_in_month': month_details['total_days'],
        'lop_days': lop_days,
        'basic': Decimal(str(basic)),
        'hra': Decimal(str(hra)),
        'da': Decimal(str(da)),
        'conveyance': Decimal(str(conveyance)),
        'medical': Decimal(str(medical)),
        'special_allowance': Decimal(str(special_allowance)),
        'pf_employee': Decimal(str(pf_employee)),
        'total_earnings': Decimal(str(total_earnings)),
        'professional_tax': Decimal(str(professional_tax)),
        'pf_employer': Decimal(str(pf_employer)),
        'other_deductions': lop_deduction,
        'salary_advance': Decimal('0'),
        'total_deductions': Decimal(str(total_deductions)),
        'net_pay': Decimal(str(net_pay)),
    }


def get_month_details(month, year):
    """
    Get month details including total days and working days.
    """
    month_details = {
        'January': {'total_days': 31, 'working_days': 23},
        'February': {'total_days': 28, 'working_days': 20},
        'March': {'total_days': 31, 'working_days': 23},
        'April': {'total_days': 30, 'working_days': 22},
        'May': {'total_days': 31, 'working_days': 23},
        'June': {'total_days': 30, 'working_days': 22},
        'July': {'total_days': 31, 'working_days': 23},
        'August': {'total_days': 31, 'working_days': 23},
        'September': {'total_days': 30, 'working_days': 22},
        'October': {'total_days': 31, 'working_days': 23},
        'November': {'total_days': 30, 'working_days': 22},
        'December': {'total_days': 31, 'working_days': 23},
    }
    
    # Handle leap year for February
    if month == 'February' and int(year) % 4 == 0:
        month_details['February']['total_days'] = 29
        month_details['February']['working_days'] = 21
    
    return month_details.get(month, {'total_days': 30, 'working_days': 22})


def generate_qr_code_data(employee, salary_data, pay_period):
    """
    Generate QR code data for payslip verification.
    Contains Employee ID, payslip month & year, and verified tick symbol.
    """
    qr_data = f"✓ Verified|EmpID:{employee.employee_id}|Month:{pay_period['month']}|Year:{pay_period['year']}"
    return qr_data
