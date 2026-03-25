from django.core.management.base import BaseCommand
from employees.models import Employee, MonthlySalaryData
from payslip_generation.models import Payslip
from django.contrib.auth import get_user_model
import traceback

User = get_user_model()

class Command(BaseCommand):
    help = 'Debug payslip generation step by step'

    def handle(self, *args, **options):
        self.stdout.write("=== DEBUGGING PAYSLIP GENERATION ===\n")
        
        # Get first employee with salary data
        salary_data = MonthlySalaryData.objects.filter(
            month='January',
            year=2025
        ).first()
        
        if not salary_data:
            self.stdout.write(self.style.ERROR("No salary data found for January 2025!"))
            return
        
        employee = salary_data.employee
        self.stdout.write(f"Employee: {employee.name} ({employee.employee_id})")
        self.stdout.write(f"Department: {employee.department.department_name}")
        
        # Check monthly salary data
        self.stdout.write(f"\nMonthly Salary Data:")
        self.stdout.write(f"- Basic: ₹{salary_data.basic}")
        self.stdout.write(f"- HRA: ₹{salary_data.hra}")
        self.stdout.write(f"- Total Earnings: ₹{salary_data.total_earnings}")
        self.stdout.write(f"- Net Pay: ₹{salary_data.net_pay}")
        
        # Test QR code generation
        try:
            from payslip_generation.tasks import generate_qr_code_data
            pay_period = {'month': 'January', 'year': 2025}
            salary_data_dict = {
                'work_days': salary_data.work_days,
                'days_in_month': salary_data.days_in_month,
                'lop_days': salary_data.lop_days,
                'basic': salary_data.basic,
                'hra': salary_data.hra,
                'da': salary_data.da,
                'conveyance': salary_data.conveyance,
                'medical': salary_data.medical,
                'special_allowance': salary_data.special_allowance,
                'pf_employee': salary_data.pf_employee,
                'total_earnings': salary_data.total_earnings,
                'professional_tax': salary_data.professional_tax,
                'pf_employer': salary_data.pf_employer,
                'other_deductions': salary_data.other_deductions,
                'salary_advance': salary_data.salary_advance,
                'total_deductions': salary_data.total_deductions,
                'net_pay': salary_data.net_pay,
            }
            
            qr_data = generate_qr_code_data(employee, salary_data_dict, pay_period)
            self.stdout.write(f"✓ QR code data generated: {qr_data[:50]}...")
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"✗ QR code generation failed: {str(e)}"))
            self.stdout.write(traceback.format_exc())
            return
        
        # Test PDF path generation
        try:
            from payslip_generation.utils import PayslipFileManager
            file_manager = PayslipFileManager()
            pdf_path = file_manager.get_payslip_path(2025, 'January', employee.name)
            self.stdout.write(f"✓ PDF path generated: {pdf_path}")
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"✗ PDF path generation failed: {str(e)}"))
            self.stdout.write(traceback.format_exc())
            return
        
        # Test PDF generation
        try:
            from payslip_generation.frontend_pdf_generator import FrontendPDFGenerator
            pdf_generator = FrontendPDFGenerator()
            
            # Create a test payslip object
            user = User.objects.first()
            payslip = Payslip.objects.create(
                employee=employee,
                pay_period_month='January',
                pay_period_year=2025,
                salary_type='SALARY',
                work_days=salary_data.work_days,
                days_in_month=salary_data.days_in_month,
                lop_days=salary_data.lop_days,
                basic=salary_data.basic,
                hra=salary_data.hra,
                da=salary_data.da,
                conveyance=salary_data.conveyance,
                medical=salary_data.medical,
                special_allowance=salary_data.special_allowance,
                pf_employee=salary_data.pf_employee,
                total_earnings=salary_data.total_earnings,
                professional_tax=salary_data.professional_tax,
                pf_employer=salary_data.pf_employer,
                other_deductions=salary_data.other_deductions,
                salary_advance=salary_data.salary_advance,
                total_deductions=salary_data.total_deductions,
                net_pay=salary_data.net_pay,
                pdf_path=pdf_path,
                qr_code_data=qr_data,
                generated_by=user
            )
            
            # Generate PDF
            pdf_generator.generate_payslip_pdf(payslip, pdf_path)
            self.stdout.write(self.style.SUCCESS(f"✓ PDF generated successfully!"))
            self.stdout.write(f"Payslip ID: {payslip.id}")
            
            # Check if file exists
            import os
            from django.conf import settings
            full_path = os.path.join(settings.MEDIA_ROOT, pdf_path)
            if os.path.exists(full_path):
                file_size = os.path.getsize(full_path)
                self.stdout.write(self.style.SUCCESS(f"✓ PDF file exists: {full_path} ({file_size} bytes)"))
            else:
                self.stdout.write(self.style.ERROR(f"✗ PDF file missing: {full_path}"))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"✗ PDF generation failed: {str(e)}"))
            self.stdout.write(traceback.format_exc())
