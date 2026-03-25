from django.core.management.base import BaseCommand
from django.db import transaction

from employees.models import Employee, SalaryStructure, MonthlySalaryData, ActualSalaryCredited


class Command(BaseCommand):
    help = "Delete all employees and related salary data (use with caution)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--yes', action='store_true', help='Confirm deletion without prompt'
        )

    def handle(self, *args, **options):
        confirm = options.get('yes')
        if not confirm:
            self.stdout.write(self.style.WARNING(
                'This will delete ALL employees, salary structures, monthly salary data, and actual salary credited records.'
            ))
            self.stdout.write(self.style.WARNING('Run with --yes to confirm.'))
            return

        with transaction.atomic():
            deleted_actual, _ = ActualSalaryCredited.objects.all().delete()
            deleted_monthly, _ = MonthlySalaryData.objects.all().delete()
            deleted_structures, _ = SalaryStructure.objects.all().delete()
            deleted_employees, _ = Employee.objects.all().delete()

        self.stdout.write(self.style.SUCCESS(
            f"Deleted: ActualSalaryCredited={deleted_actual}, MonthlySalaryData={deleted_monthly}, "
            f"SalaryStructure={deleted_structures}, Employee={deleted_employees}"
        ))

