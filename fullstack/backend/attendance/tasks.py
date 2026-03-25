from celery import shared_task
from django.utils import timezone

from .services import ensure_leave_attendance_records, mark_absent_for_date


@shared_task
def mark_daily_absent_task():
    """
    Scheduled daily automation:
    1. Mark employees absent if they did not punch in and do not have approved leave.
    2. Ensure attendance records exist for employees on approved leave.
    """
    target_date = timezone.localdate()
    
    # First, ensure leave records are created
    leave_result = ensure_leave_attendance_records(target_date=target_date)
    
    # Then mark absent for those without any attendance
    absent_result = mark_absent_for_date(target_date=target_date)
    
    return {
        "leave_records_created": leave_result["created"],
        "absent_records_created": absent_result["created"],
        "absent_records_updated": absent_result["updated"],
        "processed_date": absent_result["processed_date"],
    }
