# RothDesk HRMS

A full-stack Human Resource Management System built for BlackRoth Pvt. Ltd.
Handles employee management, attendance, leave, payroll processing, payslip generation, and statutory compliance (PF, ESI, PT, TDS).

## Team Members

Add your team members here:

| Name | Role |
|------|------|
|      |      |

---

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Backend   | Python 3.11, Django 4.2, Django REST Framework  |
| Database  | MySQL                                           |
| Auth      | JWT (admin/HR) + Django Sessions (employees)    |
| Async     | Celery + Redis                                  |
| Frontend  | React 18, TypeScript, Vite                      |
| Styling   | Tailwind CSS, shadcn/ui (Radix UI)              |
| Routing   | React Router v6                                 |
| Forms     | React Hook Form + Zod                           |
| Charts    | Recharts                                        |
| PDF       | ReportLab (backend), react-to-pdf (frontend)    |

---

## Project Structure

```
RothDesk-v1/
└── fullstack/
    ├── backend/                  ← Django REST API
    │   ├── rothdesk_payslip/     ← Django project config (settings, urls, celery)
    │   ├── authentication/       ← Users, login, leave, documents, notifications
    │   ├── departments/          ← Department master data
    │   ├── employees/            ← Employee profiles, salary, org chart, letters
    │   ├── attendance/           ← Shifts, punch-in/out, GPS, holidays
    │   ├── payslip_generation/   ← Payroll runs, PDF generation, reports
    │   ├── employee_finance/     ← Bank accounts, ESI, PF details
    │   ├── payroll_config/       ← Salary components, templates, tax config
    │   ├── manage.py             ← Django CLI entry point
    │   ├── .env                  ← Backend environment variables (never commit)
    │   └── logs/                 ← Application logs
    └── frontend/                 ← React + TypeScript SPA
        ├── src/
        │   ├── App.tsx           ← Root component with all routes
        │   ├── main.tsx          ← React entry point
        │   ├── pages/            ← One file per page/screen
        │   ├── components/       ← Reusable UI components
        │   ├── layout/           ← Role-specific shell layouts
        │   ├── contexts/         ← React Context (AuthContext)
        │   ├── routes/           ← ProtectedRoute guard
        │   ├── services/         ← Axios API client (api.ts, hrmsApi.ts)
        │   ├── hooks/            ← Custom React hooks
        │   ├── types/            ← TypeScript type definitions
        │   └── lib/              ← Utility functions
        ├── .env                  ← Frontend environment variables
        └── package.json
```

---

## Backend — Django Apps

### `rothdesk_payslip/` — Project Configuration
The Django project package. Not an app — just config files.

| File             | Purpose |
|------------------|---------|
| `settings.py`    | All Django settings: database, installed apps, middleware, email, Celery, logging. Values loaded from `.env` via python-decouple. |
| `urls.py`        | Master URL router. Wires all app-level `urls.py` files together under `/api/`. |
| `celery.py`      | Celery app instance. Enables async task processing (bulk emails, payslip generation). |
| `middleware.py`  | Custom CSRF middleware that exempts all `/api/*` routes from CSRF checks (API clients use JWT/session tokens instead). |
| `wsgi.py`        | WSGI server entry point. |
| `asgi.py`        | ASGI entry point (for future WebSocket support). |

---

### `authentication/` — Users, Login, Leave, Documents, Notifications
Handles all authentication and HRMS utility features that span multiple roles.

| File                  | Purpose |
|-----------------------|---------|
| `models.py`           | `AdminUser` — custom Django user model for admin/HR staff (replaces default User). |
| `views.py`            | Admin login/logout, profile update, password change. Returns JWT tokens. |
| `employee_views.py`   | Employee login (session-based), account activation via token, onboarding, payslip release toggle, punch sign-in/out. |
| `hrms_views.py`       | Leave management (apply, approve, reject, balance, encash), document vault (upload/download/delete), in-app notifications, employee directory, all dashboard stat endpoints. |
| `urls.py`             | Registers all `/api/auth/` endpoints. |
| `admin.py`            | Registers models in Django admin panel. |
| `apps.py`             | App config. |

---

### `departments/` — Department Master
Simple CRUD app for managing company departments.

| File            | Purpose |
|-----------------|---------|
| `models.py`     | `Department` — code, name, description, is_active flag. |
| `serializers.py`| DRF serializer for Department. |
| `views.py`      | List, create, update, delete departments. |
| `urls.py`       | Registers `/api/departments/` endpoints. |

---

### `employees/` — Employee Profiles, Salary, Org Chart, Letters
The largest app. Manages everything about an employee's lifecycle.

| File                      | Purpose |
|---------------------------|---------|
| `models.py`               | `Employee` (core profile, bank, PAN, salary), `SalaryStructure` (CTC breakdown), `MonthlySalaryData` (monthly inputs), `LeaveType`, `LeavePolicy`, `LeaveRequest`, `EmployeeDocument`, `Notification`, `Announcement`, `EmailLog`, `EmployeeInvitation`. |
| `serializers.py`          | DRF serializers for all employee-related models. |
| `views.py`                | Employee CRUD, Excel bulk import/export, salary management, welcome email sending, payslip release. |
| `org_views.py`            | Org chart data, manager assignment, team hierarchy. |
| `tax_declaration_views.py`| Employee tax declaration submission, TDS preview, admin approval workflow. |
| `leave_services.py`       | Business logic for leave balance calculation, accrual, LOP deduction. |
| `email_service.py`        | Sends welcome emails (with credentials), payslip emails, relieving letters via SMTP. |
| `urls.py`                 | Registers all `/api/employees/` endpoints (50+). |

---

### `attendance/` — Shifts, Punch-In/Out, GPS, Holidays
Tracks daily attendance with GPS verification and shift-based rules.

| File          | Purpose |
|---------------|---------|
| `models.py`   | `Shift` (work hours, late/half-day thresholds), `OfficeLocation` (GPS coords + radius), `AttendancePolicy` (GPS enforcement, work types), `HolidayCalendar`, `Holiday`, `EmployeeShiftAssignment`, `AttendanceRecord` (daily punch data), `MonthlyAttendanceSummary`. |
| `serializers.py` | DRF serializers for all attendance models. |
| `views.py`    | Punch-in/out with GPS check, attendance reports, shift/location/policy CRUD, holiday management, monthly summary for payroll. |
| `services.py` | Business logic: GPS distance calculation, work-hours computation, late/half-day determination. |
| `tasks.py`    | Celery task: auto-marks absent for employees who didn't punch in by end of day. |
| `urls.py`     | Registers all attendance endpoints. |

---

### `payslip_generation/` — Payroll Runs, PDF Generation, Reports
Orchestrates the full payroll cycle from calculation to PDF delivery.

| File                       | Purpose |
|----------------------------|---------|
| `models.py`                | `Payslip` — stores all computed components (earnings, deductions, net pay), PDF file path, QR code, release status. |
| `payroll_views.py`         | Payroll run management: create run, trigger calculation, status transitions (draft → processing → completed). |
| `views.py`                 | Payslip download (authenticated, ownership-checked), bulk email send, release/unrelease toggle. |
| `report_views.py`          | Payroll reports: salary register, bank transfer list, department summary, month-over-month variance. |
| `calculation_engine.py`    | Core payroll math: applies salary components, computes PF/ESI/PT/TDS, handles LOP deductions and one-time adjustments. |
| `payroll_service.py`       | Orchestrates a full payroll run: fetches attendance summaries, calls calculation engine, saves payslips. |
| `payroll_calendar_service.py` | Calculates payable working days for a month considering holidays and weekoffs. |
| `frontend_pdf_generator.py`| Generates payslip PDFs with company branding and QR code using ReportLab. |
| `audit.py`                 | Logs every payroll action (who ran it, when, what changed) for compliance. |
| `urls.py`                  | Registers all `/api/payslips/` endpoints. |

---

### `employee_finance/` — Bank, ESI, PF Details
Stores statutory and banking information per employee.

| File            | Purpose |
|-----------------|---------|
| `models.py`     | `BankMaster`, `BankBranchMaster` (IFSC lookup), `EmployeeBankDetail`, `EmployeeESIDetail`, `EmployeePFDetail`. |
| `serializers.py`| DRF serializers. |
| `views.py`      | CRUD for bank/ESI/PF details. |
| `urls.py`       | Registers `/api/finance/` endpoints. |

---

### `payroll_config/` — Salary Components, Templates, Statutory, Tax
Configures how salaries are structured and calculated.

| File            | Purpose |
|-----------------|---------|
| `models.py`     | `SalaryComponent` (code, name, type: EARNING/DEDUCTION, calculation: FIXED/PERCENTAGE/FORMULA), `SalaryTemplate`, `SalaryTemplateComponent`, `EmployeeSalaryAssignment` (effective-date history), `StatutoryConfig` (PF/ESI/PT rates), `PTSlab` (state-wise professional tax slabs). |
| `serializers.py`| DRF serializers. |
| `views.py`      | Component CRUD, template management, employee salary assignment, statutory config. |
| `tax_views.py`  | Tax calculation engine: computes TDS based on declared investments and regime (old/new). |
| `urls.py`       | Registers `/api/payroll-config/` endpoints. |
| `tax_urls.py`   | Registers `/api/tax/` endpoints. |

---

## Backend API Routes Summary

```
POST   /api/auth/login/                     Admin/HR login → returns JWT
POST   /api/auth/employee/login/            Employee login → sets session cookie
GET    /api/auth/profile/                   Current user profile

GET    /api/departments/                    List departments
POST   /api/departments/                    Create department

GET    /api/employees/                      List all employees
POST   /api/employees/                      Create employee
GET    /api/employees/:id/                  Employee detail
PUT    /api/employees/:id/                  Update employee
DELETE /api/employees/:id/                  Delete employee
POST   /api/employees/import/               Bulk import via Excel
GET    /api/employees/export/               Export to Excel

GET    /api/attendance/records/             Attendance records
POST   /api/attendance/punch-in/            Employee punch in (with GPS)
POST   /api/attendance/punch-out/           Employee punch out
GET    /api/attendance/shifts/              List shifts
GET    /api/attendance/holidays/            List holidays

GET    /api/leave/balance/                  Employee leave balance
POST   /api/leave/apply/                    Apply for leave
GET    /api/leave/my-requests/              My leave requests
POST   /api/hrms/leaves/:id/approve/        Admin approve leave
POST   /api/hrms/leaves/:id/reject/         Admin reject leave

GET    /api/payroll-config/components/      Salary components
GET    /api/payroll-config/templates/       Salary templates
POST   /api/payroll-config/assignments/     Assign salary to employee

POST   /api/payslips/generate/              Generate payslips for a month
GET    /api/payslips/:id/download/          Download payslip PDF (authenticated)
POST   /api/payslips/send-emails/           Email payslips to employees

GET    /api/finance/bank/                   Employee bank details
GET    /api/finance/pf/                     PF details
GET    /api/finance/esi/                    ESI details

GET    /api/dashboard/                      Dashboard overview stats
GET    /api/hrms/notifications/             In-app notifications
GET    /api/hrms/documents/                 Document vault
```

---

## Frontend — Pages & Routing

### User Roles & Portals

| Role     | Entry Point         | Layout          |
|----------|---------------------|-----------------|
| CEO      | `/ceo/dashboard`    | `CEOLayout`     |
| Admin/HR | `/admin/dashboard`  | `AdminLayout`   |
| Employee | `/employee/dashboard` | `EmployeeLayout` |

### Route Map

```
/login                              → UnifiedLogin (all roles)
/activate/:token                    → ActivateAccount (email link)
/onboarding                         → EmployeeOnboarding

/ceo/dashboard                      → CEO KPIs and overview
/ceo/analytics                      → CEO detailed analytics

/admin/dashboard                    → Admin home with stats
/admin/employees                    → Employee list + search
/admin/employees/:id                → Employee detail view
/admin/employees/:id/profile        → Full employee profile
/admin/employees/analytics          → HR analytics hub
/admin/employees/org-chart          → Org hierarchy chart
/admin/employees/bank-pf-esi        → Bank/PF/ESI management
/admin/employees/family-details     → Family member records
/admin/employees/generate-letter    → Generate HR letters
/admin/payroll                      → Payroll dashboard
/admin/payroll/preview              → Payroll preview before run
/admin/payroll/runs                 → Payroll run history
/admin/payroll/runs/:runId          → Payroll run detail
/admin/payroll/salary-templates     → Salary structure templates
/admin/payroll/salary-assignments   → Assign salary to employees
/admin/payroll/monthly-inputs       → Monthly LOP/bonus inputs
/admin/payroll/reports              → Payroll reports
/admin/payroll/tax-declarations     → Employee tax declarations (admin view)
/admin/payroll/tax-summary          → TDS summary report
/admin/attendance                   → Attendance management
/admin/leaves                       → Leave approval queue
/admin/documents                    → Document vault
/admin/directory                    → Employee directory
/admin/emails                       → Mass communication / announcements
/admin/notifications                → Notifications
/admin/settings                     → System settings

/employee/dashboard                 → Employee home
/employee/attendance                → My attendance records
/employee/leaves                    → My leave requests
/employee/documents                 → My documents
/employee/payslips                  → My payslips
/employee/tax-declaration           → Submit tax declaration
/employee/tax-regime                → Old vs new regime comparison
/employee/profile                   → My profile
```

### Key Frontend Files

| File / Folder              | Purpose |
|----------------------------|---------|
| `src/App.tsx`              | Root component. Defines all routes and wraps app in AuthProvider. |
| `src/main.tsx`             | React entry point. Mounts App into the DOM. |
| `src/contexts/AuthContext.tsx` | Global auth state: current user, role, token, login/logout functions. |
| `src/routes/ProtectedRoute.tsx` | Route guard. Checks auth + role before rendering. Redirects to /login if not authenticated. |
| `src/layout/AdminLayout.tsx`   | Admin/HR shell: sidebar navigation + top bar. Wraps all /admin/* pages. |
| `src/layout/CEOLayout.tsx`     | CEO shell: minimal layout for CEO portal. |
| `src/layout/EmployeeLayout.tsx`| Employee shell: sidebar with employee-specific nav. |
| `src/services/api.ts`          | Axios instance with base URL and interceptors. All API calls go through here. Organised by feature (auth, employees, payroll, attendance, etc.). |
| `src/services/hrmsApi.ts`      | Additional HRMS-specific API calls (leave, documents, notifications). |
| `src/hooks/usePunchInFlow.tsx`  | Custom hook managing the punch-in/out UI flow with GPS permission handling. |
| `src/types/index.ts`           | TypeScript interfaces for all data models (Employee, Payslip, AttendanceRecord, etc.). |
| `src/lib/utils.ts`             | Utility functions: class name merging (cn), date formatting, currency formatting. |
| `src/components/ui/`           | 40+ shadcn/ui base components (Button, Input, Dialog, Table, etc.). Do not modify these directly. |

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- MySQL 8+
- Redis (for Celery)

### Backend Setup

```bash
cd RothDesk-v1/fullstack/backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
# Edit .env with your database credentials and email settings

# Create the database in MySQL first
mysql -u root -p -e "CREATE DATABASE payrollone CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Run migrations
python manage.py migrate

# Create admin user
python manage.py create_admin

# Start development server
python manage.py runserver

# Start Celery worker (separate terminal)
celery -A rothdesk_payslip worker --loglevel=info
```

### Frontend Setup

```bash
cd RothDesk-v1/fullstack/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at `http://localhost:5173`
Backend runs at `http://localhost:8000`

---

## Environment Variables

### Backend `.env`

| Variable               | Description |
|------------------------|-------------|
| `SECRET_KEY`           | Django secret key — keep this private |
| `DEBUG`                | `True` for local development |
| `ALLOWED_HOSTS`        | Comma-separated allowed hostnames |
| `DB_NAME`              | MySQL database name |
| `DB_USER`              | MySQL username |
| `DB_PASSWORD`          | MySQL password |
| `DB_HOST`              | MySQL host (default: localhost) |
| `DB_PORT`              | MySQL port (default: 3306) |
| `CELERY_BROKER_URL`    | Redis URL for Celery broker |
| `CELERY_RESULT_BACKEND`| Redis URL for Celery results |
| `EMAIL_HOST`           | SMTP server (e.g. smtp.gmail.com) |
| `EMAIL_PORT`           | SMTP port (587 for TLS) |
| `EMAIL_HOST_USER`      | SMTP username / sender email |
| `EMAIL_HOST_PASSWORD`  | SMTP password or app password |
| `DEFAULT_FROM_EMAIL`   | Display name + email for outgoing mail |
| `CSRF_TRUSTED_ORIGINS` | Comma-separated frontend origins |
| `FRONTEND_URL`         | Frontend base URL (used in email links) |

### Frontend `.env`

| Variable            | Description |
|---------------------|-------------|
| `VITE_API_BASE_URL` | API base path — `/api` (proxied to Django by Vite) |

---

## Authentication Flow

### Admin / HR
1. POST `/api/auth/login/` with email + password
2. Backend returns a JWT access token
3. Frontend stores token in localStorage
4. All subsequent requests include `Authorization: Bearer <token>`

### Employee
1. POST `/api/auth/employee/login/` with employee ID + password
2. Backend creates a Django session
3. Frontend stores `userType=employee` in localStorage
4. All subsequent requests include the session cookie automatically

---

## Payroll Processing Flow

1. HR enters monthly inputs (LOP days, bonuses, one-time adjustments) via `/admin/payroll/monthly-inputs`
2. HR creates a payroll run for the month via `/admin/payroll/runs`
3. System calculates gross pay, deductions (PF, ESI, PT, TDS), and net pay using `calculation_engine.py`
4. HR previews the payroll run and approves it
5. System generates PDF payslips with QR codes via `frontend_pdf_generator.py`
6. HR releases payslips — employees can now see them in their portal
7. HR optionally sends payslip emails to all employees

---

## Folder Conventions

- Each Django app is self-contained: `models.py` → `serializers.py` → `views.py` → `urls.py`
- Frontend pages live in `src/pages/` — one file per screen
- Reusable UI pieces live in `src/components/`
- All API calls go through `src/services/api.ts` — never call `fetch` directly in components
- Types for all backend models are defined in `src/types/index.ts`
