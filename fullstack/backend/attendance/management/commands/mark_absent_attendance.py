from datetime import datetime

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from attendance.services import mark_absent_for_date


class Command(BaseCommand):
    help = "Mark employees absent for a given date when no punch-in exists and no approved leave is present."

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

        result = mark_absent_for_date(target_date=target_date)
        self.stdout.write(
            self.style.SUCCESS(
                f"Absent automation complete for {target_date}: "
                f"created={result['created']}, updated={result['updated']}"
            )
        )
