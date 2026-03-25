from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from .models import EmailLog
import logging

class EmployeeEmailService:
    """
    Service for sending employee-related emails.
    """
    
    def __init__(self):
        self.from_email = settings.DEFAULT_FROM_EMAIL
        self.company_name = "BlackRoth Software Solutions Pvt. Ltd."
        self.company_address = "13th FLOOR, MANJEERA TRINITY CORPORATE, JNTU - HITECH CITY ROAD, 3/d PHASE, KPHB, KUKATPALLY, HYDERABAD - 500072"
        self.login_url = "https://webmail.blackroth.co.in"
    
    def send_welcome_email(self, employee):
        """
        Send welcome email to new employee with admin-provided password.
        
        Args:
            employee: Employee instance with personal_email and password
            
        Returns:
            tuple: (success: bool, message: str)
        """
        if not employee.personal_email:
            return False, "No personal email address provided"
        
        if not employee.password:
            return False, "No password provided"
        
        # Create email log entry
        email_log = EmailLog.objects.create(
            employee=employee if hasattr(employee, 'id') else None,
            email_type='WELCOME',
            recipient_email=employee.personal_email,
            subject=f"Welcome to {self.company_name}",
            status='PENDING'
        )
        
        try:
            # Prepare email context
            context = {
                'employee_name': employee.name,
                'email': employee.email,  # System login email
                'personal_email': employee.personal_email,  # Email where this is sent
                'password': employee.password,
                'company_name': self.company_name,
                'company_address': self.company_address,
                'login_url': self.login_url
            }
            
            # Render email templates
            html_content = render_to_string('emails/welcome_email.html', context)
            text_content = render_to_string('emails/welcome_email.txt', context)
            
            # Create email
            subject = f"Welcome to {self.company_name}"
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=self.from_email,
                to=[employee.personal_email]  # Send to personal email
            )
            email.attach_alternative(html_content, "text/html")
            
            # Send email
            email.send()
            
            # Update email log
            email_log.status = 'SENT'
            email_log.message = "Welcome email sent successfully"
            email_log.save()
            
            logging.getLogger('employees').info(
                f"Welcome email sent successfully to {employee.personal_email} for employee {employee.employee_id}"
            )
            return True, "Welcome email sent successfully"
            
        except Exception as e:
            error_msg = f"Failed to send welcome email to {employee.personal_email}: {str(e)}"
            
            # Update email log with error
            email_log.status = 'FAILED'
            email_log.error_message = error_msg
            email_log.save()
            
            logging.getLogger('employees').error(error_msg)
            return False, error_msg

    def send_experience_letter(self, employee_name, recipient_email, experience_letter_file, relieving_date=None):
        """
        Send experience letter email with PDF attachment.

        Args:
            employee_name: Name of the employee
            recipient_email: Email address to send to
            experience_letter_file: PDF file object
            relieving_date: Date of relieving (optional, defaults to today)

        Returns:
            tuple: (success: bool, message: str)
        """
        if not recipient_email:
            return False, "No recipient email address provided"

        if not experience_letter_file:
            return False, "No experience letter file provided"

        # Create email log entry
        email_log = EmailLog.objects.create(
            email_type='EXPERIENCE',
            recipient_email=recipient_email,
            subject=f"Experience Letter - {self.company_name}",
            status='PENDING'
        )

        try:
            # Set default relieving date if not provided
            if not relieving_date:
                from datetime import date
                relieving_date = date.today().strftime("%dth %B %Y")

            # Prepare email context
            context = {
                'employee_name': employee_name,
                'company_name': self.company_name,
                'company_address': self.company_address,
                'relieving_date': relieving_date,
                'hr_email': 'hrmanager@blackroth.in',
                'hr_name': 'C Ram Babu',
                'hr_title': 'HR Manager'
            }

            # Render email templates
            html_content = render_to_string('emails/experience_letter.html', context)
            text_content = render_to_string('emails/experience_letter.txt', context)

            # Create email
            subject = f"Experience Letter - {self.company_name}"
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=self.from_email,
                to=[recipient_email]
            )
            email.attach_alternative(html_content, "text/html")

            # Attach the PDF file
            experience_letter_file.seek(0)  # Reset file pointer
            email.attach(
                filename=f"Experience_Letter_{employee_name.replace(' ', '_')}.pdf",
                content=experience_letter_file.read(),
                mimetype='application/pdf'
            )

            # Send email
            email.send()

            # Update email log
            email_log.status = 'SENT'
            email_log.message = f"Experience letter sent successfully to {recipient_email}"
            email_log.save()

            logging.getLogger('employees').info(
                f"Experience letter sent successfully to {recipient_email} for employee {employee_name}"
            )
            return True, "Experience letter sent successfully"

        except Exception as e:
            error_msg = f"Failed to send experience letter to {recipient_email}: {str(e)}"

            # Update email log with error
            email_log.status = 'FAILED'
            email_log.error_message = error_msg
            email_log.save()

            logging.getLogger('employees').error(error_msg)
            return False, error_msg

    def send_relieving_and_experience_letters(self, employee_name, recipient_email, relieving_letter_file, experience_letter_file, relieving_date=None):
        """
        Send both relieving letter and experience letter emails with PDF attachments.

        Args:
            employee_name: Name of the employee
            recipient_email: Email address to send to
            relieving_letter_file: Relieving letter PDF file object
            experience_letter_file: Experience letter PDF file object
            relieving_date: Date of relieving (optional, defaults to today)

        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            # Send relieving letter
            relieving_success, relieving_message = self.send_relieving_letter(
                employee_name=employee_name,
                recipient_email=recipient_email,
                relieving_letter_file=relieving_letter_file,
                relieving_date=relieving_date
            )

            # Send experience letter
            experience_success, experience_message = self.send_experience_letter(
                employee_name=employee_name,
                recipient_email=recipient_email,
                experience_letter_file=experience_letter_file,
                relieving_date=relieving_date
            )

            # Return combined result
            if relieving_success and experience_success:
                return True, "Both relieving letter and experience letter sent successfully"
            elif relieving_success and not experience_success:
                return False, f"Relieving letter sent successfully, but experience letter failed: {experience_message}"
            elif not relieving_success and experience_success:
                return False, f"Experience letter sent successfully, but relieving letter failed: {relieving_message}"
            else:
                return False, f"Both emails failed. Relieving: {relieving_message}, Experience: {experience_message}"

        except Exception as e:
            error_msg = f"Failed to send letters: {str(e)}"
            logging.getLogger('employees').error(error_msg)
            return False, error_msg
    
    def send_bulk_welcome_emails(self, employees):
        """
        Send welcome emails to multiple employees.

        Args:
            employees: List of Employee instances

        Returns:
            dict: Results with success/failure counts and details
        """
        results = {
            'total': len(employees),
            'sent': 0,
            'failed': 0,
            'details': []
        }

        for employee in employees:
            success, message = self.send_welcome_email(employee)

            result_detail = {
                'employee_id': employee.employee_id,
                'employee_name': employee.name,
                'email': employee.email,
                'success': success,
                'message': message
            }

            results['details'].append(result_detail)

            if success:
                results['sent'] += 1
            else:
                results['failed'] += 1

        return results

    def send_relieving_letter(self, employee_name, recipient_email, relieving_letter_file, relieving_date=None):
        """
        Send relieving letter email with PDF attachment.

        Args:
            employee_name: Name of the employee
            recipient_email: Email address to send to
            relieving_letter_file: PDF file object
            relieving_date: Date of relieving (optional, defaults to today)

        Returns:
            tuple: (success: bool, message: str)
        """
        if not recipient_email:
            return False, "No recipient email address provided"

        if not relieving_letter_file:
            return False, "No relieving letter file provided"

        # Create email log entry
        email_log = EmailLog.objects.create(
            email_type='RELIEVING',
            recipient_email=recipient_email,
            subject=f"Relieving Letter - {self.company_name}",
            status='PENDING'
        )

        try:
            # Set default relieving date if not provided
            if not relieving_date:
                from datetime import date
                relieving_date = date.today().strftime("%dth %B %Y")

            # Prepare email context
            context = {
                'employee_name': employee_name,
                'company_name': self.company_name,
                'company_address': self.company_address,
                'relieving_date': relieving_date,
                'hr_email': 'hrmanager@blackroth.in',
                'hr_name': 'C Ram Babu',
                'hr_title': 'HR Manager'
            }

            # Render email templates
            html_content = render_to_string('emails/relieving_letter.html', context)
            text_content = render_to_string('emails/relieving_letter.txt', context)

            # Create email
            subject = f"Relieving Letter - {self.company_name}"
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=self.from_email,
                to=[recipient_email]
            )
            email.attach_alternative(html_content, "text/html")

            # Attach the PDF file
            relieving_letter_file.seek(0)  # Reset file pointer
            email.attach(
                filename=f"Relieving_Letter_{employee_name.replace(' ', '_')}.pdf",
                content=relieving_letter_file.read(),
                mimetype='application/pdf'
            )

            # Send email
            email.send()

            # Update email log
            email_log.status = 'SENT'
            email_log.message = f"Relieving letter sent successfully to {recipient_email}"
            email_log.save()

            logging.getLogger('employees').info(
                f"Relieving letter sent successfully to {recipient_email} for employee {employee_name}"
            )
            return True, "Relieving letter sent successfully"

        except Exception as e:
            error_msg = f"Failed to send relieving letter to {recipient_email}: {str(e)}"

            # Update email log with error
            email_log.status = 'FAILED'
            email_log.error_message = error_msg
            email_log.save()

            logging.getLogger('employees').error(error_msg)
            return False, error_msg
