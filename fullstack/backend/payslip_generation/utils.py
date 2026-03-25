import os
import qrcode
from datetime import datetime
from decimal import Decimal
from django.conf import settings
from django.core.files.storage import default_storage
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from io import BytesIO
from django.core.mail import EmailMessage
import logging

from .models import Payslip


class PayslipPDFGenerator:
    """
    Utility class for generating payslip PDFs.
    """
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.setup_custom_styles()
    
    def setup_custom_styles(self):
        """Setup custom styles for the payslip."""
        # Company header style
        self.styles.add(ParagraphStyle(
            name='CompanyHeader',
            parent=self.styles['Heading1'],
            fontSize=18,
            spaceAfter=12,
            alignment=TA_CENTER,
            textColor=colors.darkblue,
            fontName='Helvetica-Bold'
        ))
        
        # Employee info style
        self.styles.add(ParagraphStyle(
            name='EmployeeInfo',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=6,
            alignment=TA_LEFT,
            fontName='Helvetica'
        ))
        
        # Section header style
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=12,
            spaceAfter=8,
            alignment=TA_LEFT,
            textColor=colors.darkblue,
            fontName='Helvetica-Bold'
        ))
    
    def generate_payslip_pdf(self, payslip, file_path):
        """
        Generate PDF for a payslip.
        """
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Create PDF document
        doc = SimpleDocTemplate(
            file_path,
            pagesize=A4,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18
        )
        
        # Build PDF content
        story = []
        
        # Add company header
        story.extend(self._create_company_header())
        story.append(Spacer(1, 20))
        
        # Add payslip title
        story.append(self._create_payslip_title(payslip))
        story.append(Spacer(1, 20))
        
        # Add employee information
        story.append(self._create_employee_info(payslip))
        story.append(Spacer(1, 20))
        
        # Add salary details
        story.extend(self._create_salary_details(payslip))
        story.append(Spacer(1, 20))
        
        # Add QR code
        story.extend(self._create_qr_code(payslip))
        
        # Build PDF
        doc.build(story)
        
        return file_path
    
    def _create_company_header(self):
        """Create company header section."""
        return [
            Paragraph("BLACKROTH SOFTWARE SOLUTIONS PVT LTD", self.styles['CompanyHeader']),
            Paragraph("13th FLOOR, MANJEERA TRINITY CORPORATE, JNTU - HITECH CITY ROAD, 3/d PHASE, KPHB, KUKATPALLY, HYDERABAD - 500072", self.styles['Normal']),
            Paragraph("Tel: +91-40-12345678 | Email: info@blackroth.com", self.styles['Normal']),
        ]
    
    def _create_payslip_title(self, payslip):
        """Create payslip title section."""
        title = f"PAYSLIP FOR THE MONTH OF {payslip.pay_period_month.upper()} {payslip.pay_period_year}"
        return Paragraph(title, self.styles['SectionHeader'])
    
    def _create_employee_info(self, payslip):
        """Create employee information section."""
        employee = payslip.employee
        
        # Create employee info table
        employee_data = [
            ['Employee ID:', employee.employee_id, 'Name:', employee.name],
            ['Position:', employee.position, 'Department:', employee.department.department_name],
            ['Date of Joining:', employee.doj.strftime('%d-%m-%Y'), 'PAN:', employee.pan],
            ['Bank Account:', employee.bank_account, 'IFSC:', employee.bank_ifsc],
            ['Pay Mode:', employee.pay_mode, 'Location:', employee.location],
        ]
        
        employee_table = Table(employee_data, colWidths=[1.5*inch, 2*inch, 1.5*inch, 2*inch])
        employee_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('BACKGROUND', (2, 0), (2, -1), colors.lightgrey),
        ]))
        
        return employee_table
    
    def _create_salary_details(self, payslip):
        """Create salary details section."""
        # Earnings table
        earnings_data = [
            ['EARNINGS', 'Amount (₹)'],
            ['Basic Salary', self._format_currency(payslip.basic)],
            ['House Rent Allowance', self._format_currency(payslip.hra)],
            ['Dearness Allowance', self._format_currency(payslip.da)],
            ['Conveyance Allowance', self._format_currency(payslip.conveyance)],
            ['Medical Allowance', self._format_currency(payslip.medical)],
            ['Special Allowance', self._format_currency(payslip.special_allowance)],
            ['PF Employee Contribution', self._format_currency(payslip.pf_employee)],
            ['', ''],
            ['TOTAL EARNINGS', self._format_currency(payslip.total_earnings)],
        ]
        
        earnings_table = Table(earnings_data, colWidths=[4*inch, 1.5*inch])
        earnings_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -2), (-1, -1), colors.lightgrey),
            ('FONTNAME', (0, -2), (-1, -1), 'Helvetica-Bold'),
        ]))
        
        # Deductions table
        deductions_data = [
            ['DEDUCTIONS', 'Amount (₹)'],
            ['Professional Tax', self._format_currency(payslip.professional_tax)],
            ['PF Employer Contribution', self._format_currency(payslip.pf_employer)],
            ['Other Deductions', self._format_currency(payslip.other_deductions)],
            ['Salary Advance', self._format_currency(payslip.salary_advance)],
            ['', ''],
            ['TOTAL DEDUCTIONS', self._format_currency(payslip.total_deductions)],
        ]
        
        deductions_table = Table(deductions_data, colWidths=[4*inch, 1.5*inch])
        deductions_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkred),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -2), (-1, -1), colors.lightgrey),
            ('FONTNAME', (0, -2), (-1, -1), 'Helvetica-Bold'),
        ]))
        
        # Net pay section
        net_pay_data = [
            ['NET PAY', self._format_currency(payslip.net_pay)],
        ]
        
        net_pay_table = Table(net_pay_data, colWidths=[4*inch, 1.5*inch])
        net_pay_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('BACKGROUND', (0, 0), (-1, -1), colors.darkgreen),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.whitesmoke),
        ]))
        
        return [earnings_table, Spacer(1, 12), deductions_table, Spacer(1, 12), net_pay_table]
    
    def _create_qr_code(self, payslip):
        """Create QR code section."""
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(payslip.qr_code_data)
        qr.make(fit=True)
        
        # Create QR code image
        qr_img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to BytesIO
        img_buffer = BytesIO()
        qr_img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        # Create ReportLab Image
        qr_image = Image(img_buffer, width=1*inch, height=1*inch)
        
        # Create QR code section
        qr_section = [
            Paragraph("Verification QR Code:", self.styles['Normal']),
            Spacer(1, 6),
            qr_image,
            Spacer(1, 12),
            Paragraph(f"Generated on: {payslip.generated_at.strftime('%d-%m-%Y %H:%M:%S')}", self.styles['Normal']),
        ]
        
        return qr_section
    
    def _format_currency(self, amount):
        """Format currency amount in Indian format."""
        if isinstance(amount, Decimal):
            amount = float(amount)
        return f"₹ {amount:,.2f}"


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
