from django.db import models


class Department(models.Model):
    """
    Department model for organizing employees.
    """
    department_code = models.CharField(max_length=10, unique=True)
    department_name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'departments'
        verbose_name = 'Department'
        verbose_name_plural = 'Departments'
        ordering = ['department_name']

    def __str__(self):
        return self.department_name

    @property
    def employee_count(self):
        return self.employees.filter(is_active=True).count()