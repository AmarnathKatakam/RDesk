from django.core.management.base import BaseCommand
from employees.models import Employee, MonthlySalaryData
from payslip_generation.models import Payslip

class Command(BaseCommand):
    help = 'Check employee and salary data'

    def handle(self, *args, **options):
        self.stdout.write("=== DATA STATUS CHECK ===\n")
        
        # Check employees
        total_employees = Employee.objects.count()
        active_employees = Employee.objects.filter(is_active=True).count()
        self.stdout.write(f"Total employees: {total_employees}")
        self.stdout.write(f"Active employees: {active_employees}")
        
        if total_employees > 0:
            self.stdout.write(f"\n=== SAMPLE EMPLOYEES ===")
            employees = Employee.objects.filter(is_active=True)[:5]
            for emp in employees:
                self.stdout.write(f"- {emp.name} ({emp.employee_id}) - {emp.department.department_name}")
        
        # Check monthly salary data
        total_salary_data = MonthlySalaryData.objects.count()
        self.stdout.write(f"\nTotal monthly salary records: {total_salary_data}")
        
        if total_salary_data > 0:
            self.stdout.write(f"\n=== SAMPLE SALARY DATA ===")
            salary_data = MonthlySalaryData.objects.all()[:5]
            for data in salary_data:
                self.stdout.write(f"- {data.employee.name} - {data.month} {data.year} - Basic: ₹{data.basic}")
        
        # Check payslips
        total_payslips = Payslip.objects.count()
        self.stdout.write(f"\nTotal payslips: {total_payslips}")
        
        if total_payslips > 0:
            self.stdout.write(f"\n=== SAMPLE PAYSLIPS ===")
            payslips = Payslip.objects.all()[:5]
            for payslip in payslips:
                self.stdout.write(f"- {payslip.employee.name} - {payslip.pay_period_month} {payslip.pay_period_year}")

