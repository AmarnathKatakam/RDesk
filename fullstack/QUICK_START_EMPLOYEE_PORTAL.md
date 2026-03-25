# Employee Portal - Quick Start Guide

## Setup Instructions

### 1. Apply Database Migrations

```bash
cd backend
python manage.py migrate
```

This will create the following new tables:
- `employee_profiles` - Extended employee information
- `employee_invitations` - Invitation tokens and status
- `employee_attendance` - Daily sign-in/sign-out records

Updated tables:
- `employees` - Added account activation and onboarding fields
- `payslips` - Added release tracking fields

### 2. Configure Environment Variables

Create or update `.env` file in the backend directory:

```
# Email Configuration (for sending invitations)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your_email@gmail.com
EMAIL_HOST_PASSWORD=your_app_password
DEFAULT_FROM_EMAIL=noreply@blackroth.in

# Frontend URL for invitation links
FRONTEND_URL=http://localhost:5173
```

*Note: For Gmail, generate an App Password instead of using your regular password*

### 3. Start Backend Server

```bash
cd backend
python manage.py runserver
```

Server runs on: `http://localhost:8000`

### 4. Start Frontend Server

In a new terminal:

```bash
cd frontend
npm run dev
```

Server runs on: `http://localhost:5173`

---

## Testing Flow

### Step 1: Admin Login

1. Open `http://localhost:5173/login`
2. Select "Admin" tab
3. Use existing admin credentials
4. Should redirect to admin dashboard

### Step 2: Create Employee

1. In admin dashboard, navigate to Employee Management tab (if added to Dashboard component)
2. OR use the new EmployeeManagementAdmin component
3. Fill in employee details:
   - Employee ID: `EMP001`
   - Name: `John Doe`
   - Email: `john.doe@blackroth.in` (MUST end with @blackroth.in)
   - Location: `Hyderabad`
   - Date of Joining: `2024-01-15`
4. Click "Add Employee"

### Step 3: Send Invitation

1. Find the newly created employee in Employee List
2. Click "Send Invite" button
3. System generates secure token and sends email
4. Check email (or console logs in development)

### Step 4: Employee Activates Account

1. Employee receives invitation email with activation link
2. Clicks link (format: `http://localhost:5173/activate/{token}`)
3. Sets password (must be 8+ characters, with uppercase, numbers, special chars)
4. Clicks "Activate Account"
5. Redirected to onboarding form

### Step 5: Employee Completes Onboarding

1. Fills in required fields:
   - Phone: `9999999999`
   - Address: `Full address`
   - Emergency Contact: `Name and phone`
2. Optionally fills financial info and uploads profile photo
3. Clicks "Complete Onboarding"
4. Redirected to employee dashboard

### Step 6: Employee Login

1. Go to `http://localhost:5173/login`
2. Select "Employee" tab
3. Enter Employee ID or Email
4. Enter password
5. Click "Login"
6. Redirected to employee dashboard

### Step 7: Test Employee Features

**Sign In/Out:**
- On Overview tab, click "Sign In" button
- Time is recorded
- Later, click "Sign Out" to end shift

**View Profile:**
- Navigate to Profile tab
- See read-only information
- Click "Edit Profile" to update optional fields

**View Payslips:**
- Navigate to Payslips tab
- No payslips yet (must be released by admin)
- Once admin releases payslips:
  - Payslips appear in this tab
  - Click "Download PDF" to get payslip file

**View Attendance:**
- Navigate to Attendance tab
- See historical sign-in/sign-out records
- Filtered to last 3 months by default

### Step 8: Admin Releases Payslips

1. Go to admin account
2. Navigate to Release Payslips tab in EmployeeManagementAdmin
3. Select:
   - Month: `January` (or desired month)
   - Year: `2024`
   - Check employees to receive payslips
4. Click "Release Payslips"
5. Employees can now see and download payslips

---

## API Testing (with curl)

### Send Invitation
```bash
curl -X POST http://localhost:8000/api/auth/employee/send-invitation/ \
  -H "Content-Type: application/json" \
  -d '{"employee_id": 1}'
```

### Employee Login
```bash
curl -X POST http://localhost:8000/api/auth/employee/login/ \
  -H "Content-Type: application/json" \
  -d '{"username_or_id": "EMP001", "password": "Password123!"}'
```

### Activate Account
```bash
curl -X POST http://localhost:8000/api/auth/employee/activate/ \
  -H "Content-Type: application/json" \
  -d '{
    "token": "secure_token_from_email",
    "password": "NewPassword123!",
    "confirm_password": "NewPassword123!"
  }'
```

### Sign In
```bash
curl -X POST http://localhost:8000/api/auth/employee/sign-in/ \
  -H "Content-Type: application/json" \
  -d '{"employee_id": 1}'
```

### Get Payslips
```bash
curl -X GET http://localhost:8000/api/auth/employee/payslips/?employee_id=1
```

---

## Troubleshooting

### Issue: "Employee not found"
- Verify employee exists in database
- Check employee_id is correct
- Ensure email ends with @blackroth.in

### Issue: "Invalid or expired token"
- Token has 48-hour expiry
- Admin must resend invitation
- Check token is copied correctly from email

### Issue: "Email not sending"
- Check EMAIL_BACKEND in .env is correct
- Verify EMAIL_HOST_USER and EMAIL_HOST_PASSWORD
- For Gmail, use App Password, not regular password
- Check terminal logs for error messages

### Issue: "Attendance record not found"
- Employee must sign in first before signing out
- Each date can only have one attendance record
- Check the date is correct

### Issue: "No payslips available"
- Admin must generate payslips first (existing feature)
- Admin must release payslips to employee
- Check payslip is_released = True in database

---

## Database Inspection

### Check Employee Status
```bash
sqlite3 db.sqlite3
SELECT id, employee_id, name, email, account_activated, onboarding_completed FROM employees LIMIT 5;
```

### Check Invitations
```bash
SELECT id, email, status, expires_at FROM employee_invitations;
```

### Check Attendance
```bash
SELECT id, employee_id, date, sign_in_time, sign_out_time FROM employee_attendance LIMIT 10;
```

### Check Released Payslips
```bash
SELECT id, employee_id, pay_period_month, is_released, released_at FROM payslips WHERE is_released = 1;
```

---

## Next Steps

1. **Update Dashboard Component**
   - Add EmployeeManagementAdmin to admin dashboard
   - Add employee management tab

2. **Email Templates**
   - Create HTML email templates for invitations
   - Add branding and styling

3. **Notifications**
   - Add toast notifications for success/error messages
   - Add email notifications for events

4. **Analytics**
   - Add attendance analytics
   - Add payslip distribution reports

5. **Security**
   - Implement 2FA
   - Add rate limiting
   - Add audit logging

---

## Files Modified/Created

### Frontend
- ✅ UnifiedLogin.tsx - Unified login component
- ✅ ActivateAccount.tsx - Account activation page
- EmployeeOnboarding.tsx - Onboarding form
- EmployeeDashboard.tsx - Employee dashboard
- EmployeeManagementAdmin.tsx - Admin employee management
- App.tsx - Updated routing

### Backend
- ✅ authentication/employee_views.py - Employee endpoints
- ✅ authentication/urls.py - Added employee routes
- ✅ employees/models.py - Added new models
- ✅ payslip_generation/models.py - Added release fields
- ✅ camelq_payslip/settings.py - Added email config

### Configuration
- ✅ vite.config.ts - API proxy setup
- ✅ EMPLOYEE_PORTAL_GUIDE.md - Full documentation

---

## Support

For detailed information, see EMPLOYEE_PORTAL_GUIDE.md
