from rest_framework import serializers
from .models import (
    BankMaster, BankBranchMaster,
    EmployeeBankDetail, EmployeeESIDetail,
    EmployeePFDetail, EmployeeLWFDetail,
)


class BankMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankMaster
        fields = ['id', 'name', 'code', 'is_active', 'created_at', 'updated_at']


class BankBranchMasterSerializer(serializers.ModelSerializer):
    bank_name = serializers.CharField(source='bank.name', read_only=True)

    class Meta:
        model = BankBranchMaster
        fields = ['id', 'bank', 'bank_name', 'branch_name', 'ifsc_code', 'city', 'state', 'address', 'is_active']


class EmployeeBankDetailSerializer(serializers.ModelSerializer):
    bank_name   = serializers.CharField(source='bank.name',        read_only=True)
    branch_name = serializers.CharField(source='branch.branch_name', read_only=True)

    class Meta:
        model = EmployeeBankDetail
        fields = [
            'id', 'employee',
            'bank', 'bank_name',
            'branch', 'branch_name',
            'bank_account_no', 'ifsc_code', 'iban',
            'account_type', 'payment_type',
            'dd_payable_at', 'name_as_per_bank',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EmployeeESIDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeESIDetail
        fields = ['id', 'employee', 'is_covered', 'esi_number', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class EmployeePFDetailSerializer(serializers.ModelSerializer):
    verification_document_name = serializers.CharField(
        source='verification_document.document_name', read_only=True
    )

    class Meta:
        model = EmployeePFDetail
        fields = [
            'id', 'employee',
            'is_covered', 'uan', 'pf_number', 'pf_join_date', 'family_pf_no',
            'is_existing_eps_member', 'allow_epf_excess', 'allow_eps_excess',
            'verification_document', 'verification_document_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EmployeeLWFDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeLWFDetail
        fields = ['id', 'employee', 'is_covered', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


from datetime import date as _date
from .models import EmployeeFamilyMember


class EmployeeFamilyMemberSerializer(serializers.ModelSerializer):
    age                  = serializers.SerializerMethodField()
    relation_display     = serializers.CharField(source='get_relation_display',    read_only=True)
    gender_display       = serializers.CharField(source='get_gender_display',      read_only=True)
    blood_group_display  = serializers.CharField(source='get_blood_group_display', read_only=True)

    def get_age(self, obj):
        if not obj.dob:
            return None
        today = _date.today()
        return today.year - obj.dob.year - ((today.month, today.day) < (obj.dob.month, obj.dob.day))

    class Meta:
        model  = EmployeeFamilyMember
        fields = [
            'id', 'employee',
            'name', 'relation', 'relation_display',
            'dob', 'age',
            'gender', 'gender_display',
            'blood_group', 'blood_group_display',
            'nationality', 'profession', 'remarks',
            'address_same_as_employee', 'copy_address_from',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
