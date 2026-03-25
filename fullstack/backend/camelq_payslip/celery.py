import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'camelq_payslip.settings')

app = Celery('camelq_payslip')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

app.conf.beat_schedule = {
    "attendance-mark-absent-daily-2359": {
        "task": "attendance.tasks.mark_daily_absent_task",
        "schedule": crontab(hour=23, minute=59),
    },
}


@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
