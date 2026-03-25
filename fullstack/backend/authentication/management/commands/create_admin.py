from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Create an admin user for the payslip system'

    def add_arguments(self, parser):
        parser.add_argument('--username', type=str, help='Admin username')
        parser.add_argument('--email', type=str, help='Admin email')
        parser.add_argument('--password', type=str, help='Admin password')
        parser.add_argument('--full-name', type=str, help='Admin full name')

    def handle(self, *args, **options):
        username = options.get('username') or 'admin'
        email = options.get('email') or 'admin@blackroth.com'
        password = options.get('password') or 'admin123'
        full_name = options.get('full_name') or 'System Administrator'

        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.WARNING(f'User with username "{username}" already exists.')
            )
            return

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            full_name=full_name,
            is_staff=True,
            is_superuser=True
        )

        self.stdout.write(
            self.style.SUCCESS(f'Successfully created admin user "{username}"')
        )
        self.stdout.write(f'Username: {username}')
        self.stdout.write(f'Email: {email}')
        self.stdout.write(f'Full Name: {full_name}')
        self.stdout.write(f'Password: {password}')
