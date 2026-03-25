# Django IndentationError Fix - Progress Tracker

## Approved Plan Summary
- **Issue**: IndentationError in `employees/views.py` ~line 954 (`get_salary_calculation_preview`).
- **Fix**: Restructure nested if/else blocks for valid Python syntax and clean LPA vs net_pay logic.
- **Files**: Only `RothDesk-v1/fullstack/backend/employees/views.py`.
- **Validation**: `python manage.py check` && API test.

## Steps (0/5 Complete)

### ☐ 1. Create this TODO.md [COMPLETED]
Record progress tracking.

### ☐ 2. Edit employees/views.py
- Restructure `get_salary_calculation_preview` function.
- Fix indentation and merge duplicate LPA calculation code.
- Ensure all preview_data fields preserved.

### ☐ 3. Validate syntax
```
cd RothDesk-v1/fullstack/backend
python manage.py check
```
Expected: System check identified no issues.

### ☐ 4. Test API endpoint
```
curl "http://127.0.0.1:8000/api/employees/salary-preview/?employee_ids=1&month=1&year=2024"
```
Expected: Valid JSON response with preview_data.

### ☐ 5. Test server start & attempt_completion [FINAL]
```
python manage.py runserver
```
Expected: No import errors. Task complete.

**Next Action**: Proceed to Step 2 after tool confirmation.

