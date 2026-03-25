from rest_framework import serializers
from .models import Department


class DepartmentSerializer(serializers.ModelSerializer):
    """
    Serializer for Department model.
    """
    employee_count = serializers.ReadOnlyField()
    
    class Meta:
        model = Department
        fields = [
            'id',
            'department_code',
            'department_name',
            'description',
            'is_active',
            'employee_count',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_department_code(self, value):
        """
        Validate department code uniqueness.
        """
        if self.instance:
            # For updates, exclude current instance
            if Department.objects.filter(department_code=value).exclude(id=self.instance.id).exists():
                raise serializers.ValidationError("Department code already exists.")
        else:
            # For creates, check if code exists
            if Department.objects.filter(department_code=value).exists():
                raise serializers.ValidationError("Department code already exists.")
        
        return value.upper()
    
    def validate_department_name(self, value):
        """
        Validate department name.
        """
        return value.title()
