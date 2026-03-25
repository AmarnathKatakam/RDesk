from decimal import Decimal

from django.db.models import Q
from django.utils import timezone

from attendance.models import AttendancePolicy, EmployeeShiftAssignment, OfficeLocation, Shift
from employees.models import Employee


HYD_NAME = "Hyderabad Office - Dallas Centre Rd, Madhapur"
HYD_LAT = Decimal("17.4526")
HYD_LON = Decimal("78.3783")
POLICY_NAME = "Hyderabad Full Day Policy"


def run():
    location_defaults = {
        "latitude": HYD_LAT,
        "longitude": HYD_LON,
        "allowed_radius_meters": 250,
        "is_active": True,
        "is_default": True,
    }
    location, location_created = OfficeLocation.objects.get_or_create(
        name=HYD_NAME,
        defaults=location_defaults,
    )

    location_updates = []
    if location.latitude != HYD_LAT:
        location.latitude = HYD_LAT
        location_updates.append("latitude")
    if location.longitude != HYD_LON:
        location.longitude = HYD_LON
        location_updates.append("longitude")
    if location.allowed_radius_meters != 250:
        location.allowed_radius_meters = 250
        location_updates.append("allowed_radius_meters")
    if not location.is_active:
        location.is_active = True
        location_updates.append("is_active")
    if not location.is_default:
        location.is_default = True
        location_updates.append("is_default")
    if location_updates:
        location.save(update_fields=location_updates + ["updated_at"])

    OfficeLocation.objects.filter(is_default=True).exclude(id=location.id).update(is_default=False)

    general_shift = Shift.objects.filter(name__iexact="General", is_active=True).first() or Shift.objects.filter(
        is_active=True
    ).order_by("id").first()
    if not general_shift:
        raise RuntimeError("No active shifts found. Please create shifts first.")

    policy_defaults = {
        "default_shift": general_shift,
        "default_office_location": location,
        "enforce_gps": True,
        "allow_remote_punch": False,
        "auto_mark_absent": True,
        "min_half_day_hours": Decimal("4.00"),
        "full_day_hours": Decimal("8.00"),
        "week_off_days": [5, 6],
        "is_active": True,
    }
    policy, policy_created = AttendancePolicy.objects.get_or_create(
        name=POLICY_NAME,
        defaults=policy_defaults,
    )

    policy_updates = []
    if policy.default_shift_id != general_shift.id:
        policy.default_shift = general_shift
        policy_updates.append("default_shift")
    if policy.default_office_location_id != location.id:
        policy.default_office_location = location
        policy_updates.append("default_office_location")
    if not policy.is_active:
        policy.is_active = True
        policy_updates.append("is_active")
    if not policy.enforce_gps:
        policy.enforce_gps = True
        policy_updates.append("enforce_gps")
    if policy.allow_remote_punch:
        policy.allow_remote_punch = False
        policy_updates.append("allow_remote_punch")
    if policy.min_half_day_hours != Decimal("4.00"):
        policy.min_half_day_hours = Decimal("4.00")
        policy_updates.append("min_half_day_hours")
    if policy.full_day_hours != Decimal("8.00"):
        policy.full_day_hours = Decimal("8.00")
        policy_updates.append("full_day_hours")
    if policy.week_off_days != [5, 6]:
        policy.week_off_days = [5, 6]
        policy_updates.append("week_off_days")
    if policy_updates:
        policy.save(update_fields=policy_updates + ["updated_at"])

    today = timezone.localdate()
    created_assignments = 0
    updated_assignments = 0
    updated_employees = 0

    for employee in Employee.objects.filter(is_active=True).order_by("id"):
        active_assignment = (
            EmployeeShiftAssignment.objects.filter(employee=employee, is_active=True, effective_from__lte=today)
            .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=today))
            .order_by("-effective_from", "-id")
            .first()
        )

        if active_assignment:
            changed = []
            if not active_assignment.shift_id or not active_assignment.shift.is_active:
                active_assignment.shift = general_shift
                changed.append("shift")
            if active_assignment.office_location_id != location.id:
                active_assignment.office_location = location
                changed.append("office_location")
            if active_assignment.policy_id != policy.id:
                active_assignment.policy = policy
                changed.append("policy")
            if not active_assignment.is_active:
                active_assignment.is_active = True
                changed.append("is_active")
            if changed:
                active_assignment.save(update_fields=changed + ["updated_at"])
                updated_assignments += 1
            assignment_shift = active_assignment.shift
        else:
            shift_to_assign = employee.shift if employee.shift and employee.shift.is_active else general_shift
            new_assignment = EmployeeShiftAssignment(
                employee=employee,
                shift=shift_to_assign,
                office_location=location,
                policy=policy,
                effective_from=today,
                is_active=True,
            )
            new_assignment.full_clean()
            new_assignment.save()
            created_assignments += 1
            assignment_shift = shift_to_assign

        if employee.shift_id != assignment_shift.id:
            employee.shift = assignment_shift
            employee.save(update_fields=["shift", "updated_at"])
            updated_employees += 1

    return {
        "location": {"id": location.id, "name": location.name, "created": location_created},
        "policy": {"id": policy.id, "name": policy.name, "created": policy_created},
        "assignments_created": created_assignments,
        "assignments_updated": updated_assignments,
        "employees_shift_updated": updated_employees,
    }

