# RDesk SaaS UI Rebuild Plan

## Current State Analysis

### Existing Architecture:
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Django REST APIs at `/api/auth/...` and `/api/hrms/...`
- **UI Components**: shadcn/ui already installed
- **Routing**: React Router (basic)
- **API Services**: Already implemented in `services/api.ts` and `services/hrmsApi.ts`

### Current Issues:
- Dashboard has tabs inside content area (not a SaaS layout)
- No global sidebar navigation
- Header is embedded in each component
- Missing analytics visualizations
- UI looks like internal admin tool, not enterprise SaaS

---

## Rebuild Plan

### Phase 1: Global Layout Structure (Priority: HIGH)

1. **Create Sidebar Component** (`src/components/layout/Sidebar.tsx`)
   - Fixed left sidebar with navigation
   - Menu items: Dashboard, Employees, Payroll, Attendance, Leaves, Documents, Directory, Emails, Settings
   - Collapsible on mobile
   - Active state highlighting
   - RDesk branding with Droid Serif font

2. **Create Header Component** (`src/components/layout/Header.tsx`)
   - Global search bar
   - Notification bell with badge
   - User avatar dropdown
   - Logout button
   - SearchBar component integration

3. **Create AdminLayout** (`src/components/layout/AdminLayout.tsx`)
   - Combine Sidebar + Header + Content area
   - Responsive layout
   - Proper spacing and structure

### Phase 2: Dashboard Page (Priority: HIGH)

1. **Refactor Dashboard** (`src/pages/admin/Dashboard.tsx`)
   - Remove old tabs structure
   - Add stat cards: Total Employees, Present Today, On Leave, Payroll This Month
   - Add charts using Recharts:
     - Payroll trend (LineChart)
     - Attendance overview (BarChart)
     - Department distribution (PieChart)
   - Add activity feed section

2. **Create StatCard Component** (`src/components/StatCard.tsx`)
   - Icon, label, value, trend indicator
   - Soft shadows, rounded corners

3. **Create Chart Components**
   - PayrollTrendChart
   - AttendanceChart
   - DepartmentChart

### Phase 3: Employees Page (Priority: HIGH)

1. **Create Employees Page** (`src/pages/admin/Employees.tsx`)
   - Professional data table with shadcn/ui Table
   - Search employees
   - Department filter dropdown
   - Location filter dropdown
   - Bulk selection checkboxes
   - Table columns: Employee ID, Name, Email, Department, Location, Status, Actions
   - Action buttons: View, Edit, Send Invitation, Release Payslip, Delete
   - Add Employee button opens modal

2. **Create Employee Details Page** (`src/pages/admin/EmployeeDetails.tsx`)
   - Full employee profile view
   - Employment details
   - Salary information
   - Documents

### Phase 4: Payroll Page (Priority: MEDIUM)

1. **Create Payroll Page** (`src/pages/admin/Payroll.tsx`)
   - Tabs: Generate Payslips, Upload Salary, Actual Salary, Send Payslips
   - Month/Year/Department filters
   - Employee payroll table with earnings/deductions
   - Reuse existing components: BulkPayslipGenerator, MonthlySalaryUpload, ActualSalaryUpload, SendPayslipsPanel

### Phase 5: Attendance Page (Priority: MEDIUM)

1. **Create Attendance Page** (`src/pages/admin/Attendance.tsx`)
   - Stat cards: Present Today, Late Employees, Absent Employees
   - Attendance table: Employee, Sign In, Sign Out, Total Hours, Status
   - Date filter

### Phase 6: Leave Management Page (Priority: MEDIUM)

1. **Refactor LeaveManagement** (`src/pages/admin/Leaves.tsx`)
   - Use existing AdminLeaveApproval component
   - Add filters: Status, Leave Type
   - Leave request table with Approve/Reject buttons
   - Status badges: Pending (yellow), Approved (green), Rejected (red)

### Phase 7: Document Vault Page (Priority: MEDIUM)

1. **Refactor DocumentVault** (`src/pages/admin/Documents.tsx`)
   - Document table: Name, Employee, Uploaded By, Date
   - Upload/Download/Delete actions
   - Reuse existing functionality

### Phase 8: Employee Directory Page (Priority: MEDIUM)

1. **Refactor EmployeeDirectory** (`src/pages/admin/Directory.tsx`)
   - Grid layout of employee cards
   - Each card: Profile photo, Name, Role, Department, Location
   - Search and filters

### Phase 9: Notifications (Priority: MEDIUM)

1. **Create NotificationBell Component** (`src/components/NotificationBell.tsx`)
   - Bell icon with unread badge
   - Dropdown notification list
   - Mark as read functionality

2. **Integrate into Header**

### Phase 10: Settings & Routing (Priority: LOW)

1. **Create Settings Page** (`src/pages/admin/Settings.tsx`)
   - System configuration
   - Company settings
   - Integration settings

2. **Update App.tsx Routing**
   - New route structure matching the spec
   - Protected routes for admin and employee

---

## Design System

### Colors (from spec):
- Primary: #1E3A8A (blue-900)
- Accent: #2563EB (blue-600)
- Background: #F8FAFC (slate-50)

### Typography:
- Brand: RDesk / BlackRoth - Droid Serif
- UI Text: Inter or system fonts

### Components:
- Rounded cards with soft shadows
- Consistent padding (p-4, p-6)
- Clean spacing between elements
- Smooth hover effects

---

## File Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── AdminLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── ui/
│   │   └── [existing shadcn components]
│   ├── StatCard.tsx
│   ├── DataTable.tsx
│   ├── NotificationBell.tsx
│   └── SearchBar.tsx
├── pages/
│   ├── admin/
│   │   ├── Dashboard.tsx
│   │   ├── Employees.tsx
│   │   ├── EmployeeDetails.tsx
│   │   ├── Payroll.tsx
│   │   ├── Attendance.tsx
│   │   ├── Leaves.tsx
│   │   ├── Documents.tsx
│   │   ├── Directory.tsx
│   │   └── Settings.tsx
│   └── employee/
│       ├── Dashboard.tsx
│       ├── Payslips.tsx
│       └── Profile.tsx
├── services/
│   ├── api.ts [existing]
│   └── hrmsApi.ts [existing]
├── routes/
│   └── ProtectedRoute.tsx [existing]
├── styles/
│   └── globals.css
└── App.tsx [to be updated]
```

---

## Dependencies

Already installed:
- react-router-dom
- tailwindcss
- recharts
- lucide-react
- axios
- date-fns

Need to ensure:
- recharts is installed

---

## Implementation Order

1. Phase 1: Layout (Sidebar, Header, AdminLayout)
2. Phase 2: Dashboard with charts
3. Phase 3-8: Pages (Employees, Payroll, Attendance, Leaves, Documents, Directory)
4. Phase 9: Notifications
5. Phase 10: Settings and routing

---

## Notes

- Keep existing API integrations unchanged
- Preserve existing component functionality
- Focus on UI/UX improvements only
- Ensure mobile responsiveness
- Use existing shadcn/ui components

