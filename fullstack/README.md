# RothDesk HRMS — Fullstack Payroll & HR Management System

## Overview

RothDesk HRMS is a fullstack Human Resource Management System built for Indian companies.
It handles the complete employee lifecycle: onboarding, attendance, leave management,
payroll calculation, payslip generation, and tax compliance — all in one platform.

The system supports three user roles:
- **Admin / HR** — full access to all modules
- **CEO** — read-only analytics and org-level dashboards
- **Employee** — self-service portal (attendance, leaves, payslips, documents)

---

## How the Application Works

1. Admin logs in via `/login` using JWT authentication.
2. Employees receive an email invitation and activate their account via a token link.
3. Admin manages employees, assigns salary templates, and configures attendance policies.
4. Each month, HR uploads or enters monthly salary data, runs payroll, reviews it, and releases payslips.
5. Employees log in to punch in/out, apply for leave, view payslips, and submit tax declarations.
6. The system auto-marks absent employees via a scheduled Celery task.

---

## Project Structure

```
/
├── backend/          # Django REST API
├── frontend/         # React + Vite SPA
├── venv/             # Python virtual environment
├── start-full-system.ps1  # PowerShell script to start both servers
└── package-lock.json
```

---

## Backend — Django REST Framework

### Tech Stack
- **Framework**: Django 4.2 + Django REST Framework 3.14
- **Database**: MySQL (via `django.db.backends.mysql`)
- **Auth**: JWT (admin/HR via `rest_framework_simplejwt`) + Session cookies (employees)
- **Async Tasks**: Celery + Redis (bulk payslip emails, background jobs)
- **PDF Generation**: ReportLab
- **Excel Processing**: openpyxl + pandas
- **Config**: python-decouple (reads from `backend/.env`)

### Database (MySQL)

All credentials are loaded from `backend/.env`:

```
DB_NAME=rothdesk_payslip
DB_USER=root
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=3306
```

Key tables created by migrations:

| Table | App | Purpose |
|---|---|---|
| `admin_users` | authentication | Admin/HR login accounts (custom Django user) |
| `employees` | employees | Core employee records |
| `employee_profiles` | employees | Extended onboarding profile data |
| `employee_invitations` | employees | Email activation tokens |
| `salary_structures` | employees | Annual CTC and salary type per employee |
| `monthly_salary_data` | employees | Per-month salary component breakdown |
| `payroll_input_adjustments` | employees | One-time bonuses, deductions, arrears |
| `actual_salary_credited` | employees | Actual amount credited to bank each month |
| `leave_types` | employees | Paid/unpaid leave categories |
| `leave_policies` | employees | Accrual rules, carry-forward limits |
| `leave_requests` | employees | Employee leave applications + approval status |
| `employee_documents` | employees | PAN, Aadhaar, offer letters, payslips |
| `notifications` | employees | In-app notifications for employees |
| `announcements` | employees | Mass communication from admin |
| `email_logs` | employees | Audit trail for all outgoing emails |
| `departments` | departments | Department master data |
| `attendance_shifts` | attendance | Shift definitions (start/end/late thresholds) |
| `attendance_office_locations` | attendance | GPS coordinates + allowed radius |
| `attendance_policies` | attendance | GPS enforcement, remote punch, week-off rules |
| `attendance_records` | attendance | Daily punch-in/out per employee |
| `attendance_monthly_summaries` | attendance | Aggregated monthly attendance per employee |
| `holiday_calendars` | attendance | Named holiday calendars per year/state |
| `holiday_calendar_entries` | attendance | Individual holiday dates |
| `payslips` | payslip_generation | Generated payslip records + PDF path |
| `payroll_runs` | payslip_generation | Payroll cycle lifecycle (DRAFT→PAID) |
| `payroll_run_items` | payslip_generation | Per-employee snapshot within a payroll run |
| `payroll_run_item_lines` | payslip_generation | Per-component breakdown lines |
| `payroll_input_snapshots` | payslip_generation | Attendance snapshot locked at calc time |
| `payroll_audit_logs` | payslip_generation | Immutable audit trail for all payroll actions |
| `payroll_validation_issues` | payslip_generation | Pre-generation validation errors/warnings |
| `employee_bank_accounts` | employee_finance | Bank account details |
| `employee_esi` | employee_finance | ESI registration details |
| `employee_pf` | employee_finance | PF account details |
| `employee_lwf` | employee_finance | Labour Welfare Fund details |
| `salary_components` | payroll_config | Reusable salary component definitions |
| `salary_templates` | payroll_config | Named salary structure templates |
| `employee_salary_assignments` | payroll_config | Template assigned to an employee with CTC |

---

### Django Apps — Purpose of Each

#### `rothdesk_payslip/` — Project Configuration
- `settings.py` — Central config: database, installed apps, DRF, CORS, Celery, email, logging
- `urls.py` — Root URL router; wires all app URLs under `/api/`
- `celery.py` — Celery app instance for async task queue
- `middleware.py` — Custom CSRF exemption for `/api/*` routes
- `authentication.py` — Custom JWT authentication class
- `wsgi.py` / `asgi.py` — WSGI/ASGI server entry points

#### `authentication/` — Admin Users & Employee Auth
- `models.py` — `AdminUser` (custom Django user model replacing `auth.User`)
- `views.py` — JWT login/logout, profile endpoint
- `employee_views.py` — Employee login (session-based), activation, onboarding, payslip access
- `hrms_views.py` — Leave management, documents, notifications, dashboard stats, org analytics
- `urls.py` — Routes for `/api/auth/` and all `/api/hrms/` alias endpoints
- `management/commands/create_admin.py` — CLI command to seed the first admin user

#### `employees/` — Employee Master Data
- `models.py` — `Employee`, `SalaryStructure`, `MonthlySalaryData`, `PayrollInputAdjustment`, `LeaveType`, `LeavePolicy`, `LeaveRequest`, `EmployeeDocument`, `Notification`, `Announcement`, `EmailLog`, `EmployeeInvitation`
- `views.py` — Employee CRUD, Excel import, salary data upload, payslip release
- `org_views.py` — Org chart tree, manager assignment, mass transfer
- `tax_declaration_views.py` — Employee tax declaration (old/new regime)
- `serializers.py` — DRF serializers for all employee models
- `email_service.py` — Welcome email, relieving letter, experience letter sending via SMTP
- `leave_services.py` — Leave balance calculation, accrual logic, LOP computation
- `monthly_salary_services.py` — Monthly salary data processing and preview
- `urls.py` — Routes for `/api/employees/`
- `templates/emails/` — HTML + plain-text email templates (welcome, relieving, experience)
- `management/commands/initialize_leave_cycle.py` — Seeds leave balances for a new financial year
- `management/commands/process_monthly_leave_accrual.py` — Monthly EL accrual job

#### `departments/` — Department Master
- `models.py` — `Department` model
- `views.py` — Department CRUD
- `serializers.py` — Department serializer
- `urls.py` — Routes for `/api/departments/`

#### `attendance/` — Attendance Tracking
- `models.py` — `Shift`, `OfficeLocation`, `AttendancePolicy`, `HolidayCalendar`, `Holiday`, `AttendanceRecord`, `EmployeeShiftAssignment`, `MonthlyAttendanceSummary`, `AttendanceAuditLog`
- `views.py` — Punch-in/out, attendance dashboard, monthly report, payroll data export
- `services.py` — GPS distance check, status computation (PRESENT/LATE/HALF_DAY/ABSENT)
- `tasks.py` — Celery task: auto-mark absent employees at end of day
- `serializers.py` — Attendance serializers
- `urls.py` — Routes for `/api/attendance/`, `/api/shifts/`, `/api/office-location/`
- `management/commands/mark_absent_attendance.py` — CLI command to trigger absent marking

#### `payslip_generation/` — Payroll Engine
- `models.py` — `Payslip`, `PayrollRun`, `PayrollRunItem`, `PayrollRunItemLine`, `PayrollInputSnapshot`, `PayrollAuditLog`, `PayrollValidationIssue`, `PayslipGenerationTask`
- `payroll_service.py` — Core payroll run lifecycle: create, calculate, transition status
- `calculation_engine.py` — Salary component calculation (fixed, % of basic, statutory, formula)
- `payroll_calendar_service.py` — Working days, holidays, LOP proration computation
- `validation.py` — Pre-generation checks (missing data, negative net pay, duplicates)
- `audit.py` — Writes immutable `PayrollAuditLog` entries
- `views.py` — Payslip generation, download, email sending
- `payroll_views.py` — Payroll run CRUD, calculate, transition, hold/release
- `report_views.py` — Payroll register, bank transfer report, department summary, variance
- `frontend_pdf_generator.py` — Generates payslip PDFs using ReportLab
- `serializers.py` — Payroll serializers
- `urls.py` — Routes for `/api/payslips/` and `/api/payroll/`
- `utils.py` — Shared helpers (month name conversion, date utilities)

#### `employee_finance/` — Bank, ESI, PF, LWF
- `models.py` — `EmployeeBankAccount`, `EmployeeESI`, `EmployeePF`, `EmployeeLWF`, `FamilyMember`, `Bank`, `BankBranch`
- `views.py` — Upsert bank/ESI/PF/LWF details, family member CRUD, bank master CRUD
- `serializers.py` — Finance serializers
- `urls.py` — Routes for `/api/finance/`

#### `payroll_config/` — Salary Components & Templates
- `models.py` — `SalaryComponent`, `SalaryTemplate`, `SalaryTemplateComponent`, `EmployeeSalaryAssignment`
- `views.py` — Component and template CRUD, employee salary assignment
- `services.py` — Salary template application logic
- `statutory_service.py` — PF, ESI, PT statutory computation
- `tds_service.py` — TDS (income tax) calculation under old and new tax regime
- `tax_views.py` — Tax declaration endpoints, regime comparison
- `serializers.py` — Config serializers
- `urls.py` — Routes for `/api/payroll-config/`
- `tax_urls.py` — Routes for `/api/tax/`

#### `scripts/`
- `configure_hyderabad_attendance.py` — One-time script to seed Hyderabad office location
- `setup_smtp_and_send_payslips.ps1` — PowerShell helper to configure SMTP and send payslips

---

## Frontend — React + Vite + TypeScript

### Tech Stack
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 6 (with `@vitejs/plugin-react-swc`)
- **Routing**: React Router DOM v6
- **State**: React Context (auth) + local component state
- **HTTP Client**: Axios (admin API) + native `fetch` (HRMS/employee API)
- **UI Components**: Radix UI primitives + shadcn/ui pattern
- **Styling**: Tailwind CSS 3.4
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod validation
- **PDF**: react-to-pdf + jsPDF
- **Animations**: Framer Motion

### Frontend File Structure

```
frontend/src/
├── App.tsx                    # Root component — full routing tree
├── main.tsx                   # React entry point, mounts App
├── index.css                  # Global CSS imports
├── vite-env.d.ts              # Vite env type declarations
│
├── contexts/
│   └── AuthContext.tsx        # Global auth state (user, login, logout, isAuthenticated)
│
├── routes/
│   └── ProtectedRoute.tsx     # Role-based route guard (admin/ceo/employee)
│
├── layout/
│   ├── AdminLayout.tsx        # Persistent shell for admin: sidebar + header
│   ├── CEOLayout.tsx          # Persistent shell for CEO portal
│   └── EmployeeLayout.tsx     # Persistent shell for employee self-service
│
├── services/
│   ├── api.ts                 # Axios instance + all API modules (auth, employee, payroll, attendance...)
│   └── hrmsApi.ts             # Fetch-based client for HRMS/leave/document/notification endpoints
│
├── types/
│   ├── index.ts               # Shared TypeScript interfaces and types
│   └── supabase.ts            # Supabase type definitions (legacy/optional)
│
├── lib/
│   └── utils.ts               # Tailwind class merge utility (cn function)
│
├── hooks/
│   └── usePunchInFlow.tsx     # Custom hook for GPS punch-in/out flow
│
├── styles/
│   └── globals.css            # Tailwind base + custom CSS variables
│
├── components/
│   ├── ui/                    # shadcn/ui base components (Button, Dialog, Table, etc.)
│   ├── layout/                # Layout sub-components
│   ├── dashboard/             # Dashboard-specific widgets
│   ├── employees/             # Employee management sub-components
│   ├── payroll/               # Payroll sub-components
│   │
│   ├── UnifiedLogin.tsx       # Single login page for all roles (detects role from response)
│   ├── ActivateAccount.tsx    # Employee account activation via email token
│   ├── EmployeeOnboarding.tsx # First-time onboarding form (profile, bank, documents)
│   ├── ProtectedRoute.tsx     # (duplicate in components — use routes/ProtectedRoute.tsx)
│   ├── Dashboard.tsx          # Admin dashboard widget collection
│   ├── EmployeeDashboard.tsx  # Employee self-service dashboard widget
│   ├── CEODashboard.tsx       # CEO analytics dashboard
│   ├── Sidebar.tsx            # Admin sidebar navigation
│   ├── Header.tsx             # Top header bar
│   ├── HrmsNavbar.tsx         # Employee portal navbar
│   ├── AdminDashboardSidebar.tsx # Admin sidebar variant
│   ├── EmployeeManagement.tsx # Employee list + actions
│   ├── EmployeeManagementAdmin.tsx # Admin-specific employee management
│   ├── EmployeeDirectory.tsx  # Searchable employee directory
│   ├── PayslipForm.tsx        # Payslip generation form
│   ├── PayslipPreview.tsx     # Payslip PDF preview
│   ├── BulkPayslipGenerator.tsx # Bulk payslip generation UI
│   ├── GeneratePayslipsButton.tsx # Trigger payslip generation
│   ├── SendPayslipsPanel.tsx  # Send payslips via email panel
│   ├── MonthlySalaryUpload.tsx # Excel upload for monthly salary data
│   ├── ActualSalaryUpload.tsx # Upload actual credited salary
│   ├── SalaryMethodSelector.tsx # Choose salary calculation method
│   ├── SalaryConfirmationDialog.tsx # Confirm salary before payroll run
│   ├── AdminLeaveApproval.tsx # Leave approval panel for admin
│   ├── AdminLeaveDashboard.tsx # Leave overview for admin
│   ├── LeaveManagement.tsx    # Employee leave application UI
│   ├── DocumentVault.tsx      # Document upload/download UI
│   ├── WelcomeEmailManagement.tsx # Send/manage welcome emails
│   ├── RelievingLetterSender.tsx # Generate and send relieving letters
│   ├── BulkEmployeeSelector.tsx # Multi-select employees for bulk actions
│   ├── NotificationBell.tsx   # Notification icon with unread count
│   ├── NotificationCenter.tsx # Full notification list panel
│   ├── DataTable.tsx          # Reusable sortable/filterable data table
│   ├── Modal.tsx              # Generic modal wrapper
│   ├── SearchBar.tsx          # Global search input
│   ├── StatCard.tsx           # KPI stat card widget
│   ├── Avatar.tsx             # Employee avatar component
│   ├── PDFGenerator.tsx       # PDF generation wrapper
│   ├── PeriodSelector.tsx     # Month/year period picker
│   ├── PayrollNav.tsx         # Payroll section navigation tabs
│   ├── PayrollIssuesPanel.tsx # Validation issues display
│   ├── AppDrawer.tsx          # Mobile slide-out drawer
│   ├── AppLauncher.tsx        # App module launcher grid
│   ├── TopBar.tsx             # Top navigation bar
│   ├── BrandMark.tsx          # Logo/brand component
│   └── home.tsx               # Home redirect component
│
└── pages/
    ├── Dashboard.tsx           # Admin main dashboard (employee count, payroll, attendance KPIs)
    ├── Employees.tsx           # Employee list page with search and filters
    ├── EmployeeDetails.tsx     # Full employee detail view (profile, salary, documents)
    ├── EmployeeProfile.tsx     # Admin view of employee profile
    ├── EmployeeSelfProfile.tsx # Employee's own profile page
    ├── AnalyticsHub.tsx        # HR analytics (headcount, attrition, department breakdown)
    ├── OrgChart.tsx            # Interactive org chart with manager assignment
    ├── BankPfEsi.tsx           # Bank account, PF, ESI, LWF management
    ├── FamilyDetails.tsx       # Employee family member records
    ├── GenerateLetter.tsx      # Generate experience/relieving letters
    ├── Attendance.tsx          # Admin attendance dashboard (daily/monthly view)
    ├── EmployeeAttendance.tsx  # Employee's own attendance history + punch-in/out
    ├── Leaves.tsx              # Admin leave management (approve/reject)
    ├── EmployeeLeaves.tsx      # Employee leave application and balance
    ├── Documents.tsx           # Document vault (shared admin + employee)
    ├── Directory.tsx           # Employee directory with search
    ├── MassCommunication.tsx   # Send announcements/emails to all/filtered employees
    ├── Notifications.tsx       # Notification center page
    ├── Settings.tsx            # System settings
    ├── PayrollDashboard.tsx    # Payroll overview (runs, totals, status)
    ├── PayrollRunList.tsx      # List of all payroll runs
    ├── PayrollRunDetail.tsx    # Detail view of a single payroll run (items, hold, reprocess)
    ├── PayrollPreview.tsx      # Preview salary calculations before generating
    ├── SalaryTemplates.tsx     # Salary component templates management
    ├── SalaryAssignment.tsx    # Assign salary templates to employees
    ├── MonthlyInputs.tsx       # Enter/upload monthly salary inputs and adjustments
    ├── PayrollReports.tsx      # Payroll register, bank transfer, department summary reports
    ├── Payroll.tsx             # Legacy payroll page
    ├── TaxDeclaration.tsx      # Employee tax declaration form (old/new regime)
    ├── TaxDeclarationAdmin.tsx # Admin view of all employee tax declarations
    ├── TaxSummary.tsx          # TDS summary and regime comparison
    ├── RegimeComparison.tsx    # Old vs new tax regime comparison tool
    ├── EmployeeDashboard.tsx   # Employee self-service home
    ├── EmployeePayslips.tsx    # Employee payslip list and download
    ├── CEODashboard.tsx        # CEO-level dashboard
    └── CEOAnalytics.tsx        # CEO analytics charts
    └── admin/                  # Admin-specific sub-pages
```

---

## Frontend ↔ Backend Integration

### How Axios is Used (`frontend/src/services/api.ts`)

A single Axios instance is created with:
- `baseURL` from `VITE_API_BASE_URL` env variable (defaults to `/api`)
- `withCredentials: true` — sends session cookies for employee auth
- `Content-Type: application/json`

**Request interceptor** automatically:
1. Reads `authToken` from `localStorage` and adds `Authorization: Bearer <token>` header (JWT for admin)
2. Reads `csrftoken` cookie and adds `X-CSRFToken` header for POST/PUT/PATCH/DELETE

**Response interceptor** automatically:
1. Extracts CSRF token from response headers and stores it in cookie
2. On 401 — clears `authToken` from localStorage and redirects to `/login` (admin only; employee sessions are cookie-based and not force-redirected)

All API modules are exported from `api.ts`:

| Export | Endpoints Used |
|---|---|
| `authAPI` | `/api/auth/login/`, `/api/auth/logout/`, `/api/auth/profile/` |
| `employeeAPI` | `/api/employees/` — CRUD, import, welcome emails |
| `monthlySalaryAPI` | `/api/employees/monthly-salaries/` — upload, get by period |
| `actualSalaryAPI` | `/api/employees/actual-salary/` — credited salary upload |
| `departmentAPI` | `/api/departments/` — department CRUD |
| `payslipAPI` | `/api/payslips/` — generate, download, send |
| `attendanceAPI` | `/api/attendance/`, `/api/shifts/`, `/api/office-location/` |
| `payrollRunAPI` | `/api/payroll/runs/` — lifecycle management |
| `payrollConfigAPI` | `/api/payroll-config/` — components, templates, assignments |
| `payrollInputAPI` | `/api/employees/monthly-salaries/`, `/api/employees/payroll-adjustments/` |
| `payrollReportsAPI` | `/api/payroll/reports/` — register, bank transfer, variance |
| `financeAPI` | `/api/finance/` — bank, ESI, PF, LWF |
| `familyAPI` | `/api/finance/family-members/` |
| `orgChartAPI` | `/api/employees/org-chart/` |
| `letterAPI` | `/api/employees/letters/` — generate experience/relieving letters |
| `announcementAPI` | `/api/employees/announcements/` |
| `dashboardAPI` | `/api/dashboard/`, `/api/employees/count/`, `/api/attendance/today-summary/` |
| `employeeActivationAPI` | `/api/auth/employee/activate/`, `/api/auth/employee/onboarding/` |
| `employeeDashboardAPI` | `/api/authentication/employee/` — profile, payslips, attendance |

### How `hrmsApi.ts` Works (Employee Portal)

`hrmsApi.ts` uses native `fetch` (not Axios) with a **fallback chain** pattern.
Each call tries a primary URL, then falls back to alternate URLs if the primary returns 404/405.
This handles API route variations without breaking the UI.

```typescript
// Example: tries 3 URLs in order until one succeeds
hrmsApi.getLeaveRequests()
  // tries: /api/leave/my-requests/
  // fallback 1: /api/hrms/leaves/
  // fallback 2: /api/auth/leave/my-requests/
```

All `hrmsApi` calls use `credentials: 'include'` for session cookie auth.

### Authentication Flow

```
Admin/HR Login:
  POST /api/auth/login/ → returns JWT token
  → stored in localStorage as 'authToken'
  → all subsequent requests: Authorization: Bearer <token>

Employee Login:
  POST /api/auth/employee/activate/ (first time, sets password)
  POST /api/auth/employee/sign-in/ → sets session cookie
  → all subsequent requests: Cookie: sessionid=...
  → no JWT, no localStorage token

Role Detection:
  localStorage.getItem('userType')  → 'admin' | 'employee'
  localStorage.getItem('userRole')  → 'admin' | 'hr' | 'ceo' | 'employee'
  → App.tsx RootRedirect() reads these to route to correct dashboard
```

### Environment Variables

**Backend** (`backend/.env`):
```
SECRET_KEY=your-django-secret-key
DEBUG=True
DB_NAME=rothdesk_payslip
DB_USER=root
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=3306
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
FRONTEND_URL=http://localhost:5173
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your@email.com
EMAIL_HOST_PASSWORD=your_app_password
DEFAULT_FROM_EMAIL=noreply@rothdesk.in
CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://localhost:5173
```

**Frontend** (`frontend/.env`):
```
VITE_API_BASE_URL=http://localhost:8000/api
```

---

## Setup & Running

### Backend

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py create_admin          # creates first admin user
python manage.py runserver             # starts on http://localhost:8000
```

For async tasks (payslip emails, bulk operations):
```bash
celery -A rothdesk_payslip worker --loglevel=info
```

### Frontend

```bash
cd frontend
npm install
npm run dev                            # starts on http://localhost:5173
```

### Full System (Windows)

```powershell
.\start-full-system.ps1
```

---

## Key Workflows

### Monthly Payroll Run
1. Admin goes to **Payroll → Monthly Inputs** and uploads/enters salary data for the month
2. Admin creates a new **Payroll Run** (DRAFT status)
3. Admin clicks **Calculate** — system computes all salary components, LOP proration, TDS
4. Admin reviews items, puts problematic employees on hold if needed
5. Admin transitions: CALCULATED → REVIEWED → APPROVED → LOCKED
6. Admin clicks **Release** — payslips become visible to employees
7. Admin sends payslip emails via **Send Payslips** panel

### Employee Attendance
1. Employee opens the app and clicks **Punch In** (GPS location captured)
2. System checks GPS against office location radius (if GPS enforcement is on)
3. System records `AttendanceRecord` with `punch_in_time` and `work_type` (WFO/WFH/ONSITE)
4. Employee clicks **Punch Out** at end of day
5. System calculates `working_hours` and sets status (PRESENT/LATE/HALF_DAY)
6. Celery task runs at end of day to auto-mark remaining employees as ABSENT

### Leave Application
1. Employee applies for leave via **My Leaves** page
2. System checks leave balance (EL/CL/SL accrued per policy)
3. Admin approves/rejects from **Leaves** page
4. On approval, system calculates `paid_days` vs `lop_days`
5. LOP days feed into payroll calculation as salary deduction

---
