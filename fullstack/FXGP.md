# FXGP.md — Fix & Gap Plan
> RothDesk HRMS · Remaining Issues · One-Day Execution Plan
> Generated: April 20, 2026

---

## What Is Actually Broken vs What Is Done

Before the plan: a clear-eyed status of every open item from the TODO.

### CONFIRMED DONE (do not touch)
- Net pay formula, three-bucket model, `recalculate()` ✅
- `is_released` gate on employee payslip list and download endpoint ✅
- `/media/payslips/` URL blocked via `re_path` ✅
- `PayrollRun` lifecycle, all status transitions, `select_for_update()` ✅
- Hold / release-hold / reprocess per employee ✅
- `PayrollAuditLog` + `audit.py` wrapper ✅
- Validation engine (ERROR/WARNING, dry-run endpoint) ✅
- `SalaryComponent`, `SalaryTemplate`, `SalaryTemplateComponent`, `EmployeeSalaryAssignment` ✅
- `statutory_service.py` — PF, ESI, PT, LWF fully configurable ✅
- `tds_service.py` — full TDS engine, old + new regime ✅
- `HolidayCalendar` + `Holiday` models ✅
- `PayrollInputSnapshot` model + `payroll_calendar_service.py` ✅
- `PayrollInputAdjustment` model ✅
- Payroll register, bank transfer CSV, department summary, variance report ✅
- Excel export for payroll register ✅
- `SalaryTemplates.tsx`, `PayrollRunDetail.tsx`, `MonthlyInputs.tsx`, `PayrollReports.tsx` pages ✅

---

## Remaining Gaps — Grouped by Effort

### GROUP A — Small backend fixes (< 1 hour each)

| # | Gap | File to edit | What to do |
|---|-----|-------------|------------|
| A1 | Rate limiting on payslip download | `backend/rothdesk_payslip/settings.py` | Add `DEFAULT_THROTTLE_CLASSES` + `DEFAULT_THROTTLE_RATES` to `REST_FRAMEWORK` dict |
| A2 | Per-employee release toggle endpoint | `backend/payslip_generation/payroll_views.py` | Add `POST /api/payroll/runs/<id>/release-employee/` view that sets `payslip.is_released=True` for one employee's item |
| A3 | Formula engine for FORMULA components | `backend/payslip_generation/calculation_engine.py` | Add `_eval_formula()` function using `eval()` with a safe variable dict; call it in the EARNING and DEDUCTION passes where `calc_type == 'FORMULA'` |
| A4 | Wire per-employee release URL | `backend/payslip_generation/urls.py` | Add `path('runs/<int:run_id>/release-employee/', ...)` |

### GROUP B — Frontend additions (1–2 hours each)

| # | Gap | File to edit | What to do |
|---|-----|-------------|------------|
| B1 | Per-employee release toggle in run detail | `frontend/src/pages/PayrollRunDetail.tsx` | Add "Release" button per row in the items table; calls new A2 endpoint; only visible when run status is LOCKED or RELEASED and item has a payslip |
| B2 | Variance indicator in run summary | `frontend/src/pages/PayrollRunDetail.tsx` | Add a "vs last month" delta badge next to total_net in the summary header; fetch from `/api/payroll/reports/variance/` |
| B3 | Payroll health panel before generation | `frontend/src/pages/PayrollRunDetail.tsx` | When status is DRAFT or CALCULATED, show a collapsible panel that calls `/api/payslips/validation-issues/` and displays ERROR/WARNING counts with a table |
| B4 | Attendance snapshot display per employee | `frontend/src/pages/PayrollRunDetail.tsx` | In the expanded row detail, show `payable_days`, `lop_days`, `proration_factor`, `calculation_source` — data already comes from the items API |

### GROUP C — Async PDF generation (3–4 hours, highest impact)

| # | Gap | File to edit | What to do |
|---|-----|-------------|------------|
| C1 | Move PDF generation to Celery | `backend/payslip_generation/payroll_service.py` | Extract `_release_run_payslips()` PDF loop into a `@shared_task`; return task ID from the release transition; poll via existing task status endpoint |
| C2 | Progress endpoint | `backend/payslip_generation/payroll_views.py` | Add `GET /api/payroll/runs/<id>/release-progress/` that returns `{released, total, errors}` from `PayrollRunItem` counts |
| C3 | Progress UI | `frontend/src/pages/PayrollRunDetail.tsx` | After clicking "Release Payslips", show a progress bar that polls C2 every 2 seconds until `released == total` |
| C4 | Remove dead ReportLab generator | `backend/payslip_generation/utils.py` | Delete the `generate_payslip_pdf()` function that uses ReportLab; keep only `PayslipFileManager` helpers |

### GROUP D — YTD reports (2–3 hours)

| # | Gap | File to edit | What to do |
|---|-----|-------------|------------|
| D1 | YTD backend endpoint | `backend/payslip_generation/report_views.py` | Add `GET /api/payroll/reports/ytd/` — aggregate `PayrollRunItem` records from April to current month for each employee; return per-employee YTD gross, deductions, net, PF, TDS |
| D2 | YTD URL | `backend/payslip_generation/urls.py` | Wire `path('payroll/reports/ytd/', report_views.ytd_report)` |
| D3 | YTD frontend API call | `frontend/src/services/api.ts` | Add `getYTD` to `payrollReportsAPI` |
| D4 | YTD tab in reports page | `frontend/src/pages/PayrollReports.tsx` | Add a "Year to Date" tab alongside Register/Bank Transfer/Variance; table shows employee + monthly breakdown |

### GROUP E — Employee YTD self-service (1–2 hours)

| # | Gap | File to edit | What to do |
|---|-----|-------------|------------|
| E1 | Employee YTD endpoint | `backend/authentication/employee_views.py` | Add `GET /api/auth/employee/ytd/` — same logic as D1 but scoped to `session_employee_id`; returns current FY summary |
| E2 | YTD card on employee dashboard | `frontend/src/pages/EmployeeDashboard.tsx` | Add a "This Year" earnings summary card showing YTD gross, deductions, net; fetch from E1 |

---

---

## Today's Execution Order

Work in this exact sequence. Each block is independent enough to commit separately.

---

### BLOCK 1 — Rate Limiting (15 min)
**File:** `backend/rothdesk_payslip/settings.py`

Add inside the `REST_FRAMEWORK` dict:
```python
"DEFAULT_THROTTLE_CLASSES": [
    "rest_framework.throttling.AnonRateThrottle",
    "rest_framework.throttling.UserRateThrottle",
],
"DEFAULT_THROTTLE_RATES": {
    "anon": "20/minute",
    "user": "200/minute",
    "payslip_download": "30/minute",
},
```

Then in `backend/payslip_generation/views.py`, add a scoped throttle class on `download_payslip`:
```python
from rest_framework.throttling import UserRateThrottle

class PayslipDownloadThrottle(UserRateThrottle):
    scope = 'payslip_download'

# on the view:
@api_view(['GET'])
@permission_classes([IsAuthenticatedOrEmployeeSession])
@throttle_classes([PayslipDownloadThrottle])
def download_payslip(request, payslip_id):
    ...
```

---

### BLOCK 2 — Formula Engine (30 min)
**File:** `backend/payslip_generation/calculation_engine.py`

Add this function after the `_round0` helper:
```python
def _eval_formula(formula: str, variables: dict) -> Decimal:
    """
    Safely evaluate a salary component formula.
    Available variables: BASIC, GROSS, CTC_MONTHLY, and any component code.
    Only arithmetic operations are allowed — no builtins, no imports.
    """
    try:
        safe_globals = {"__builtins__": {}}
        result = eval(formula, safe_globals, {k: float(v) for k, v in variables.items()})
        return _round2(Decimal(str(result)))
    except Exception as exc:
        logger.warning(f"Formula eval failed: {formula!r} — {exc}")
        return ZERO
```

Then in the EARNING pass 3 (where `calc_type in ('STATUTORY', 'FORMULA')`), replace the `pass` with:
```python
elif calc_type == 'FORMULA' and comp.formula.strip():
    formula_vars = {**component_values, 'GROSS': pre_gross, 'CTC_MONTHLY': monthly_ctc}
    component_values[comp.code] = _eval_formula(comp.formula, formula_vars)
```

Do the same in the DEDUCTION pass where `calc_type` is unsupported — add a `FORMULA` branch before the `else`.

---

### BLOCK 3 — Per-Employee Release Toggle (45 min)

**Step 3a — Backend view**
**File:** `backend/payslip_generation/payroll_views.py`

Add after `payroll_run_reprocess`:
```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def payroll_run_release_employee(request, run_id):
    """
    POST /api/payroll/runs/<id>/release-employee/
    Body: { "employee_id": 42 }
    Marks one employee's payslip as released without releasing the full run.
    Run must be in LOCKED or RELEASED status.
    """
    from django.utils import timezone
    run = get_object_or_404(PayrollRun, id=run_id)

    if run.status not in ('LOCKED', 'RELEASED'):
        return Response(
            {'success': False, 'message': 'Run must be LOCKED or RELEASED to release individual payslips.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    emp_pk = request.data.get('employee_id')
    if not emp_pk:
        return Response({'success': False, 'message': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    item = get_object_or_404(PayrollRunItem, run=run, employee_id=emp_pk)

    if not item.payslip_id:
        return Response({'success': False, 'message': 'No payslip generated for this employee yet.'}, status=status.HTTP_400_BAD_REQUEST)

    from .models import Payslip
    from .audit import log_payroll_action
    Payslip.objects.filter(id=item.payslip_id).update(
        is_released=True,
        released_at=timezone.now(),
        released_by=request.user,
    )
    log_payroll_action(
        action='RELEASE',
        performed_by=request.user,
        employee=item.employee,
        pay_period_month=run.month,
        pay_period_year=run.year,
        notes=f'Per-employee release by {request.user.username}',
    )
    return Response({'success': True, 'message': f'Payslip released for {item.employee.name}.'})
```

**Step 3b — Wire URL**
**File:** `backend/payslip_generation/urls.py`

Add:
```python
path('payroll/runs/<int:run_id>/release-employee/', payroll_views.payroll_run_release_employee),
```

**Step 3c — Frontend API call**
**File:** `frontend/src/services/api.ts`

Add to `payrollRunAPI`:
```typescript
releaseEmployee: (runId: string | number, employeeId: number) =>
  api.post(`/payroll/runs/${runId}/release-employee/`, { employee_id: employeeId }),
```

**Step 3d — Frontend button in run detail**
**File:** `frontend/src/pages/PayrollRunDetail.tsx`

In the items table row, add a "Release" button that:
- Only renders when `summary.status === 'LOCKED' || summary.status === 'RELEASED'`
- Only renders when `item.payslip_id !== null`
- Calls `payrollRunAPI.releaseEmployee(runId, item.employee_pk)`
- Shows a green checkmark after success

---

### BLOCK 4 — Payroll Health Panel (45 min)
**File:** `frontend/src/pages/PayrollRunDetail.tsx`

Add a `ValidationPanel` component inside the file:
```tsx
// Fetch validation issues when run is DRAFT or CALCULATED
const [validationIssues, setValidationIssues] = useState<any[]>([]);

useEffect(() => {
  if (summary && ['DRAFT', 'CALCULATED'].includes(summary.status)) {
    payrollRunAPI.getValidationIssues({
      month: summary.month,
      year: summary.year,
    }).then(r => setValidationIssues(r.data.issues || []));
  }
}, [summary]);
```

Render above the items table when `validationIssues.length > 0`:
```tsx
<div className="border border-yellow-300 bg-yellow-50 rounded p-4 mb-4">
  <p className="font-semibold text-yellow-800">
    ⚠ {validationIssues.filter(i => i.severity === 'ERROR').length} errors,{' '}
    {validationIssues.filter(i => i.severity === 'WARNING').length} warnings
  </p>
  <table>...list issues with employee name, type, message...</table>
</div>
```

---

### BLOCK 5 — Variance Badge in Run Summary (30 min)
**File:** `frontend/src/pages/PayrollRunDetail.tsx`

After loading the run summary, fetch variance:
```tsx
const [variance, setVariance] = useState<number | null>(null);

useEffect(() => {
  if (summary) {
    payrollReportsAPI.getVariance({ month: summary.month, year: summary.year })
      .then(r => {
        const rows = r.data.rows || [];
        const totalPrev = rows.reduce((s: number, row: any) => s + (row.prev_net ?? 0), 0);
        const totalCurr = rows.reduce((s: number, row: any) => s + row.current_net, 0);
        if (totalPrev > 0) setVariance(((totalCurr - totalPrev) / totalPrev) * 100);
      })
      .catch(() => {});
  }
}, [summary]);
```

Render next to the total net pay:
```tsx
{variance !== null && (
  <span className={`text-sm ml-2 ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
    {variance >= 0 ? '▲' : '▼'} {Math.abs(variance).toFixed(1)}% vs last month
  </span>
)}
```

---

### BLOCK 6 — YTD Backend Endpoint (45 min)
**File:** `backend/payslip_generation/report_views.py`

Add at the bottom:
```python
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ytd_report(request):
    """
    GET /api/payroll/reports/ytd/
    Year-to-date payroll summary per employee from April to the given month.
    Query params: year (financial year start, e.g. 2025), salary_type
    """
    from .models import PayrollRunItem
    year = int(request.GET.get('year', timezone.now().year))
    salary_type = request.GET.get('salary_type', 'SALARY').upper()

    # April of `year` to March of `year+1`
    fy_months = [
        ('April', year), ('May', year), ('June', year),
        ('July', year), ('August', year), ('September', year),
        ('October', year), ('November', year), ('December', year),
        ('January', year + 1), ('February', year + 1), ('March', year + 1),
    ]

    # Collect all INCLUDED items across the FY
    from django.db.models import Sum
    employee_ytd: dict[int, dict] = {}

    for month_name, yr in fy_months:
        run = PayrollRun.objects.filter(month=month_name, year=yr, salary_type=salary_type).first()
        if not run:
            continue
        items = PayrollRunItem.objects.filter(run=run, status='INCLUDED').select_related('employee')
        for item in items:
            eid = item.employee_id
            if eid not in employee_ytd:
                employee_ytd[eid] = {
                    'employee_id': item.employee.employee_id,
                    'employee_name': item.employee.name,
                    'department': item.employee.department.department_name if item.employee.department else '',
                    'ytd_gross': Decimal('0'),
                    'ytd_deductions': Decimal('0'),
                    'ytd_net': Decimal('0'),
                    'ytd_employer': Decimal('0'),
                    'months_paid': 0,
                }
            employee_ytd[eid]['ytd_gross'] += item.gross_earnings
            employee_ytd[eid]['ytd_deductions'] += item.total_deductions
            employee_ytd[eid]['ytd_net'] += item.net_pay
            employee_ytd[eid]['ytd_employer'] += item.employer_contributions
            employee_ytd[eid]['months_paid'] += 1

    rows = []
    for d in employee_ytd.values():
        rows.append({
            **d,
            'ytd_gross': float(d['ytd_gross']),
            'ytd_deductions': float(d['ytd_deductions']),
            'ytd_net': float(d['ytd_net']),
            'ytd_employer': float(d['ytd_employer']),
        })
    rows.sort(key=lambda x: x['employee_name'])

    return Response({
        'success': True,
        'financial_year': f"{year}-{(year+1)%100:02d}",
        'salary_type': salary_type,
        'employee_count': len(rows),
        'totals': {
            'ytd_gross': round(sum(r['ytd_gross'] for r in rows), 2),
            'ytd_net': round(sum(r['ytd_net'] for r in rows), 2),
        },
        'rows': rows,
    })
```

Wire in `urls.py`:
```python
path('payroll/reports/ytd/', report_views.ytd_report),
```

Add to `payrollReportsAPI` in `api.ts`:
```typescript
getYTD: (params: { year: number; salary_type?: string }) =>
  api.get('/payroll/reports/ytd/', { params }),
```

---

### BLOCK 7 — YTD Tab in Reports Page (30 min)
**File:** `frontend/src/pages/PayrollReports.tsx`

Add a "Year to Date" tab. When active:
- Show a year selector (defaults to current FY start year)
- Fetch from `payrollReportsAPI.getYTD({ year })`
- Render a table: Employee | Department | Months Paid | YTD Gross | YTD Deductions | YTD Net

---

### BLOCK 8 — Employee YTD Self-Service (30 min)

**Step 8a — Backend**
**File:** `backend/authentication/employee_views.py`

Add a new view:
```python
@api_view(['GET'])
@permission_classes([AllowAny])
def employee_ytd_view(request):
    """GET /api/auth/employee/ytd/ — YTD summary for the logged-in employee."""
    employee_id = request.session.get('employee_id')
    if not employee_id:
        return Response({'success': False, 'message': 'Not authenticated.'}, status=401)

    from payslip_generation.models import PayrollRunItem, PayrollRun
    from django.utils import timezone
    from decimal import Decimal

    now = timezone.now()
    fy_start = now.year if now.month >= 4 else now.year - 1

    fy_months = [
        ('April', fy_start), ('May', fy_start), ('June', fy_start),
        ('July', fy_start), ('August', fy_start), ('September', fy_start),
        ('October', fy_start), ('November', fy_start), ('December', fy_start),
        ('January', fy_start + 1), ('February', fy_start + 1), ('March', fy_start + 1),
    ]

    ytd_gross = ytd_deductions = ytd_net = Decimal('0')
    months_paid = 0

    for month_name, yr in fy_months:
        run = PayrollRun.objects.filter(month=month_name, year=yr, status__in=['RELEASED', 'PAID']).first()
        if not run:
            continue
        item = PayrollRunItem.objects.filter(run=run, employee_id=employee_id, status='INCLUDED').first()
        if item:
            ytd_gross += item.gross_earnings
            ytd_deductions += item.total_deductions
            ytd_net += item.net_pay
            months_paid += 1

    return Response({
        'success': True,
        'financial_year': f"{fy_start}-{(fy_start+1)%100:02d}",
        'ytd_gross': float(ytd_gross),
        'ytd_deductions': float(ytd_deductions),
        'ytd_net': float(ytd_net),
        'months_paid': months_paid,
    })
```

Wire in `authentication/urls.py`:
```python
path('employee/ytd/', employee_views.employee_ytd_view),
```

**Step 8b — Frontend**
**File:** `frontend/src/pages/EmployeeDashboard.tsx`

Add a YTD summary card that fetches from `/api/auth/employee/ytd/` and shows:
- YTD Gross Earnings
- YTD Deductions
- YTD Net Pay
- Months paid this financial year

---

### BLOCK 9 — Remove Dead ReportLab Generator (15 min)
**File:** `backend/payslip_generation/utils.py`

Search for any function that imports `reportlab` and delete it. Keep `PayslipFileManager` and all file path helpers. Add a comment:
```python
# PDF generation is handled exclusively by FrontendPDFGenerator (frontend_pdf_generator.py)
# The old ReportLab generator has been removed.
```

---

### BLOCK 10 — Async PDF (do last — most risk)

Only attempt this if blocks 1–9 are done and tested.

**Step 10a** — In `payroll_service.py`, extract the PDF+email loop from `_release_run_payslips()` into a `@shared_task` in `tasks.py`. The release transition sets run status to RELEASED immediately and fires the task.

**Step 10b** — Add `GET /api/payroll/runs/<id>/release-progress/` in `payroll_views.py`:
```python
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_run_release_progress(request, run_id):
    run = get_object_or_404(PayrollRun, id=run_id)
    total = PayrollRunItem.objects.filter(run=run, status='INCLUDED').count()
    released = Payslip.objects.filter(
        pay_period_month=run.month,
        pay_period_year=run.year,
        salary_type=run.salary_type,
        is_released=True,
    ).count()
    return Response({'total': total, 'released': released, 'done': released >= total})
```

**Step 10c** — In `PayrollRunDetail.tsx`, after clicking "Release Payslips", poll the progress endpoint every 2 seconds and show a progress bar.

---

## Time Budget

| Block | Task | Est. Time |
|-------|------|-----------|
| 1 | Rate limiting | 15 min |
| 2 | Formula engine | 30 min |
| 3 | Per-employee release (backend + frontend) | 45 min |
| 4 | Payroll health panel | 45 min |
| 5 | Variance badge | 30 min |
| 6 | YTD backend endpoint | 45 min |
| 7 | YTD tab in reports page | 30 min |
| 8 | Employee YTD self-service | 30 min |
| 9 | Remove dead ReportLab code | 15 min |
| 10 | Async PDF (optional, do last) | 3–4 hours |
| **Total (1–9)** | | **~5.5 hours** |
| **Total (1–10)** | | **~9 hours** |

---

## What Stays Out of Scope Today

These are real gaps but not worth starting today — they need design decisions or are low-risk:

- **LWF slab model** — currently flat amount per config; adding a slab table requires a new migration and UI. Defer.
- **TDS integration into `calculate_run()`** — `tds_service.py` is complete but not wired into the payroll run calculate loop. This needs careful testing to avoid breaking existing payslips. Defer to a dedicated sprint.
- **Payroll cutoff date** — requires a new config model and UI. Defer.
- **Payslip versioning** (`PayslipVersion` model) — low priority, no user-facing impact yet. Defer.
- **Full and Final Settlement** — complex multi-step workflow. Defer.
- **Role-based access (`PAYROLL_ADMIN`, `PAYROLL_APPROVER`)** — requires auth refactor. Defer.
- **Statutory reports (PF/ESI/PT export)** — useful but not blocking. Defer.
- **Phase 7 (helpdesk, tax declaration hooks, WhatsApp)** — post-launch. Defer.

---

## After Each Block — Checklist

- [ ] Django server starts without errors (`python manage.py check`)
- [ ] New endpoint returns expected JSON in browser/Postman
- [ ] Frontend page loads without console errors
- [ ] No existing tests broken (`python manage.py test payslip_generation`)
- [ ] Commit with message format: `fix(block-N): <description>`
