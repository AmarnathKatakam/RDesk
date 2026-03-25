# RDesk Employee Portal - Implementation Guide

## Overview

The Employee Portal has been successfully integrated into the RDesk Payroll System. This guide outlines all the new features, components, and how to use them.

## Features Implemented

### 1. Unified Login System
- **Component**: `UnifiedLogin.tsx`
- **URL**: `/login`
- **Features**:
  - Tabs for Admin and Employee login
  - Support for username (admin) or Employee ID/Email (employee)
  - Password visibility toggle
  - Role-based redirection

### 2. Employee Account Activation
- **Component**: `ActivateAccount.tsx`
- **URL**: `/activate/:token`
- **Features**:
  - Secure token-based activation
  - Password strength indicator
  - Password confirmation validation
  - Minimum 8 characters required
  - Auto-redirect to onboarding

### 3. Employee Onboarding Form
- **Component**: `EmployeeOnboarding.tsx`
- **URL**: `/onboarding`
- **Fields**:
  - Required: Phone (10 digits), Address, Emergency Contact
  - Optional: Bank Account, IFSC Code, PAN Number, Profile Photo
  - File validation (JPEG/PNG, max 5MB)
  - Form validation with proper error messages

### 4. Employee Dashboard
- **Component**: `EmployeeDashboard.tsx`
- **URL**: `/employee/dashboard`
- **Tabs**:
  - **Overview**: Employee info, today's attendance, sign in/out buttons
  - **Profile**: Read-only employee information with edit capability
  - **Payslips**: Released payslips with PDF download
  - **Attendance**: Historical attendance records

### 5. Admin Employee Management
- **Component**: `EmployeeManagementAdmin.tsx`
- **Features**:
  - **Employee List**: View all employees with status
  - **Add Employee**: Create new employees with validation
  - **Bulk Release Payslips**: Release payslips to multiple employees

## Backend API Endpoints

### Authentication Endpoints

#### Employee Login
```
POST /api/auth/employee/login/
Body: {
  "username_or_id": "EMP001 or email@blackroth.in",
  "password": "password"
}
```

#### Account Activation
```
POST /api/auth/employee/activate/
Body: {
  "token": "secure_token",
  "password": "newpassword",
  "confirm_password": "newpassword"
}
```

#### Complete Onboarding
```
POST /api/auth/employee/onboarding/
Body: FormData {
  "employee_id": 1,
  "phone": "9999999999",
  "address": "Address",
  "emergency_contact": "Name and Phone",
  "bank_account": "11111111111",
  "ifsc_code": "ICIC0000001",
  "pan_number": "ABCDE1234F",
  "profile_photo": File
}
```

### Employee Profile Endpoints

#### Get Profile
```
GET /api/auth/employee/profile/?employee_id=1
```

#### Update Profile
```
POST /api/auth/employee/profile/update/
Body: {
  "employee_id": 1,
  "phone": "9999999999",
  "address": "Address",
  "emergency_contact": "Contact",
  "profile_photo": File (optional)
}
```

### Attendance Endpoints

#### Sign In
```
POST /api/auth/employee/sign-in/
Body: {
  "employee_id": 1
}
```

#### Sign Out
```
POST /api/auth/employee/sign-out/
Body: {
  "employee_id": 1
}
```

#### Get Attendance History
```
GET /api/auth/employee/attendance/?employee_id=1&months=3
```

### Payslip Endpoints

#### Get Employee Payslips
```
GET /api/auth/employee/payslips/?employee_id=1
```

### Admin Endpoints

#### Send Invitation
```
POST /api/auth/employee/send-invitation/
Body: {
  "employee_id": 1
}
```

#### Release Payslip
```
POST /api/auth/employee/release-payslip/
Body: {
  "payslip_id": 1
}
```

#### Bulk Release Payslips
```
POST /api/auth/employee/bulk-release-payslips/
Body: {
  "employee_ids": [1, 2, 3],
  "month": "January",
  "year": 2024
}
```

## Database Models

### EmployeeProfile
Extends employee profile with onboarding information.

### EmployeeInvitation
Stores invitation tokens for account activation (48-hour expiry).

### EmployeeAttendance
Tracks daily sign-in and sign-out records.

### Updated Payslip Model
Added `is_released`, `released_at`, and `released_by` fields.

### Updated Employee Model
Added `account_activated`, `onboarding_completed`, and `account_activated_at` fields.

## Workflow

### Employee Signup and Onboarding Flow

1. **Admin adds employee**
   - Uses `EmployeeManagementAdmin` or admin panel
   - Email must end with `@blackroth.in`

2. **Admin sends invitation**
   - Generates secure token (48-hour expiry)
   - Sends email with activation link

3. **Employee receives invitation**
   - Clicks link in email
   - Redirected to `/activate/{token}`

4. **Employee sets password**
   - Creates strong password
   - Account activation complete

5. **Employee completes onboarding**
   - Fills in profile details
   - Uploads profile photo (optional)
   - Becomes fully active

6. **Employee logs in**
   - Uses Employee ID or Email
   - Redirected to employee dashboard

7. **Employee uses dashboard**
   - Signs in/out daily
   - Views profile
   - Accesses released payslips
   - Views attendance history

### Payslip Release Flow

1. **Admin generates payslips**
   - Uses existing payslip generation system

2. **Admin releases payslips**
   - Selects employees and month/year
   - Uses bulk release feature
   - Sets `is_released = True`

3. **Employees see payslips**
   - View in dashboard
   - Download PDF files

## Configuration

### Environment Variables

Add to `.env`:

```
FRONTEND_URL=http://localhost:5173
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your@gmail.com
EMAIL_HOST_PASSWORD=your_app_password
DEFAULT_FROM_EMAIL=noreply@blackroth.in
```

### Vite Configuration

Update `vite.config.ts` to proxy API requests:

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
```

## Security Features

- **Email validation**: Only @blackroth.in emails allowed
- **Token expiry**: Invitation tokens expire in 48 hours
- **Password strength**: Requires 8+ characters with mixed case and numbers
- **Role-based access**: Employees can only access their own data
- **Secure endpoints**: Protected with authentication decorators

## Testing

### Backend Testing

```bash
# Run Django tests
python manage.py test

# Check models
python manage.py migrate

# Run development server
python manage.py runserver
```

### Frontend Testing

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Login with admin
Username: admin
Password: admin

# Test employee flow
1. Go to /login
2. Switch to Employee tab
3. Use created employee credentials
```

## File Structure

```
Backend:
- authentication/employee_views.py (new)
- employees/models.py (updated)
- payslip_generation/models.py (updated)

Frontend:
- components/UnifiedLogin.tsx (new)
- components/ActivateAccount.tsx (new)
- components/EmployeeOnboarding.tsx (new)
- components/EmployeeDashboard.tsx (new)
- components/EmployeeManagementAdmin.tsx (new)
```

## Troubleshooting

### Email Not Sending
- Verify EMAIL_BACKEND is set correctly
- Check EMAIL_HOST and EMAIL_PORT
- For Gmail, use App Password, not regular password
- Enable "Less secure app access" if using Gmail

### Token Expired Error
- Tokens expire after 48 hours
- Admin must resend invitation
- All previous tokens become invalid

### Employee Can't Login
- Verify account_activated = True
- Verify onboarding_completed = True
- Check email ends with @blackroth.in
- Verify password is correct

### Profile Photo Not Uploading
- File must be JPEG or PNG
- File size must be < 5MB
- Ensure media directory exists

## Future Enhancements

1. Email templates with HTML
2. Attendance calendar view
3. Salary slip preview
4. Leave management
5. Performance reviews
6. Two-factor authentication
7. API rate limiting
8. Audit logging

## Support

For issues or questions, refer to the backend logs:

```bash
tail -f backend/logs/django.log
```

Check browser console for frontend errors.
