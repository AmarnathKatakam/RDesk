#!/usr/bin/env bash
set -e

python manage.py migrate --noinput
python manage.py create_admin_from_env

exec gunicorn rothdesk_payslip.wsgi
