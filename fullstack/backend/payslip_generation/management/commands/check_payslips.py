from django.core.management.base import BaseCommand
from django.conf import settings
from payslip_generation.models import Payslip
import os

class Command(BaseCommand):
    help = 'Check payslip status and file locations'

    def handle(self, *args, **options):
        self.stdout.write("=== PAYSLIP STATUS CHECK ===\n")
        
        # Check total payslips in database
        total_payslips = Payslip.objects.count()
        self.stdout.write(f"Total payslips in database: {total_payslips}")
        
        if total_payslips == 0:
            self.stdout.write(self.style.WARNING("No payslips found in database!"))
            return
        
        # Check media directory
        media_root = settings.MEDIA_ROOT
        payslips_dir = os.path.join(media_root, 'payslips')
        
        self.stdout.write(f"\nMedia root: {media_root}")
        self.stdout.write(f"Payslips directory: {payslips_dir}")
        
        if not os.path.exists(payslips_dir):
            self.stdout.write(self.style.ERROR("Payslips directory does not exist!"))
            return
        
        # List all payslips
        self.stdout.write(f"\n=== RECENT PAYSLIPS ===")
        recent_payslips = Payslip.objects.all().order_by('-generated_at')[:10]
        
        for payslip in recent_payslips:
            self.stdout.write(f"\nPayslip ID: {payslip.id}")
            self.stdout.write(f"Employee: {payslip.employee.name} ({payslip.employee.employee_id})")
            self.stdout.write(f"Period: {payslip.pay_period_month} {payslip.pay_period_year}")
            self.stdout.write(f"Generated: {payslip.generated_at}")
            self.stdout.write(f"PDF Path: {payslip.pdf_path}")
            
            # Check if file exists
            full_path = os.path.join(media_root, payslip.pdf_path)
            if os.path.exists(full_path):
                file_size = os.path.getsize(full_path)
                self.stdout.write(self.style.SUCCESS(f"✓ File exists: {full_path} ({file_size} bytes)"))
            else:
                self.stdout.write(self.style.ERROR(f"✗ File missing: {full_path}"))
        
        # Check directory structure
        self.stdout.write(f"\n=== DIRECTORY STRUCTURE ===")
        self._list_directory(payslips_dir, 0)
    
    def _list_directory(self, path, depth):
        """Recursively list directory contents"""
        try:
            items = os.listdir(path)
            for item in sorted(items):
                item_path = os.path.join(path, item)
                indent = "  " * depth
                if os.path.isdir(item_path):
                    self.stdout.write(f"{indent}📁 {item}/")
                    if depth < 3:  # Limit depth to avoid too much output
                        self._list_directory(item_path, depth + 1)
                else:
                    size = os.path.getsize(item_path)
                    self.stdout.write(f"{indent}📄 {item} ({size} bytes)")
        except PermissionError:
            self.stdout.write(f"{'  ' * depth}❌ Permission denied")

