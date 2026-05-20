# TODO.md — Payroll Platform Upgrade Roadmap

> **Project:** RothDesk HRMS — Payroll Module Upgrade  
> **Stack:** Django (backend) · React + TypeScript (frontend)  
> **Last Updated:** March 2026

---

## Project Objective

The goal is to evolve the current payroll system from a basic payslip-generation pipeline into a **complete, production-grade payroll operations platform** — comparable in workflow quality to Zoho Payroll or greytHR.

The current system can generate PDFs and send emails. That is not enough for real payroll operations. This roadmap covers the full upgrade across:

- **Calculation accuracy** — fix broken deduction logic, remove hardcoded values
- **Configurability** — salary components, templates, state-wise rules
- **Release control** — enforce payslip visibility gates properly
- **Approval workflows** — draft → review → approve → lock → release → paid
- **Compliance** — PF, ESI, PT, LWF, TDS hooks
- **Reporting** — payroll register, bank transfer file, variance reports, YTD
- **Security** — audit logs, role-based access, secure download endpoints
- **Scalability** — async PDF generation, background jobs, batch processing

---

## Current Problems / Gaps

> These are known issues in the existing system that must be resolved before or during the upgrade.

- [ ] **[High]** Salary structure percentages are hardcoded in `SalaryStructure` model (Basic=40%, HRA=20%, DA=10%, Conveyance=₹1600 fixed, Medical=₹1250 fixed, PT=₹200 fixed) — not configurable per employee or grade
- [ ] **[High]** Working days per month are hardcoded in a static dictionary in `tasks.py` — ignores public holidays, company holidays, and actual calendar
- [ ] **[High]** Net pay calculation bug — `pf_employee` is listed under earnings but never subtracted in deductions, inflating net pay
- [ ] **[High]** `is_released` flag exists on `Payslip` model but is never enforced — employees can access unreleased payslips via direct URL
- [ ] **[High]** Payslip download endpoint has no `is_released` check — any authenticated user can download any payslip by ID
- [ ] **[High]** No payroll run lifecycle — there is no concept of a payroll run, so there is no way to lock, approve, or reopen a payroll period
- [ ] **[High]** No approval flow — payroll goes directly from generation to distribution with no review or sign-off step
- [ ] **[Medium]** Monthly salary data can only be entered via Excel upload — no per-employee manual entry or edit UI
- [ ] **[Medium]** No payroll summary or review screen before generation — admin cannot see total cost, headcount, or catch errors before PDFs are emailed
- [ ] **[Medium]** PDF generation is synchronous using Playwright — for 50+ employees this blocks the request thread and is slow
- [ ] **[Medium]** Two PDF generators exist (`utils.py` ReportLab + `frontend_pdf_generator.py` Playwright) — dead code, inconsistency risk
- [ ] **[Medium]** `payslip_stats` view loops through all records in Python instead of using ORM aggregation — O(n) performance issue
- [ ] **[Medium]** No validation engine — payroll can be generated for employees with missing bank details, missing PF info, or negative net pay
- [ ] **[Medium]** No audit trail — no record of who generated, approved, or released a payroll run
- [ ] **[Low]** No full and final settlement flow for exiting employees
- [ ] **[Low]** No statutory configurability — PT slabs are not state-aware, ESI applicability threshold not enforced
- [ ] **[Low]** No payroll reports or exports — no payroll register, no bank transfer file, no department summary
- [ ] **[Low]** No YTD (year-to-date) earnings/deductions view for employees or admin

---

## Upgrade Roadmap by Phases

---

### Phase 1 — Payroll Accuracy and Security

> Fix what is broken before building what is new. These are blockers for any production use.

#### 1.1 Fix Calculation Logic

- [x] **[High]** Fix net pay formula — move `pf_employee` out of earnings and into employee-side deductions
- [x] **[High]** Separate three buckets clearly in all calculation code: `gross_earnings`, `employee_deductions`, `employer_contributions` — net pay = gross_earnings − employee_deductions
- [x] **[High]** Verify `total_earnings`, `total_deductions`, and `net_pay` stored in `Payslip` model match the corrected formula
- [x] **[High]** Add a `recalculate()` method on `Payslip` that recomputes all fields from source data on demand
- [x] **[Medium]** Add unit tests for salary calculation covering edge cases: zero LOP, full LOP, mid-month joining, salary revision mid-month

#### 1.2 Enforce Release Gate

- [x] **[High]** Add `is_released=True` filter to the employee-facing payslip list endpoint (`/api/auth/employee/payslips/`)
- [x] **[High]** Add `is_released` check to the payslip download endpoint — return 403 if not released
- [x] **[High]** Add `is_released` check to the PDF serve/media endpoint — do not serve unreleased PDFs via `/media/` URL
- [x] **[High]** Add a bulk release action in the admin payroll UI — "Release All for March 2026" button
- [ ] **[Medium]** Add per-employee release toggle in the payroll run detail screen

#### 1.3 Secure Download Endpoints

- [x] **[High]** Replace direct `/media/` URL access for payslips with a signed download endpoint (`/api/payslips/<id>/download/`) that checks ownership and release status
- [x] **[High]** Ensure employees can only download their own payslips — add employee ownership check in download view
- [ ] **[Medium]** Add rate limiting on payslip download endpoints

> **Production hardening note:** For nginx deployments, add `X-Accel-Redirect` to the download view and configure nginx to serve `/protected-media/payslips/` internally. The Django `re_path` block in `urls.py` handles this for all non-nginx environments.

#### 1.4 Audit Logging

- [x] **[High]** Create `PayrollAuditLog` model — fields: `action`, `performed_by`, `target_employee`, `payroll_run`, `timestamp`, `notes`
- [x] **[High]** Log all payroll actions: generate, approve, release, reopen, delete, email sent
- [x] **[Medium]** Expose audit log in admin UI as a read-only timeline per payroll run
- [x] **[Medium]** Log failed payslip email attempts with reason

#### 1.5 Validation Engine

- [x] **[High]** Create `PayrollValidationIssue` model — fields: `payroll_run`, `employee`, `issue_type`, `message`, `severity` (ERROR / WARNING), `resolved`
- [x] **[High]** Add pre-generation validation checks:
  - [x] Employee has no salary structure assigned
  - [x] Employee has no bank account on file
  - [x] Employee has no PF number (if PF-covered)
  - [x] Calculated net pay is negative
  - [x] Duplicate payslip already exists for this period
  - [x] Monthly salary data missing for employee
- [x] **[Medium]** Block payroll generation if any ERROR-level validation issues exist — show issues list to admin
- [x] **[Medium]** Allow generation with WARNING-level issues after admin acknowledgement
- [x] **[Low]** Add a "Validate Only" dry-run mode that checks all employees without generating payslips

---

### Phase 2 — Payroll Workflow and Operations

> Build the operational backbone — the payroll run lifecycle.

#### 2.1 PayrollRun Model

- [x] **[High]** Create `PayrollRun` model with fields:
  - `id`, `month`, `year`, `salary_type`
  - `status` — choices: `DRAFT`, `CALCULATED`, `REVIEWED`, `APPROVED`, `LOCKED`, `RELEASED`, `PAID`, `REOPENED`
  - `created_by`, `approved_by`, `released_by`
  - `created_at`, `approved_at`, `released_at`, `locked_at`
  - `total_employees`, `total_gross`, `total_deductions`, `total_net`
  - `notes`, `reopen_reason`
- [x] **[High]** Create `PayrollRunItem` model — one record per employee per run:
  - FK to `PayrollRun`, FK to `Employee`
  - All salary component fields (mirrors `Payslip`)
  - `status` — `INCLUDED`, `ON_HOLD`, `REPROCESSING`, `ERROR`
  - FK to generated `Payslip` (nullable until generated)
- [x] **[High]** Enforce status transitions — only valid transitions allowed (e.g. DRAFT → CALCULATED → REVIEWED → APPROVED → LOCKED → RELEASED)
- [x] **[Medium]** Add `reopen` action with mandatory reason — transitions RELEASED → REOPENED, logs to audit trail

#### 2.2 Payroll Run API Endpoints

- [x] **[High]** `POST /api/payroll/runs/` — create new payroll run for a period
- [x] **[High]** `POST /api/payroll/runs/<id>/calculate/` — run salary calculations, populate `PayrollRunItem` records
- [x] **[High]** `POST /api/payroll/runs/<id>/approve/` — move to APPROVED status (via transition endpoint)
- [x] **[High]** `POST /api/payroll/runs/<id>/lock/` — lock run, prevent further edits (via transition endpoint)
- [x] **[High]** `POST /api/payroll/runs/<id>/release/` — release all payslips to employees (via transition endpoint)
- [x] **[High]** `POST /api/payroll/runs/<id>/reopen/` — reopen with reason (via transition endpoint)
- [x] **[Medium]** `POST /api/payroll/runs/<id>/hold-employee/` — put one employee on hold
- [x] **[Medium]** `POST /api/payroll/runs/<id>/reprocess-employee/` — reprocess one employee after correction

#### 2.3 Payroll Summary Dashboard

- [x] **[High]** Add payroll summary screen showing for the selected run:
  - Total headcount, total gross, total deductions, total net pay
  - Breakdown by department
  - Count of employees on hold / with errors
  - Status badge and action buttons (Calculate / Approve / Release)
- [ ] **[Medium]** Add month-over-month variance indicator (vs previous month's run)
- [ ] **[Medium]** Add a "Payroll Health" panel showing validation issue counts before generation

#### 2.4 Per-Employee Salary Data Editor

- [ ] **[High]** Build per-employee monthly salary data entry form — admin can enter/edit salary components for one employee without re-uploading the full Excel
- [ ] **[High]** Add inline edit capability in the payroll run detail table — click a cell to edit a component value
- [ ] **[Medium]** Add bulk adjustment tool — apply a fixed amount or percentage change to a component across selected employees
- [ ] **[Medium]** Add salary advance entry per employee per month — deducted automatically in that month's payslip

#### 2.5 Hold and Reprocess

- [x] **[Medium]** Add "Hold" action per employee in a payroll run — employee is excluded from that run's payslip generation
- [x] **[Medium]** Add "Reprocess" action — recalculate one employee's payslip after a correction without regenerating the full run
- [x] **[Low]** Add hold reason field and display in run detail

---

### Phase 3 — Configurable Payroll Engine

> Replace all hardcoded salary logic with a configurable component system.

#### 3.1 Salary Component Master

- [x] **[High]** Create `SalaryComponent` model in new `payroll_config` app:
  - `name`, `code`, `component_type` — `EARNING` / `DEDUCTION` / `EMPLOYER_CONTRIBUTION`
  - `calculation_type` — `FIXED_AMOUNT` / `PERCENTAGE_OF_BASIC` / `PERCENTAGE_OF_GROSS` / `PERCENTAGE_OF_CTC` / `STATUTORY` / `FORMULA`
  - `default_value`, `formula` (expression string for FORMULA type)
  - `is_taxable`, `is_pf_applicable`, `is_esi_applicable`, `is_statutory`
  - `affects_gross`, `affects_net`, `affects_ctc`
  - `is_recurring`, `is_active`, `display_order`
- [x] **[High]** Seed default Indian components: BASIC, HRA, DA, CONVEYANCE, MEDICAL, SPECIAL_ALLOWANCE, LTA, PF_EMP, ESI_EMP, PT, LWF_EMP, TDS, PF_EMPLOYER, ESI_EMPLOYER, LWF_EMPLOYER
- [ ] **[Medium]** Add formula engine — evaluate component formulas using employee and other component values as variables
- [ ] **[Medium]** Add component dependency ordering — ensure components that depend on others are calculated after

#### 3.2 Salary Template Master

- [x] **[High]** Create `SalaryTemplate` model — named template (e.g. "Software Engineer Grade 1", "Intern Stipend")
- [x] **[High]** Create `SalaryTemplateComponent` model — links a `SalaryTemplate` to a `SalaryComponent` with per-template override values (calculation_type_override, value, formula_override)
- [x] **[Medium]** Build salary template management UI — create, edit, clone templates
- [x] **[Medium]** Add template preview — enter a CTC and see computed component breakdown

#### 3.3 Employee Salary Assignment

- [x] **[High]** Create `EmployeeSalaryAssignment` model:
  - FK to `Employee`, FK to `SalaryTemplate`
  - `annual_ctc`, `effective_from`, `effective_to` (nullable — null = currently active)
  - `is_active`, `notes`, `created_by`
- [x] **[High]** Service layer: `assign_salary()`, `revise_salary()`, `get_active_assignment()`, `get_assignment_at_date()`
- [x] **[High]** `revise_salary()` closes old assignment (sets effective_to) and creates new one — full effective-date history preserved
- [x] **[Medium]** Duplicate active assignment prevention enforced in service layer with `select_for_update()`
- [ ] **[Medium]** Replace current `SalaryStructure` model usage with `EmployeeSalaryAssignment` in payroll run calculate flow (Phase 3C)
- [x] **[Medium]** Add salary revision UI — "Revise Salary" action on employee profile

#### 3.4 Statutory Configuration (Phase 3B — complete)

- [x] **[High]** Add `StatutoryConfig` model — PF ceiling (₹15,000), ESI ceiling (₹21,000), PF/ESI rates, PT enabled flag, LWF settings, TDS placeholder — scoped by `financial_year` + `state`
- [x] **[High]** Add `ProfessionalTaxSlab` model — FK to `StatutoryConfig`, income range, monthly PT amount, optional `applicable_months` for month-specific rules (Karnataka, Maharashtra)
- [x] **[High]** `statutory_service.py` — `get_statutory_config()`, `compute_pf()`, `compute_esi()`, `resolve_pt_amount()`, `compute_lwf()`, `compute_all_statutory()` — all configurable, no hardcoded rates
- [x] **[High]** PF applicability: `is_pf_applicable()` — checks `pf_enabled` + wage > 0; `compute_pf()` applies ceiling and configurable rounding
- [x] **[High]** ESI applicability: `is_esi_applicable()` — checks `esi_enabled` + gross ≤ `esi_wage_threshold` (₹21,000 default)
- [x] **[High]** PT resolution: `resolve_pt_amount()` — state + FY + gross wage + month → correct PT amount; supports month-specific slabs
- [x] **[High]** `get_financial_year()` helper — April–March Indian FY orientation
- [x] **[High]** Seed data: Karnataka FY 2025-26 (with month-specific PT slabs) + Maharashtra FY 2025-26
- [x] **[Medium]** APIs: `/api/payroll-config/statutory/` CRUD, PT slab management, `resolve/` and `preview/` endpoints
- [x] **[Medium]** Django admin: `StatutoryConfigAdmin` with inline PT slabs, `ProfessionalTaxSlabAdmin`
- [ ] **[Medium]** Add LWF state configuration — detailed LWF slab model (currently flat amounts per config)
- [ ] **[Low]** Add TDS hooks — placeholder for future TDS/income tax integration

---

### Phase 4 — Attendance, Leave, and Working Days Integration

> Replace all hardcoded calendar logic with real data.

#### 4.1 Holiday Calendar

- [ ] **[High]** Create `HolidayCalendar` model — `name`, `year`, `location` (optional, for location-specific calendars)
- [ ] **[High]** Create `Holiday` model — FK to `HolidayCalendar`, `date`, `name`, `holiday_type` (`NATIONAL` / `OPTIONAL` / `RESTRICTED`)
- [ ] **[High]** Build holiday calendar management UI — add/edit/delete holidays per year
- [ ] **[High]** Replace `get_month_details()` static dictionary with a dynamic working days calculator that reads from `Holiday` and weekly off policy

#### 4.2 Weekly Off Policy

- [ ] **[High]** Add `WeeklyOffPolicy` model — configurable week-off days (e.g. Saturday + Sunday, or only Sunday)
- [ ] **[Medium]** Link weekly off policy to `AttendancePolicy` or `Employee`
- [ ] **[Medium]** Factor weekly offs into working days calculation for payroll

#### 4.3 Payroll Proration Engine

- [ ] **[High]** Build proration logic for mid-month joiners — salary calculated from DOJ to month end
- [ ] **[High]** Build proration logic for mid-month leavers — salary calculated from month start to last working day
- [ ] **[Medium]** Add proration preview in payroll run detail — show prorated amount and reason

#### 4.4 Payroll Input Snapshot

- [ ] **[High]** Create `PayrollInputSnapshot` model — captures attendance summary, leave summary, and LOP days per employee per month at the time of payroll calculation
- [ ] **[High]** Lock the snapshot when payroll run moves to LOCKED status — prevents retroactive attendance changes from affecting a finalized payroll
- [ ] **[Medium]** Show snapshot data in payroll run detail per employee — "Attendance used for this payroll"

#### 4.5 Payroll Cutoff

- [ ] **[Medium]** Add payroll cutoff date configuration — attendance and leave data after the cutoff date is excluded from the current month's payroll
- [ ] **[Medium]** Show cutoff date prominently in payroll run UI
- [ ] **[Low]** Add cutoff override with approval for late corrections

---

### Phase 5 — PDF, Document, and Communication Improvements

#### 5.1 Async PDF Generation

- [ ] **[High]** Move payslip PDF generation to a Celery background task — return task ID immediately, poll for completion
- [ ] **[High]** Add a progress indicator in the payroll run UI — "Generating PDFs: 34/50 complete"
- [ ] **[High]** Remove the dead ReportLab generator in `utils.py` — keep only the Playwright-based generator
- [ ] **[Medium]** Add retry logic for failed PDF generation — retry up to 3 times before marking as ERROR

#### 5.2 PDF Quality

- [ ] **[Medium]** Add company logo configuration — admin uploads logo once, used in all payslip PDFs
- [ ] **[Medium]** Fix the HRA/DA label swap in the PDF template (`frontend_pdf_generator.py` has HRA and DA labels swapped in the earnings table)
- [ ] **[Medium]** Add payslip version number to PDF footer — useful when a payslip is regenerated after correction
- [ ] **[Low]** Add password protection option for payslip PDFs — password = employee DOB in DDMMYYYY format

#### 5.3 Payslip Versioning

- [ ] **[Medium]** Add `version` field to `Payslip` model — increments when a payslip is regenerated after a correction
- [ ] **[Medium]** Keep history of previous versions — `PayslipVersion` model storing old PDF path and component values
- [ ] **[Low]** Show version history in admin payslip detail view

#### 5.4 Employee Notifications

- [ ] **[High]** Send release notification to employee when their payslip is released — email + in-app notification
- [ ] **[Medium]** Add notification preference — employee can opt out of payslip email and only use in-app
- [ ] **[Medium]** Improve payslip email template — include net pay amount in email body, not just as attachment
- [ ] **[Low]** Add WhatsApp/SMS notification hook for payslip release (future integration point)

---

### Phase 6 — Reports, Exports, and Compliance

#### 6.1 Payroll Register

- [ ] **[High]** Build payroll register report — all employees, all components, for a selected month/year
- [ ] **[High]** Export payroll register to Excel (`.xlsx`) with proper column headers
- [ ] **[Medium]** Add department filter and employee filter to payroll register
- [ ] **[Medium]** Add column visibility toggle — show/hide individual salary components

#### 6.2 Bank Transfer Report

- [ ] **[High]** Generate bank transfer file — employee name, account number, IFSC, net pay amount
- [ ] **[High]** Export as CSV in standard bank upload format
- [ ] **[Medium]** Add bank-wise grouping — separate files per bank if needed
- [ ] **[Medium]** Show total transfer amount and employee count before download

#### 6.3 Department and Component Summary

- [ ] **[Medium]** Department-wise payroll summary — total headcount, gross, deductions, net per department
- [ ] **[Medium]** Component-wise summary — total amount paid per salary component across all employees for a month
- [ ] **[Medium]** Export both summaries to Excel

#### 6.4 Variance Report

- [ ] **[Medium]** Monthly variance report — compare current month vs previous month per employee
- [ ] **[Medium]** Highlight employees with net pay change above a configurable threshold (e.g. >10%)
- [ ] **[Low]** Add variance reason field — admin can annotate why an employee's pay changed

#### 6.5 Year-to-Date Reports

- [ ] **[Medium]** YTD earnings and deductions per employee — cumulative from April to current month
- [ ] **[Medium]** YTD report export to Excel
- [ ] **[Low]** YTD summary visible to employees in their self-service portal

#### 6.6 Statutory Reports

- [ ] **[Medium]** PF contribution report — employee UAN, PF number, employee contribution, employer contribution per month
- [ ] **[Medium]** ESI contribution report — ESI number, employee contribution, employer contribution
- [ ] **[Medium]** Professional Tax report — state-wise PT deducted per month
- [ ] **[Low]** LWF report — employees covered, amount deducted
- [ ] **[Low]** Form 16 data export hook (future TDS integration)

#### 6.7 Reimbursement and Adjustments

- [ ] **[Low]** Reimbursement summary report — total reimbursements paid per employee per month
- [ ] **[Low]** Salary advance / loan deduction ledger per employee
- [ ] **[Low]** Arrears payment report — when backdated salary revisions are processed

---

### Phase 7 — Employee Self-Service and Enterprise Readiness

#### 7.1 Employee YTD Dashboard

- [ ] **[Medium]** Add YTD payroll summary to employee dashboard — total earned, total deducted, net received since April
- [ ] **[Medium]** Add monthly earnings chart — bar chart of net pay per month for the current financial year
- [ ] **[Medium]** Show PF contribution summary — employee + employer contributions YTD

#### 7.2 Historical Payslip Center

- [ ] **[Medium]** Improve employee payslip page — add financial year filter, search by month
- [ ] **[Medium]** Show payslip status badge — "Released", "Processing" per month
- [ ] **[Low]** Add payslip comparison view — side-by-side two months

#### 7.3 Payroll Query / Helpdesk

- [ ] **[Low]** Add payroll query submission — employee can raise a query on a specific payslip
- [ ] **[Low]** Admin can respond to queries from the payroll run detail screen
- [ ] **[Low]** Query status tracking — Open, In Review, Resolved

#### 7.4 Tax Declaration Hooks

- [ ] **[Low]** Add tax declaration form — employee declares investments (80C, HRA, etc.) for TDS projection
- [ ] **[Low]** Admin can view declarations before finalizing TDS deductions
- [ ] **[Low]** Proof submission — employee uploads investment proof documents

#### 7.5 Full and Final Settlement

- [ ] **[Low]** Create `FullAndFinalSettlement` model — triggered on employee separation
- [ ] **[Low]** FnF calculation includes: pending salary, leave encashment, gratuity (if applicable), notice pay recovery, salary advance recovery
- [ ] **[Low]** FnF approval workflow — HR calculates → Manager approves → Finance releases
- [ ] **[Low]** Generate FnF settlement letter PDF
- [ ] **[Low]** FnF payslip separate from regular monthly payslip

#### 7.6 Role-Based Access and Approvals

- [ ] **[Medium]** Define payroll roles: `PAYROLL_ADMIN`, `PAYROLL_APPROVER`, `PAYROLL_VIEWER`, `EMPLOYEE`
- [ ] **[Medium]** Enforce role checks on all payroll API endpoints
- [ ] **[Medium]** Add approval chain configuration — who approves payroll runs (single approver or multi-level)
- [ ] **[Low]** Add delegation — approver can delegate to another user for a date range

---

## Suggested Database / Model Changes

> New models to be created or existing models to be significantly modified.

- [x] **[High]** `PayrollRun` — payroll run lifecycle per month/year
- [x] **[High]** `PayrollRunItem` — per-employee record within a payroll run
- [x] **[High]** `SalaryComponent` — configurable salary component master (payroll_config app)
- [x] **[High]** `SalaryTemplate` — named salary structure template (payroll_config app)
- [x] **[High]** `SalaryTemplateComponent` — components within a template with per-template override values
- [x] **[High]** `EmployeeSalaryAssignment` — employee-to-template assignment with effective-date history
- [x] **[High]** `PayrollValidationIssue` — validation errors/warnings per run per employee
- [x] **[High]** `PayrollAuditLog` — immutable log of all payroll actions
- [ ] **[High]** `HolidayCalendar` — named calendar per year/location
- [ ] **[High]** `Holiday` — individual holiday entries
- [ ] **[Medium]** `PayrollInputSnapshot` — locked snapshot of attendance/leave inputs used for a run
- [ ] **[Medium]** `PayrollInputAdjustment` — manual adjustments (advances, arrears, one-time deductions) per employee per run
- [x] **[Medium]** `ProfessionalTaxSlab` — state-wise PT slab configuration with month-specific rules
- [ ] **[Medium]** `StatutoryConfig` — company-level statutory settings per state/FY
- [ ] **[Medium]** `PayslipVersion` — historical versions of regenerated payslips
- [ ] **[Low]** `FullAndFinalSettlement` — FnF calculation and approval record
- [ ] **[Low]** `PayrollQuery` — employee helpdesk queries on payslips
- [ ] **[Low]** `TaxDeclaration` — employee investment declarations for TDS

---

## Suggested UI / Frontend Pages

> New pages and screens to be built in the React frontend.

- [ ] **[High]** **Payroll Dashboard** — overview of current month's run status, total cost, headcount, quick actions
- [ ] **[High]** **Monthly Payroll Run List** — list of all payroll runs with status, month, employee count, total net pay
- [ ] **[High]** **Payroll Run Detail Page** — per-employee breakdown table, status, hold/reprocess actions, validation issues panel
- [ ] **[High]** **Validation Issues Page** — list of all errors and warnings for a run, with resolution actions
- [ ] **[High]** **Release Control Screen** — bulk release toggle, per-employee release, release confirmation with summary
- [ ] **[High]** **Per-Employee Salary Data Editor** — form to enter/edit monthly salary components for one employee
- [ ] **[Medium]** **Salary Template Management** — create, edit, clone salary templates with component breakdown
- [ ] **[Medium]** **Payroll Calculation Preview** — enter CTC or select template, see computed component breakdown before assigning
- [ ] **[Medium]** **Payroll Approval Screen** — summary view for approver — total cost, variance from last month, approve/reject actions
- [ ] **[Medium]** **Payroll Reports Page** — tabbed reports: Register, Bank Transfer, Department Summary, Component Summary, Variance, YTD
- [ ] **[Medium]** **Holiday Calendar Management** — add/edit holidays per year, preview working days per month
- [ ] **[Medium]** **Employee YTD Payroll Page** — employee self-service YTD earnings, deductions, and monthly chart
- [ ] **[Medium]** **Payroll Audit Log Viewer** — admin-only timeline of all actions on a payroll run
- [ ] **[Low]** **Full and Final Settlement Screen** — trigger FnF, enter components, approval workflow
- [ ] **[Low]** **Payroll Query / Helpdesk** — employee raises query, admin responds inline

---

## Priority Summary

| Priority | Count | Description |
|----------|-------|-------------|
| 🔴 High | ~45 | Blockers — broken logic, security gaps, core workflow |
| 🟡 Medium | ~40 | Important — configurability, reporting, UX improvements |
| 🟢 Low | ~20 | Nice to have — compliance edge cases, advanced features |

---

## Execution Notes

- **Start with Phase 1** — nothing else matters if the calculation is wrong and payslips are insecure
- **Phase 2 and Phase 3 can run in parallel** — backend team builds `PayrollRun` while another track builds `SalaryComponent`
- **Phase 4 depends on Phase 3** — the proration engine needs configurable components to work correctly
- **Phase 6 reports can be built incrementally** — start with payroll register and bank transfer file, add others over time
- **Phase 7 is post-launch** — build after the core payroll operations are stable

---

*This document is a living roadmap. Update task status as work progresses. Use `[x]` to mark completed items.*
