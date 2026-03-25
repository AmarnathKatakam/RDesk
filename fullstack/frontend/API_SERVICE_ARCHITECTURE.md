# Centralized API Service Architecture

## Overview

All frontend API calls are now centralized through a production-ready service layer built on **Axios** with automatic JWT token injection, CSRF protection, and comprehensive error handling.

## Architecture

### Core Service: `src/services/api.ts`

The API service provides:

1. **Base Axios Instance** with automatic configuration
   - JWT token injection from `localStorage.authToken`
   - Credentials included for CORS requests
   - Automatic error handling and logging
   - Token scheme detection (Bearer vs Token)
   - 401 Unauthorized redirect to login

2. **Organized API Module Exports**
   - `authAPI` - Authentication endpoints
   - `employeeAPI` - Employee CRUD operations
   - `employeeActivationAPI` - Account activation, onboarding, invitations
   - `employeeDashboardAPI` - Employee dashboard data
   - `employeeAdminAPI` - Admin operations
   - `departmentAPI` - Department management
   - `payslipAPI` - Payslip generation and distribution
   - `monthlySalaryAPI` - Monthly salary data
   - `actualSalaryAPI` - Actual salary credited
   - `attendanceAPI` - Attendance tracking
   - And more...

## Key Features

### ✅ Automatic JWT Token Injection

```typescript
// The interceptor automatically adds Authorization header
const token = localStorage.getItem('authToken');
if (token) {
  headers.set('Authorization', `Bearer ${token}`);
}
```

### ✅ Consistent Error Handling

```typescript
// All API calls benefit from centralized error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Auto-redirect to login on auth failure
      window.location.href = '/login';
    }
    // Enhanced error logging for debugging
    console.error('API Error:', {
      status: error.response?.status,
      data: error.response?.data,
    });
  }
);
```

### ✅ FormData Support (File Uploads)

```typescript
// Automatic multipart/form-data handling
employeeAPI.importExcel(file); // Automatically sets Content-Type

// Manual FormData also works
const formData = new FormData();
formData.append('file', file);
employeeAPI.importExcel(formData);
```

### ✅ Blob Support (File Downloads)

```typescript
// Binary file downloads handled automatically
payslipAPI.downloadPayslip(payslipId);
// Returns blob for PDF, Excel, etc.
```

## Usage Examples

### Authentication

```typescript
import { authAPI } from '../services/api';

// Login
const response = await authAPI.login({
  username: 'admin',
  password: 'password123',
});
const { access_token } = response.data;
localStorage.setItem('authToken', access_token);

// Get profile
const profile = await authAPI.getProfile();

// Logout
await authAPI.logout();
```

### Employee Management

```typescript
import { employeeAPI } from '../services/api';

// Get all employees
const employees = await employeeAPI.getAll();
const { results } = employees.data;

// Create employee
const newEmployee = await employeeAPI.create({
  employee_id: 'EMP001',
  name: 'John Doe',
  email: 'john@company.com',
  // ... other fields
});

// Update employee
await employeeAPI.update(employeeId, {
  name: 'Jane Doe',
  position: 'Manager',
});

// Delete employee
await employeeAPI.delete(employeeId);

// Import from Excel
const file = event.target.files[0];
const result = await employeeAPI.importExcel(file);
```

### Activation & Onboarding

```typescript
import { employeeActivationAPI } from '../services/api';

// Activate account with password
await employeeActivationAPI.activate({
  token: activationToken,
  password: 'NewPassword123!',
  confirm_password: 'NewPassword123!',
});

// Send invitation
await employeeActivationAPI.sendInvitation(employeeId);

// Complete onboarding
const formData = new FormData();
formData.append('dob', '1990-01-01');
formData.append('pan_number', 'ABCDE1234F');
// ... other fields
await employeeActivatAPI.onboard(formData);
```

### Employee Dashboard

```typescript
import { employeeDashboardAPI } from '../services/api';

// Get employee profile
const profile = await employeeDashboardAPI.getProfile(employeeId);

// Get payslips
const payslips = await employeeDashboardAPI.getPayslips(employeeId);

// Get attendance
const attendance = await employeeDashboardAPI.getAttendanceHistory(employeeId);

// Sign in
await employeeDashboardAPI.signIn(employeeId);

// Sign out
await employeeDashboardAPI.signOut(employeeId);
```

### Admin Operations

```typescript
import { employeeAdminAPI } from '../services/api';

// Bulk release payslips
await employeeAdminAPI.bulkReleasePayslips({
  month: 'January',
  year: 2026,
  selected_employees: [1, 2, 3],
});

// Send relieving letter
const formData = new FormData();
formData.append('employee_name', 'John Doe');
formData.append('recipient_email', 'john@email.com');
formData.append('relieving_letter', relievingFile);
formData.append('experience_letter', experienceFile);
await employeeAdminAPI.sendRelievingLetter(formData);
```

### Salary Management

```typescript
import { monthlySalaryAPI, actualSalaryAPI } from '../services/api';

// Upload monthly salary data
const file = event.target.files[0];
const result = await monthlySalaryAPI.uploadExcel(file, 'January', 2026);

// Get salary by month/year
const salaries = await monthlySalaryAPI.getByMonthYear('January', 2026);

// Upload actual salary credited
await actualSalaryAPI.upload(
  [
    { employee_id: 1, actual_salary_credited: 50000 },
    { employee_id: 2, actual_salary_credited: 55000 },
  ],
  'January',
  2026
);
```

### Payslip Operations

```typescript
import { payslipAPI } from '../services/api';

// Generate payslips
const result = await payslipAPI.bulkGenerate({
  employee_ids: [1, 2, 3],
  month: 'January',
  year: 2026,
});

// Check generation status
const status = await payslipAPI.getGenerationStatus(taskId);

// Download payslip
const blob = await payslipAPI.downloadPayslip(payslipId);
// Handle blob for download

// Send payslips to employees
await payslipAPI.sendSelected([payslipId1, payslipId2], {
  'jane@company.com': 'john+jane@company.com', // Override email
});
```

### Attendance Management

```typescript
import { attendanceAPI } from '../services/api';

// Get dashboard
const dashboard = await attendanceAPI.getDashboard({
  date: '2026-03-16',
  department: 1,
});

// Get today's attendance
const today = await attendanceAPI.getToday(employeeId);

// Get monthly report
const report = await attendanceAPI.getMonthly({
  month: 3,
  year: 2026,
  employee_id: employeeId,
});

// Punch in
await attendanceAPI.punchIn({
  employee_id: employeeId,
  latitude: 40.7128,
  longitude: -74.0060,
  notes: 'Office',
});

// Punch out
await attendanceAPI.punchOut({
  employee_id: employeeId,
  latitude: 40.7128,
  longitude: -74.0060,
});
```

## Refactored Components

The following components have been refactored to use the centralized API service:

1. **ActivateAccount.tsx** ✅
   - `employeeActivationAPI.activate()` instead of direct fetch
   - Automatic JWT handling

2. **EmployeeManagementAdmin.tsx** ✅
   - `employeeAPI.create()` for adding employees
   - `employeeActivationAPI.sendInvitation()` for invitations
   - `employeeAdminAPI.bulkReleasePayslips()` for payslip release
   - `employeeAPI.getAll()` for loading employees

3. **EmployeeDashboard.tsx** ✅
   - `employeeDashboardAPI.getProfile()` for employee data
   - `employeeDashboardAPI.getPayslips()` for payslips
   - `employeeDashboardAPI.getAttendanceHistory()` for attendance
   - `employeeDashboardAPI.signIn/signOut()` for sign in/out

4. **EmployeeOnboarding.tsx** ✅
   - `employeeActivationAPI.onboard()` for onboarding form submission
   - Proper error handling with axios

5. **RelievingLetterSender.tsx** ✅
   - `employeeAdminAPI.sendRelievingLetter()` for letter sending
   - FormData handling for file uploads

## Error Handling Pattern

```typescript
try {
  const response = await employeeAPI.create(data);
  // Success handling
  const data = response.data;
  if (data.success) {
    // Handle success
  }
} catch (error: any) {
  // Proper error extraction from axios
  const errorMessage = 
    error.response?.data?.message || 
    error.message || 
    'An error occurred';
  
  setError(errorMessage);
  console.error('API Error:', {
    status: error.response?.status,
    data: error.response?.data,
  });
}
```

## Base URL Configuration

The API service automatically determines the base URL based on environment variables:

```bash
# .env or .env.local
VITE_API_BASE_URL=/api        # Use relative path (default)
VITE_API_BASE_URL=http://localhost:8000/api  # Full URL
VITE_API_BASE_URL=:8000/api   # Localhost with port
```

## Adding New API Endpoints

To add a new endpoint to the service:

```typescript
// In src/services/api.ts

export const newModuleAPI = {
  getItems: () => api.get('/new-module/'),
  
  createItem: (data: any) => api.post('/new-module/', data),
  
  updateItem: (id: string, data: any) => 
    api.put(`/new-module/${id}/`, data),
  
  deleteItem: (id: string) => 
    api.delete(`/new-module/${id}/`),
  
  uploadFile: (data:FormData) => 
    api.post('/new-module/upload/', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
};

// Usage in components
import { newModuleAPI } from '../services/api';
const response = await newModuleAPI.getItems();
```

## Token Management

JWT tokens are automatically read from `localStorage.authToken` on every request:

```typescript
// Set token on login
localStorage.setItem('authToken', token);

// Token is automatically injected in Authorization header
// Authorization: Bearer <token>

// Remove token on logout
localStorage.removeItem('authToken');
```

## Benefits

✅ **No Authorization Headers in Components** - Automatic JWT injection
✅ **Consistent Error Handling** - Centralized error logging and 401 redirects
✅ **CSRF Protection** - Credentials included automatically
✅ **File Upload Support** - FormData handled seamlessly
✅ **File Download Support** - Blob responses work correctly
✅ **Type Safety** - Full TypeScript support
✅ **DRY Code** - No repeated fetch logic
✅ **Testable** - Easy to mock axios for unit tests
✅ **Maintainable** - Single source of truth for all API calls
✅ **Production Ready** - Comprehensive error handling and logging

## Migration Checklist

- [x] Centralized API service created (`src/services/api.ts`)
- [x] ActivateAccount refactored to use `employeeActivationAPI`
- [x] EmployeeManagementAdmin refactored to use multiple APIs
- [x] EmployeeDashboard refactored to use `employeeDashboardAPI`
- [x] EmployeeOnboarding refactored to use `employeeActivationAPI`
- [x] RelievingLetterSender refactored to use `employeeAdminAPI`
- [x] TypeScript build successful
- [x] All components using centralized service
- [x] No direct fetch() calls in components
- [x] JWT tokens automatically injected
