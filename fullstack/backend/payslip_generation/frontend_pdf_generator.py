import os
import qrcode
from datetime import datetime
from decimal import Decimal
from django.conf import settings
from playwright.sync_api import sync_playwright
from io import BytesIO
import base64

from .models import Payslip


class FrontendPDFGenerator:
    """
    PDF generator that uses the frontend template design with Playwright.
    """
    
    def __init__(self):
        self.base_path = os.path.join(settings.MEDIA_ROOT, 'payslips')
    
    def generate_payslip_pdf(self, payslip, file_path):
        """
        Generate PDF using the frontend template design.
        """
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Generate HTML content
        html_content = self._generate_html_content(payslip)
        
        # Generate PDF using Playwright
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            
            # Set content and wait for it to load
            page.set_content(html_content)
            page.wait_for_load_state('networkidle')
            
            # Generate PDF
            page.pdf(
                path=file_path,
                format='A4',
                margin={
                    'top': '0.3in',
                    'right': '0.3in',
                    'bottom': '0.3in',
                    'left': '0.3in'
                },
                print_background=True,
                prefer_css_page_size=True
            )
            
            browser.close()
        
        return file_path
    
    def _generate_html_content(self, payslip):
        """
        Generate HTML content based on the frontend PayslipPreview template.
        """
        employee = payslip.employee
        
        # Generate QR code
        qr_data = payslip.qr_code_data
        qr_img = self._generate_qr_code_image(qr_data)
        
        # Format currency
        def format_currency(amount):
            if isinstance(amount, Decimal):
                amount = float(amount)
            return f"₹ {amount:,.2f}"
        
        # Number to words conversion
        def number_to_words(num):
            if num == 0:
                return "Zero Only"
            
            ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
            tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
            teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
            
            def convert_less_than_one_thousand(n):
                if n == 0:
                    return ''
                if n < 10:
                    return ones[n]
                if n < 20:
                    return teens[n - 10]
                if n < 100:
                    return tens[n // 10] + ('' if n % 10 == 0 else ' ' + ones[n % 10])
                if n < 1000:
                    return ones[n // 100] + ' Hundred' + ('' if n % 100 == 0 else ' and ' + convert_less_than_one_thousand(n % 100))
                return ''
            
            def convert(n):
                if n == 0:
                    return 'Zero'
                
                crore = n // 10000000
                lakh = (n % 10000000) // 100000
                thousand = (n % 100000) // 1000
                remainder = n % 1000
                
                result = ''
                
                if crore > 0:
                    result += convert_less_than_one_thousand(crore) + ' Crore'
                if lakh > 0:
                    if result:
                        result += ' '
                    result += convert_less_than_one_thousand(lakh) + ' Lakh'
                if thousand > 0:
                    if result:
                        result += ' '
                    result += convert_less_than_one_thousand(thousand) + ' Thousand'
                if remainder > 0:
                    if result:
                        result += ' '
                    result += convert_less_than_one_thousand(remainder)
                
                return result + ' Only'
            
            return convert(int(num))
        
        # Calculate totals
        total_earnings = payslip.total_earnings
        total_deductions = payslip.total_deductions
        net_pay = payslip.net_pay
        
        html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payslip - {employee.name}</title>
            <style>
                * {{
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }}
                
                                 body {{
                     font-family: 'Droid Serif', serif;
                     line-height: 1.3;
                     color: #333;
                     background: white;
                     margin: 0;
                     padding: 0;
                 }}
                
                                 .payslip-container {{
                     max-width: 800px;
                     margin: 0 auto;
                     background: white;
                     box-shadow: 0 0 20px rgba(0,0,0,0.1);
                     border-radius: 8px;
                     border: 2px solid #000;
                     padding: 20px;
                     page-break-inside: avoid;
                     height: 100vh;
                     overflow: hidden;
                 }}
                
                                 .header {{
                     display: flex;
                     align-items: center;
                     margin-bottom: 15px;
                     position: relative;
                 }}
                
                .logo {{
                    width: 128px;
                    flex-shrink: 0;
                }}
                
                .logo img {{
                    width: 100%;
                    height: auto;
                }}
                
                .company-info {{
                    flex-grow: 1;
                    text-align: center;
                    font-size: 14px;
                }}
                
                .company-info h1 {{
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 4px;
                }}
                
                .company-info p {{
                    margin: 4px 0;
                }}
                
                .payslip-title {{
                    width: 128px;
                    flex-shrink: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    justify-content: flex-start;
                }}
                
                .payslip-title span {{
                    font-size: 24px;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: #2563eb;
                    margin-top: 8px;
                }}
                
                                 .divider {{
                     border-bottom: 2px solid #000;
                     margin-bottom: 12px;
                 }}
                
                                 .section {{
                     margin-bottom: 16px;
                 }}
                
                                 .section h2 {{
                     font-size: 16px;
                     font-weight: 600;
                     border-bottom: 1px solid #000;
                     padding-bottom: 3px;
                     margin-bottom: 6px;
                 }}
                
                                 .employee-details {{
                     display: grid;
                     grid-template-columns: 1fr 1fr;
                     gap: 12px;
                     font-size: 13px;
                 }}
                
                                 .employee-details p {{
                     margin: 2px 0;
                 }}
                
                .employee-details strong {{
                    font-weight: 600;
                }}
                
                                 .earnings-table {{
                     width: 100%;
                     border-collapse: collapse;
                     font-size: 13px;
                     border: 1px solid #ccc;
                 }}
                
                                 .earnings-table th,
                 .earnings-table td {{
                     border: 1px solid #ccc;
                     padding: 6px;
                     text-align: left;
                 }}
                
                .earnings-table th {{
                    background-color: #f5f5f5;
                    font-weight: 600;
                }}
                
                .earnings-table .amount {{
                    text-align: right;
                }}
                
                .earnings-table .total-row {{
                    font-weight: 600;
                    background-color: #f0f0f0;
                }}
                
                                 .net-pay-section {{
                     display: flex;
                     justify-content: space-between;
                     align-items: center;
                     margin-top: 16px;
                 }}
                
                                 .net-pay-info {{
                     font-size: 13px;
                 }}
                
                                 .net-pay-info p {{
                     margin: 2px 0;
                 }}
                
                .qr-section {{
                    text-align: center;
                }}
                
                                 .qr-section img {{
                     width: 80px;
                     height: 80px;
                     margin: 0 auto;
                 }}
                
                .qr-section p {{
                    font-size: 12px;
                    margin-top: 4px;
                }}
                
                                 .footer {{
                     font-size: 11px;
                     color: #666;
                     background-color: #f5f5f5;
                     border: 1px solid #ccc;
                     padding: 12px;
                     border-radius: 4px;
                     margin-top: 16px;
                 }}
                
                                 .footer p {{
                     margin: 4px 0;
                 }}
                
                .footer strong {{
                    font-weight: 600;
                }}
                
                                 .signature-note {{
                     text-align: center;
                     margin-top: 20px;
                     font-size: 11px;
                 }}
                
                .signature-note strong {{
                    font-weight: 600;
                }}
            </style>
        </head>
        <body>
            <div class="payslip-container">
                <!-- Header -->
                <div class="header">
                    <div class="logo">
                        <img src="data:image/png;base64,{self._get_logo_base64()}" alt="RDesk Logo" />
                    </div>
                    <div class="company-info">
                        <h1>BlackRoth Software Solutions Pvt. Ltd.</h1>
                        <p>13th FLOOR, MANJEERA TRINITY CORPORATE, JNTU - HITECH CITY ROAD, 3/d PHASE, KPHB, KUKATPALLY, HYDERABAD - 500072</p>
                        <p style="margin-top: 4px; font-weight: 600;">Payslip for the Month of {payslip.pay_period_month} {payslip.pay_period_year}</p>
                    </div>
                    <div class="payslip-title">
                        <span>PAYSLIP</span>
                    </div>
                </div>
                <div class="divider"></div>

                <!-- Employee Details -->
                <div class="section">
                    <h2>Employee Details</h2>
                    <div class="employee-details">
                        <p><strong>Emp ID:</strong> {employee.employee_id}</p>
                        <p><strong>Employee Name:</strong> {employee.name}</p>
                        <p><strong>Designation:</strong> {employee.position}</p>
                        <p><strong>DOB:</strong> {employee.dob.strftime('%d-%m-%Y') if employee.dob else ''}</p>
                        <p><strong>DOJ:</strong> {employee.doj.strftime('%d-%m-%Y') if employee.doj else ''}</p>
                        <p><strong>PAN No:</strong> {employee.pan}</p>
                        <p><strong>PF No:</strong> {employee.pf_number if employee.pf_number else ''}</p>
                        <p><strong>Bank Acc No:</strong> {employee.bank_account}</p>
                        <p><strong>Bank IFSC:</strong> {employee.bank_ifsc}</p>
                        <p><strong>Pay Mode:</strong> {employee.pay_mode}</p>
                        <p><strong>Location:</strong> {employee.location}</p>
                        <p><strong>Department:</strong> {employee.department.department_name}</p>
                        <p><strong>Work Days:</strong> {payslip.work_days}</p>
                        <p><strong>Days in Month:</strong> {payslip.days_in_month}</p>
                        <p><strong>LOP:</strong> {payslip.lop_days}</p>
                    </div>
                </div>

                <!-- Earnings & Deductions -->
                <div class="section">
                    <h2>Earnings & Deductions</h2>
                    <table class="earnings-table">
                        <thead>
                            <tr>
                                <th>Earnings</th>
                                <th class="amount">Amount (₹)</th>
                                <th>Deductions</th>
                                <th class="amount">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Basic</td>
                                <td class="amount">{format_currency(payslip.basic)}</td>
                                <td>Professional Tax</td>
                                <td class="amount">{format_currency(payslip.professional_tax)}</td>
                            </tr>
                            <tr>
                                <td>Dearness Allowance</td>
                                <td class="amount">{format_currency(payslip.hra)}</td>
                                <td>PF Contribution (Employer)</td>
                                <td class="amount">{format_currency(payslip.pf_employer)}</td>
                            </tr>
                            <tr>
                                <td>House Rent Allowance</td>
                                <td class="amount">{format_currency(payslip.da)}</td>
                                <td>Other Deduction</td>
                                <td class="amount">{format_currency(payslip.other_deductions)}</td>
                            </tr>
                            <tr>
                                <td>Conveyance</td>
                                <td class="amount">{format_currency(payslip.conveyance)}</td>
                                <td>Salary Advance</td>
                                <td class="amount">{format_currency(payslip.salary_advance)}</td>
                            </tr>
                            <tr>
                                <td>Medical Expenses</td>
                                <td class="amount">{format_currency(payslip.medical)}</td>
                                <td></td>
                                <td></td>
                            </tr>
                            <tr>
                                <td>Special</td>
                                <td class="amount">{format_currency(payslip.special_allowance)}</td>
                                <td></td>
                                <td></td>
                            </tr>
                            <tr>
                                <td>PF Contribution (Employee)</td>
                                <td class="amount">{format_currency(payslip.pf_employee)}</td>
                                <td></td>
                                <td></td>
                            </tr>
                            <tr class="total-row">
                                <td>Total Earnings</td>
                                <td class="amount">{format_currency(total_earnings)}</td>
                                <td>Total Deductions</td>
                                <td class="amount">{format_currency(total_deductions)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Net Pay and QR -->
                <div class="net-pay-section">
                    <div class="net-pay-info">
                        <h2>Net Pay</h2>
                        <p><strong>Amount:</strong> {format_currency(net_pay)}</p>
                        <p><strong>Amount in Words:</strong> {number_to_words(net_pay)}</p>
                    </div>
                    <div class="qr-section">
                        <img src="data:image/png;base64,{qr_img}" alt="QR Code" />
                        <p>Scan to verify</p>
                    </div>
                </div>

                <!-- Footer -->
                <div class="footer">
                    <p><strong>Dear Associate</strong>,</p>
                    <p>
                        We thank you for being part of RDesk family! Help others looking for jobs – Ask your friends & family to visit our nearest BlackRoth office to submit their resume or email <strong>jobs@blackroth.com</strong>.
                    </p>
                    <p>For queries, mail to <strong>info@blackroth.com</strong></p>
                </div>
                
                <p class="signature-note">
                    This is a computer-generated payslip. <strong>No signature is required.</strong>
                </p>
            </div>
        </body>
        </html>
        """
        
        return html
    
    def _generate_qr_code_image(self, qr_data):
        """
        Generate QR code image and return as base64 string.
        """
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)
        
        # Create QR code image
        qr_img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        img_buffer = BytesIO()
        qr_img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        return base64.b64encode(img_buffer.getvalue()).decode()
    
    def _get_logo_base64(self):
        """
        Get the logo as base64 string.
        """
        # Try to read the logo from the frontend public directory
        logo_path = os.path.join(settings.BASE_DIR, '..', 'frontend', 'public', 'logo.png')
        
        if os.path.exists(logo_path):
            with open(logo_path, 'rb') as f:
                return base64.b64encode(f.read()).decode()
        
        # Fallback: create a simple text-based logo
        return self._create_text_logo()
    
    def _create_text_logo(self):
        """
        Create a simple text-based logo as base64.
        """
        from PIL import Image, ImageDraw, ImageFont
        import io
        
        # Create a simple logo
        img = Image.new('RGB', (128, 128), color='white')
        draw = ImageDraw.Draw(img)
        
        # Draw text
        try:
            # Try to use a default font
            font = ImageFont.load_default()
        except:
            font = None
        
        text = "RDesk"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        x = (128 - text_width) // 2
        y = (128 - text_height) // 2
        
        draw.text((x, y), text, fill='black', font=font)
        
        # Convert to base64
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        return base64.b64encode(img_buffer.getvalue()).decode()
