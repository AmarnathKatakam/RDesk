from rest_framework import serializers
from .models import SalaryComponent, SalaryTemplate, SalaryTemplateComponent, EmployeeSalaryAssignment


class SalaryComponentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalaryComponent
        fields = '__all__'
        read_only_fields = ('id',)

    def validate(self, data):
        if data.get('calculation_type') == 'FORMULA' and not data.get('formula', '').strip():
            raise serializers.ValidationError({'formula': 'Formula is required when calculation_type is FORMULA.'})
        return data


class SalaryTemplateComponentSerializer(serializers.ModelSerializer):
    component_code = serializers.CharField(source='component.code', read_only=True)
    component_name = serializers.CharField(source='component.name', read_only=True)
    component_type = serializers.CharField(source='component.component_type', read_only=True)
    is_statutory = serializers.BooleanField(source='component.is_statutory', read_only=True)
    effective_calculation_type = serializers.CharField(read_only=True)
    effective_value = serializers.DecimalField(max_digits=10, decimal_places=4, read_only=True)

    class Meta:
        model = SalaryTemplateComponent
        fields = (
            'id', 'template', 'component', 'component_code', 'component_name', 'component_type',
            'is_statutory',
            'calculation_type_override', 'value', 'formula_override', 'display_order',
            'effective_calculation_type', 'effective_value',
        )
        read_only_fields = ('id',)


class SalaryTemplateSerializer(serializers.ModelSerializer):
    components = SalaryTemplateComponentSerializer(many=True, read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = SalaryTemplate
        fields = (
            'id', 'code', 'name', 'description', 'is_active',
            'created_by', 'created_by_username', 'created_at', 'updated_at',
            'components',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')


class SalaryTemplateWriteSerializer(serializers.ModelSerializer):
    """Write serializer — excludes nested components (managed via separate endpoint)."""
    class Meta:
        model = SalaryTemplate
        fields = ('id', 'code', 'name', 'description', 'is_active')
        read_only_fields = ('id',)


class EmployeeSalaryAssignmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    template_code = serializers.CharField(source='template.code', read_only=True)
    template_name = serializers.CharField(source='template.name', read_only=True)
    monthly_ctc = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = EmployeeSalaryAssignment
        fields = (
            'id', 'employee', 'employee_name', 'employee_id_code',
            'template', 'template_code', 'template_name',
            'annual_ctc', 'monthly_ctc',
            'effective_from', 'effective_to', 'is_active',
            'notes', 'created_by', 'created_by_username', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'is_active')

    def validate(self, data):
        effective_from = data.get('effective_from')
        effective_to = data.get('effective_to')
        if effective_to and effective_from and effective_to < effective_from:
            raise serializers.ValidationError({'effective_to': 'effective_to must be after effective_from.'})
        return data


# ─── Milestone 3B: Statutory Config Serializers ───────────────────────────────

from .models import StatutoryConfig, ProfessionalTaxSlab


class ProfessionalTaxSlabSerializer(serializers.ModelSerializer):
    state = serializers.CharField(source='statutory_config.state', read_only=True)
    financial_year = serializers.CharField(source='statutory_config.financial_year', read_only=True)

    class Meta:
        model = ProfessionalTaxSlab
        fields = (
            'id', 'statutory_config', 'state', 'financial_year',
            'min_monthly_wage', 'max_monthly_wage', 'pt_amount',
            'applicable_months', 'gender', 'is_active', 'display_order',
        )
        read_only_fields = ('id',)

    def validate(self, data):
        max_w = data.get('max_monthly_wage')
        min_w = data.get('min_monthly_wage', 0)
        if max_w is not None and max_w < min_w:
            raise serializers.ValidationError({'max_monthly_wage': 'max_monthly_wage must be >= min_monthly_wage.'})
        return data


class StatutoryConfigSerializer(serializers.ModelSerializer):
    pt_slabs = ProfessionalTaxSlabSerializer(many=True, read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    pf_employee_rate_pct = serializers.CharField(read_only=True)
    esi_employee_rate_pct = serializers.CharField(read_only=True)

    class Meta:
        model = StatutoryConfig
        fields = (
            'id', 'financial_year', 'state', 'is_active',
            'pf_enabled', 'pf_employee_rate', 'pf_employer_rate',
            'pf_wage_ceiling', 'pf_rounding', 'pf_include_employer_in_ctc',
            'pf_employee_rate_pct',
            'esi_enabled', 'esi_employee_rate', 'esi_employer_rate', 'esi_wage_threshold',
            'esi_employee_rate_pct',
            'pt_enabled',
            'lwf_enabled', 'lwf_employee_amount', 'lwf_employer_amount', 'lwf_applicable_months',
            'tds_enabled',
            'effective_from', 'effective_to',
            'notes', 'created_by', 'created_by_username', 'created_at', 'updated_at',
            'pt_slabs',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate(self, data):
        eff_from = data.get('effective_from')
        eff_to = data.get('effective_to')
        if eff_to and eff_from and eff_to < eff_from:
            raise serializers.ValidationError({'effective_to': 'effective_to must be after effective_from.'})
        return data


class StatutoryConfigWriteSerializer(serializers.ModelSerializer):
    """Write serializer — PT slabs managed via separate endpoint."""
    class Meta:
        model = StatutoryConfig
        fields = (
            'id', 'financial_year', 'state', 'is_active',
            'pf_enabled', 'pf_employee_rate', 'pf_employer_rate',
            'pf_wage_ceiling', 'pf_rounding', 'pf_include_employer_in_ctc',
            'esi_enabled', 'esi_employee_rate', 'esi_employer_rate', 'esi_wage_threshold',
            'pt_enabled',
            'lwf_enabled', 'lwf_employee_amount', 'lwf_employer_amount', 'lwf_applicable_months',
            'tds_enabled',
            'effective_from', 'effective_to', 'notes',
        )
        read_only_fields = ('id',)
