# Migration kept for compatibility.
# Some environments already had `lpa` from 0001_initial, while others did not.
# This makes the migration idempotent and safe in both cases.

from django.db import migrations


def add_lpa_if_missing(apps, schema_editor):
    Employee = apps.get_model("employees", "Employee")
    table_name = Employee._meta.db_table

    with schema_editor.connection.cursor() as cursor:
        existing_columns = {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(
                cursor, table_name
            )
        }

    if "lpa" in existing_columns:
        return

    lpa_field = Employee._meta.get_field("lpa")
    schema_editor.add_field(Employee, lpa_field)


class Migration(migrations.Migration):
    dependencies = [
        ("employees", "0014_alter_emaillog_email_type_alter_employee_email_and_more"),
    ]

    operations = [
        migrations.RunPython(add_lpa_if_missing, migrations.RunPython.noop),
    ]
