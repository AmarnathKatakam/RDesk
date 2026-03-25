from django.contrib.auth.models import AbstractUser
from django.db import models


class AdminUser(AbstractUser):
    """
    Custom user model for admin users of the payslip system.
    """
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email', 'full_name']

    class Meta:
        db_table = 'admin_users'
        verbose_name = 'Admin User'
        verbose_name_plural = 'Admin Users'

    def __str__(self):
        return f"{self.full_name} ({self.username})"

    @property
    def is_admin(self):
        return True  # All users of this system are admins