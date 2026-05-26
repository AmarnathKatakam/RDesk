"""
Payslip File Management Utilities

PDF generation is handled exclusively by FrontendPDFGenerator (frontend_pdf_generator.py).
The old ReportLab generator has been removed.

This module provides:
  - PayslipFileManager: file path resolution, email sending, ZIP creation
"""
import os
import logging
from django.conf import settings
from django.core.mail import EmailMessage


class PayslipFileManager:
    """
    Utility class for managing payslip files.
    """
    
    def __init__(self):
        self.base_path = os.path.join(settings.MEDIA_ROOT, 'payslips')
    
    def get_payslip_path(self, year, month, employee_name):
        """
        Get the file path for a payslip.
        """
        # Clean employee name for filename
        clean_name = employee_name.lower().replace(' ', '_')
        filename = f"payslip_{clean_name}_{month.lower()}.pdf"
        
        # Create directory structure: payslips/YYYY/MMMM/
        directory = os.path.join(self.base_path, str(year), month)
        os.makedirs(directory, exist_ok=True)
        
        return os.path.join(directory, filename)

    def send_payslip_email(self, payslip):
        """
        Email the generated payslip PDF to the employee if email exists.
        """
        employee_email = getattr(payslip.employee, 'email', None)
        if not employee_email:
            logging.getLogger('payslip_generation').warning(
                f"Skipping email: no email for employee id={payslip.employee_id} name={payslip.employee.name}"
            )
            return False

        month = payslip.pay_period_month
        year = payslip.pay_period_year
        employee_name = payslip.employee.name
        company_name = getattr(settings, 'COMPANY_NAME', 'BlackRoth Software Solutions')
        hr_contact = getattr(settings, 'HR_CONTACT', settings.DEFAULT_FROM_EMAIL)

        subject = f"Payslip for {month} {year}"
        body = (
            f"Dear {employee_name},\n\n"
            f"Please find attached your payslip for the month of {month} {year}.\n"
            f"This document contains details of your salary, deductions, and net pay.\n\n"
            f"If you have any questions regarding your payslip, kindly contact the HR/Payroll department at {hr_contact}.\n\n"
            f"Thank you for your continued dedication and contributions to the company.\n\n"
            f"Best regards,\n"
            f"Payroll Team\n"
            f"{company_name}"
        )

        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=settings.EMAIL_HOST_USER,
            to=[employee_email],
        )

        # Attach PDF
        try:
            resolved_path = self._resolve_pdf_path(payslip.pdf_path)
            # Use requested attachment naming style without altering stored file
            month_year = f"{month}{year}"
            emp_token = employee_name.replace(' ', '_')
            attachment_name = f"Payslip_{emp_token}_{month_year}.pdf"
            with open(resolved_path, 'rb') as f:
                email.attach(attachment_name, f.read(), 'application/pdf')
            email.send(fail_silently=False)
            logging.getLogger('payslip_generation').info(
                f"Payslip email sent to {employee_email} for payslip id={payslip.id} file={resolved_path}"
            )
            return True
        except Exception as e:
            logging.getLogger('payslip_generation').error(
                f"Failed to send payslip email to {employee_email} for payslip id={payslip.id}: {e}"
            )
            return False

    def _resolve_pdf_path(self, stored_path: str) -> str:
        """
        Resolve the stored PDF path into an absolute filesystem path, handling
        absolute paths, media-relative paths, and raw relative paths.
        """
        # Absolute path stored
        if os.path.isabs(stored_path) and os.path.exists(stored_path):
            return stored_path

        # Paths starting with 'media' or '/media'
        cleaned = stored_path.replace('\\', '/').lstrip('/')
        if cleaned.startswith('media/'):
            candidate = os.path.join(settings.BASE_DIR, cleaned)
            if os.path.exists(candidate):
                return candidate

        # Relative to MEDIA_ROOT
        candidate = os.path.join(settings.MEDIA_ROOT, stored_path)
        if os.path.exists(candidate):
            return candidate

        # As-is fallback
        return stored_path
    
    def get_monthly_payslips_path(self, year, month):
        """
        Get the directory path for monthly payslips.
        """
        return os.path.join(self.base_path, str(year), month)
    
    def create_zip_archive(self, year, month):
        """
        Create a zip archive of all payslips for a month.
        """
        import zipfile
        
        monthly_path = self.get_monthly_payslips_path(year, month)
        zip_filename = f"payslips_{month}_{year}.zip"
        zip_path = os.path.join(monthly_path, zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(monthly_path):
                for file in files:
                    if file.endswith('.pdf'):
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, monthly_path)
                        zipf.write(file_path, arcname)
        
        return zip_path
    
    def cleanup_old_files(self, days=90):
        """
        Clean up payslip files older than specified days.
        """
        import time
        
        current_time = time.time()
        cutoff_time = current_time - (days * 24 * 60 * 60)
        
        for root, dirs, files in os.walk(self.base_path):
            for file in files:
                file_path = os.path.join(root, file)
                if os.path.getmtime(file_path) < cutoff_time:
                    os.remove(file_path)
                    print(f"Deleted old file: {file_path}")
