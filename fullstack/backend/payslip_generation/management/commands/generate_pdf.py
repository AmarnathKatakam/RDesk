from django.core.management.base import BaseCommand
from payslip_generation.models import Payslip
from payslip_generation.frontend_pdf_generator import FrontendPDFGenerator
import os

class Command(BaseCommand):
    help = 'Generate PDF for existing payslip'

    def handle(self, *args, **options):
        self.stdout.write("=== GENERATING PDF FOR EXISTING PAYSLIP ===\n")
        
        # Get the existing payslip
        payslip = Payslip.objects.first()
        if not payslip:
            self.stdout.write(self.style.ERROR("No payslips found in database!"))
            return
        
        self.stdout.write(f"Payslip: {payslip.employee.name} - {payslip.pay_period_month} {payslip.pay_period_year}")
        self.stdout.write(f"PDF Path: {payslip.pdf_path}")
        
        # Generate PDF
        try:
            pdf_generator = FrontendPDFGenerator()
            pdf_generator.generate_payslip_pdf(payslip, payslip.pdf_path)
            self.stdout.write(self.style.SUCCESS("✓ PDF generated successfully!"))
            
            # Check if file exists
            from django.conf import settings
            full_path = os.path.join(settings.MEDIA_ROOT, payslip.pdf_path)
            if os.path.exists(full_path):
                file_size = os.path.getsize(full_path)
                self.stdout.write(self.style.SUCCESS(f"✓ PDF file exists: {full_path} ({file_size} bytes)"))
            else:
                self.stdout.write(self.style.ERROR(f"✗ PDF file missing: {full_path}"))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"✗ PDF generation failed: {str(e)}"))
            import traceback
            self.stdout.write(traceback.format_exc())
