# RDesk HRMS Extension - Implementation Plan

## Status: IN PROGRESS ✅ VERIFIED

### Verification Results
- ✅ Employee Portal backend verified
- ✅ Database models confirmed (Employee, EmployeeProfile, EmployeeInvitation, EmployeeAttendance)
- ✅ API endpoints verified (12 endpoints in authentication/employee_views.py)
- ✅ Frontend components verified (5 components: UnifiedLogin, ActivateAccount, EmployeeOnboarding, EmployeeDashboard, EmployeeManagementAdmin)
- ✅ Routes configured (App.tsx with proper routing)
- ✅ Database migrations applied

---

## Phase 1: Backend Models & Database

### 1.1 Leave Management Model (LeaveRequest)

**File**: `backend/employees/models.py`

```python
class LeaveType(models.Model):
    """Pre-defined leave types in the system"""
    name = models.CharField(max_length=50, unique=True)  # Sick, Casual, Privilege, etc
    max_days_per_year = models.IntegerField(default=10)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'leave_types'
        
    def __str__(self):
        return self.name

class LeaveRequest(models.Model):
    """Leave request model for employee leave applications"""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.ForeignKey(LeaveType, on_delete=models.SET_NULL, null=True)
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    approved_by = models.ForeignKey('authentication.AdminUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_leaves')
    approved_date = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'leave_requests'
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.employee.name} - {self.leave_type.name} ({self.start_date} to {self.end_date})"
    
    @property
    def number_of_days(self):
        return (self.end_date - self.start_date).days + 1
```

### 1.2 Document Vault Model (EmployeeDocument)

**File**: `backend/employees/models.py`

```python
class EmployeeDocument(models.Model):
    """Document storage for employees and admin-uploaded documents"""
    DOC_TYPE_CHOICES = [
        ('PAN', 'PAN Card'),
        ('AADHAAR', 'Aadhaar'),
        ('BANK_DOC', 'Bank Document'),
        ('CERTIFICATE', 'Certificate'),
        ('OFFER_LETTER', 'Offer Letter'),
        ('APPOINTMENT_LETTER', 'Appointment Letter'),
        ('PROMOTION_LETTER', 'Promotion Letter'),
        ('PAYSLIP', 'Payslip'),
        ('OTHER', 'Other'),
    ]
    
    VISIBILITY_CHOICES = [
        ('EMPLOYEE_ONLY', 'Employee Only'),
        ('ADMIN_ONLY', 'Admin Only'),
        ('BOTH', 'Both'),
    ]
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=20, choices=DOC_TYPE_CHOICES)
    document_name = models.CharField(max_length=255)
    file = models.FileField(upload_to='employee_documents/')
    uploaded_by = models.ForeignKey('authentication.AdminUser', on_delete=models.SET_NULL, null=True, blank=True)
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default='BOTH')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_verified = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'employee_documents'
        ordering = ['-uploaded_at']
        
    def __str__(self):
        return f"{self.employee.name} - {self.document_name}"
```

### 1.3 Notification Model (Notification)

**File**: `backend/employees/models.py`

```python
class Notification(models.Model):
    """In-app notification system"""
    NOTIFICATION_TYPE_CHOICES = [
        ('PAYSLIP_RELEASED', 'Payslip Released'),
        ('LEAVE_APPROVED', 'Leave Approved'),
        ('LEAVE_REJECTED', 'Leave Rejected'),
        ('DOCUMENT_UPLOADED', 'Document Uploaded'),
        ('ANNOUNCEMENT', 'Announcement'),
        ('ATTENDANCE_ALERT', 'Attendance Alert'),
    ]
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    related_id = models.IntegerField(null=True, blank=True)  # ID of related object (leave_id, doc_id, etc)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.title} - {self.employee.name}"
```

### 1.4 Create Migrations

**Command**:
```bash
cd backend
python manage.py makemigrations employees
python manage.py migrate employees
```

**Migration Files Created**:
- `employees/migrations/0017_leavetype_leave_request_and_more.py`
- `employees/migrations/0018_employee_document.py`
- `employees/migrations/0019_notification.py`

---

## Phase 2: Backend API Endpoints

### 2.1 Leave Management Endpoints

**File**: `backend/authentication/employee_views.py` (EXTEND)

Endpoints to add:
- `POST /api/auth/leave/apply/` - Apply for leave
- `GET /api/auth/leave/requests/` - Get my leave requests
- `GET /api/auth/leave/types/` - Get leave types
- `POST /api/auth/admin/leave/approve/` - Admin approve leave
- `POST /api/auth/admin/leave/reject/` - Admin reject leave
- `GET /api/auth/admin/leave/pending/` - Admin view pending leaves

### 2.2 Document Vault Endpoints

**File**: `backend/authentication/employee_views.py` (EXTEND)

Endpoints to add:
- `POST /api/auth/documents/upload/` - Upload document
- `GET /api/auth/documents/` - Get my documents
- `DELETE /api/auth/documents/{id}/` - Delete document
- `GET /api/auth/documents/{id}/download/` - Download document
- `POST /api/auth/admin/documents/upload/` - Admin upload document

### 2.3 Notification Endpoints

**File**: `backend/authentication/employee_views.py` (EXTEND)

Endpoints to add:
- `GET /api/auth/notifications/` - Get notifications
- `GET /api/auth/notifications/unread-count/` - Get unread count
- `POST /api/auth/notifications/{id}/read/` - Mark as read
- `POST /api/auth/notifications/read-all/` - Mark all as read

### 2.4 Employee Directory Endpoints

**File**: `backend/authentication/employee_views.py` (EXTEND)

Endpoints to add:
- `GET /api/auth/directory/` - Get employee directory (with search filters)
- `GET /api/auth/directory/{id}/` - Get employee details

### 2.5 CEO Dashboard Endpoints

**File**: `backend/authentication/employee_views.py` (EXTEND)

Endpoints to add:
- `GET /api/auth/admin/dashboard/stats/` - Get dashboard statistics
- `GET /api/auth/admin/dashboard/attendance-graph/` - Attendance graph data
- `GET /api/auth/admin/dashboard/leave-stats/` - Leave statistics

---

## Phase 3: Frontend Components

### 3.1 Leave Management Component

**File**: `frontend/src/components/LeaveManagement.tsx`

Features:
- List of leave requests (with status badges)
- Apply for leave form (date picker, leave type select, reason)
- Leave balance display
- Admin section: Pending leaves, approve/reject functionality

State Management:
- leaveRequests: LeaveRequest[]
- leaveTypes: LeaveType[]
- leaveBalance: {[key: string]: number}
- selectedLeave: LeaveRequest | null

### 3.2 Document Vault Component

**File**: `frontend/src/components/DocumentVault.tsx`

Features:
- Document upload form (type select, file input, drag-drop)
- Document list (with download, delete, type badges)
- Admin document upload section
- Search and filter by document type

State Management:
- documents: EmployeeDocument[]
- uploadProgress: number
- selectedDocType: string

### 3.3 Notification Center Component

**File**: `frontend/src/components/NotificationCenter.tsx`

Features:
- Notification bell icon in header
- Unread count badge
- Notification list (scrollable dropdown)
- Mark as read functionality
- Notification type icons/colors

State Management:
- notifications: Notification[]
- unreadCount: number
- isDropdownOpen: boolean

### 3.4 Employee Directory Component

**File**: `frontend/src/components/EmployeeDirectory.tsx`

Features:
- Employee list (cards or table)
- Search by name
- Filter by department, location
- Employee profile modal
- Contact information display

State Management:
- employees: Employee[]
- searchQuery: string
- filters: {department: string, location: string}
- selectedEmployee: Employee | null

### 3.5 CEO Dashboard Component

**File**: `frontend/src/components/CEODashboard.tsx`

Features:
- Summary cards (Total Employees, Present Today, On Leave, etc)
- Attendance chart (daily graph)
- Leave graph (approved, pending, rejected)
- Payroll analytics
- Department distribution

State Management:
- stats: DashboardStats
- chartData: ChartData
- selectedPeriod: 'week' | 'month'

### 3.6 Update Employee Dashboard

Modify `frontend/src/components/EmployeeDashboard.tsx`:

Current tabs: Overview, Profile, Payslips, Attendance
New tabs: Leave Requests, Documents, Directory

Replace tab logic with new component imports.

---

## Phase 4: Frontend Routes & Navigation

### 4.1 Update App.tsx with New Routes

Routes to add:
- `/leave-management` - Employee leave management
- `/documents` - Document vault
- `/directory` - Employee directory
- `/admin/leave-approval` - Admin leave approval
- `/admin/ceo-dashboard` - CEO/Management analytics
- `/admin/documents` - Admin document management

### 4.2 Update Header Navigation

Add menu items:
- Leave Management (authenticated employees)
- Documents (authenticated employees)
- Directory (authenticated employees)
- CEO Dashboard (authenticated admins/CEO)
- Notification bell (all authenticated users)

---

## Phase 5: Integration & Utilities

### 5.1 Create API Utility Functions

**File**: `frontend/src/services/hrmsApi.ts`

Functions to add:
- Leave API calls (apply, get, approve, reject)
- Document API calls (upload, get, download, delete)
- Notification API calls (get, mark read)
- Directory API calls (search, filter)
- Dashboard API calls (stats, charts)

### 5.2 Update Types

**File**: `frontend/src/types/index.ts`

Types to add:
```typescript
interface LeaveRequest {
  id: number;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  number_of_days: number;
  created_at: string;
}

interface EmployeeDocument {
  id: number;
  document_type: string;
  document_name: string;
  file_url: string;
  uploaded_at: string;
}

interface Notification {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}
```

---

## Phase 6: Security & Permissions

### 6.1 Backend Permission Checks

All endpoints must verify:
- Employee can only access their own data
- Admin can access all employee data
- File uploads validated (size, type)
- API rate limiting
- CORS properly configured

### 6.2 Frontend Permission Checks

Implement:
- Role-based component visibility
- Protected routes for admin/CEO dashboard
- Sensitive data filtering (hide salary in directory)
- File download restrictions

---

## Phase 7: Testing & Deployment

### 7.1 Testing Checklist

- [ ] All models migrate without errors
- [ ] All API endpoints return correct responses
- [ ] Permission checks work (employee can't access others' leaves)
- [ ] File uploads work (max size, allowed types)
- [ ] Notifications trigger on events
- [ ] Charts render correctly
- [ ] Search/filters work on directory
- [ ] Frontend components load without errors
- [ ] Cross-browser testing

### 7.2 Testing Workflow

1. Create test employee account
2. Apply for leave, verify approval workflow
3. Upload documents, verify download
4. Check notifications appear after actions
5. Search in employee directory
6. View CEO dashboard with sample data

---

## Implementation Timeline

**Phase 1 (Models)**: 1-2 hours
**Phase 2 (API Endpoints)**: 2-3 hours
**Phase 3 (Frontend Components)**: 3-4 hours
**Phase 4 (Routes & Navigation)**: 1 hour
**Phase 5 (Integration & Utilities)**: 1-2 hours
**Phase 6 (Security)**: 1 hour
**Phase 7 (Testing)**: 1-2 hours

**Total Estimated Time**: 10-15 hours

---

## Files to Create/Modify

### New Files (12 total)
- Backend: 3 files (extend models.py, extend employee_views.py, new hrms_views.py)
- Frontend: 6 components (LeaveManagement, DocumentVault, NotificationCenter, EmployeeDirectory, CEODashboard, + utilities)
- Configuration: settings updates
- Documentation: HRMS guide

### Modified Files (5 total)
- backend/authentication/urls.py
- backend/camelq_payslip/settings.py
- frontend/src/App.tsx
- frontend/src/types/index.ts
- frontend/src/components/EmployeeDashboard.tsx

---

## Expected Result

A complete HRMS platform with:
- ✅ Employee Portal (existing)
- ✅ Leave Management System
- ✅ Document Vault
- ✅ Notification System
- ✅ Employee Directory
- ✅ CEO Analytics Dashboard
- ✅ Role-based access control
- ✅ Secure file uploads
- ✅ Real-time notifications

Comparable to enterprise platforms like Zoho People, Rippling, or BambooHR.

---

**Next Step**: Begin Phase 1 - Create backend models
