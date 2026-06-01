import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Create an admin user from environment variables."

    def handle(self, *args, **options):
        username = os.environ.get("DJANGO_ADMIN_USERNAME", "").strip()
        email = os.environ.get("DJANGO_ADMIN_EMAIL", "").strip()
        password = os.environ.get("DJANGO_ADMIN_PASSWORD", "")
        full_name = os.environ.get("DJANGO_ADMIN_FULL_NAME", "System Administrator").strip()

        missing = [
            name
            for name, value in {
                "DJANGO_ADMIN_USERNAME": username,
                "DJANGO_ADMIN_EMAIL": email,
                "DJANGO_ADMIN_PASSWORD": password,
            }.items()
            if not value
        ]
        if missing:
            raise CommandError(f"Missing required environment variables: {', '.join(missing)}")

        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "full_name": full_name,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )

        if created:
            user.set_password(password)
            user.save(update_fields=["password"])
            self.stdout.write(self.style.SUCCESS(f'Created admin user "{username}".'))
            return

        changed_fields = []
        if user.email != email:
            user.email = email
            changed_fields.append("email")
        if user.full_name != full_name:
            user.full_name = full_name
            changed_fields.append("full_name")
        if not user.is_staff:
            user.is_staff = True
            changed_fields.append("is_staff")
        if not user.is_superuser:
            user.is_superuser = True
            changed_fields.append("is_superuser")
        if not user.is_active:
            user.is_active = True
            changed_fields.append("is_active")

        if changed_fields:
            user.save(update_fields=changed_fields)

        self.stdout.write(self.style.WARNING(f'Admin user "{username}" already exists.'))
