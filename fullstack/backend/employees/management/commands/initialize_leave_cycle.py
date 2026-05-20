from datetime import datetime

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from employees.leave_services import process_leave_cycle_initialization


class Command(BaseCommand):
    help = "Initialize leave balances for the active financial-year leave cycle."

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

        result = process_leave_cycle_initialization(target_date)
        self.stdout.write(
            self.style.SUCCESS(
                f"Leave-cycle initialization complete for {result['leave_year_label']}: "
                f"processed_employees={result['processed_employees']}"
            )
        )
