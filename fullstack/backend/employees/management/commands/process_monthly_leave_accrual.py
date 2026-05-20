from datetime import datetime

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from employees.leave_services import process_monthly_earned_leave_accrual


class Command(BaseCommand):
    help = "Process monthly earned leave accrual for the active leave cycle."

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            type=str,
            default=None,
            help="Target date in YYYY-MM-DD format. Defaults to today.",
        )

    def handle(self, *args, **options):
        date_raw = options.get("date")
        if date_raw:
            try:
                target_date = datetime.strptime(date_raw, "%Y-%m-%d").date()
            except ValueError as exc:
                raise CommandError("Invalid date format. Use YYYY-MM-DD.") from exc
        else:
            target_date = timezone.localdate()

        result = process_monthly_earned_leave_accrual(target_date)
        self.stdout.write(
            self.style.SUCCESS(
                f"Monthly leave accrual processed for {result['processed_month']}: "
                f"employees={result['processed_employees']}, "
                f"updated_balances={result['updated_balances']}"
            )
        )
