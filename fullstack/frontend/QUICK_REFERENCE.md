# Quick Reference: Centralized API Service

## Import Pattern

Always import from `src/services/api`:

```typescript
import { 
  authAPI,
  employeeAPI,
  employeeActivationAPI,
  employeeDashboardAPI,
  employeeAdminAPI,
  payslipAPI,
  monthlySalaryAPI,
  // ... other APIs
} from '../services/api';
```

## Common Operations

### 🔐 Authentication
```typescript
// Login
await authAPI.login({ username, password });

// Get profile
await authAPI.getProfile();

// Logout
await authAPI.logout();
```

### 👥 Employees
```typescript
// Get all
const res = await employeeAPI.getAll();

// Get one
await employeeAPI.getById(id);

// Create
await employeeAPI.create({ name, email, ... });

// Update
await employeeAPI.update(id, { name, ... });

// Delete
await employeeAPI.delete(id);

// Import from Excel
await employeeAPI.importExcel(file);
```

### 🎯 Activation & Onboarding
```typescript
// Activate account
await employeeActivationAPI.activate({
  token, 
  password, 
  confirm_password 
});

// Send invitation
await employeeActivationAPI.sendInvitation(employeeId);

// Onboarding form
await employeeActivationAPI.onboard(formData);
```

### 📊 Dashboard
```typescript
// Get profile
await employeeDashboardAPI.getProfile(employeeId);

// Get payslips
await employeeDashboardAPI.getPayslips(employeeId);

// Get attendance
await employeeDashboardAPI.getAttendanceHistory(employeeId);

// Sign in
await employeeDashboardAPI.signIn(employeeId);

// Sign out
await employeeDashboardAPI.signOut(employeeId);
```

### 📋 Admin Operations
```typescript
// Bulk release payslips
await employeeAdminAPI.bulkReleasePayslips({
  month, 
  year, 
  selected_employees: [] 
});

// Send relieving letter
await employeeAdminAPI.sendRelievingLetter(formData);
```

### 💰 Salary
```typescript
// Upload monthly salary
await monthlySalaryAPI.uploadExcel(file, month, year);

// Get by month/year
await monthlySalaryAPI.getByMonthYear(month, year);

// Upload actual salary
await actualSalaryAPI.upload(employeeSalaries, month, year);
```

### 📄 Payslips
```typescript
// Generate
await payslipAPI.bulkGenerate({ employee_ids, month, year });

// Check status
await payslipAPI.getGenerationStatus(taskId);

// Download
const blob = await payslipAPI.downloadPayslip(payslipId);

// Send
await payslipAPI.sendSelected([id1, id2], overrideEmails);
```

### ⏱️ Attendance
```typescript
// Punch in
await attendanceAPI.punchIn({ employee_id, latitude, longitude });

// Punch out
await attendanceAPI.punchOut({ employee_id, latitude, longitude });

// Get report
await attendanceAPI.getReport({ employee_id, start_date, end_date });
```

## Error Handling Pattern

```typescript
try {
  const response = await apiModule.operation(data);
  
  if (response.data.success) {
    // Handle success
    setData(response.data.results);
  } else {
    // Handle API-level error
    setError(response.data.message);
  }
} catch (error: any) {
  // Handle network/auth error
  const message = error.response?.data?.message || error.message;
  setError(message);
  
  // 401 auto-redirects to login
  // Other errors logged to console
}
```

## File Upload Pattern

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('month', 'January');
formData.append('year', 2026);

// Service handles Content-Type automatically
const response = await monthlySalaryAPI.uploadExcel(
  formData, 
  'January', 
  2026
);
```

## File Download Pattern

```typescript
const blob = await payslipAPI.downloadPayslip(payslipId);

// Handle blob in browser
const url = window.URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'payslip.pdf';
link.click();
window.URL.revokeObjectURL(url);
```

## Token Management

```typescript
// On login (automatic)
localStorage.setItem('authToken', token);

// On logout (automatic)  
localStorage.removeItem('authToken');

// Token automatically added to all requests
// Authorization: Bearer <token>
```

## Key Points

✅ **Never use fetch()** - Use API service modules  
✅ **No manual headers** - JWT injected automatically  
✅ **No auth checks** - 401 redirects handled centrally  
✅ **Consistent errors** - All logged same way  
✅ **File uploads work** - FormData handled automatically  
✅ **File downloads work** - Blob responses handled automatically  
✅ **Type-safe** - Full TypeScript support  

## Common Mistakes to Avoid

❌ `fetch('/api/employees/')`  
✅ `employeeAPI.getAll()`

❌ Adding Authorization header manually  
✅ Token injected automatically from localStorage

❌ Checking `response.ok`  
✅ Axios throws on non-2xx status automatically

❌ Calling `response.json()`  
✅ Use `response.data` directly (axios parses it)

❌ Direct `api.post()` calls in components  
✅ Use named API modules (employeeAPI, payslipAPI, etc)

---

For detailed documentation, see:
- [API_SERVICE_ARCHITECTURE.md](./API_SERVICE_ARCHITECTURE.md)
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
