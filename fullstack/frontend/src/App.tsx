import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import AdminLayout from './layout/AdminLayout';
import EmployeeLayout from './layout/EmployeeLayout';
import UnifiedLogin from './components/UnifiedLogin';
import ActivateAccount from './components/ActivateAccount';
import EmployeeOnboarding from './components/EmployeeOnboarding';
import DashboardPage from './pages/Dashboard';
import EmployeesPage from './pages/Employees';
import EmployeeDetailsPage from './pages/EmployeeDetails';
import PayrollPage from './pages/Payroll';
import AttendancePage from './pages/Attendance';
import LeavesPage from './pages/Leaves';
import DocumentsPage from './pages/Documents';
import DirectoryPage from './pages/Directory';
import NotificationsPage from './pages/Notifications';
import SettingsPage from './pages/Settings';
import EmployeeDashboardPage from './pages/EmployeeDashboard';
import EmployeePayslipsPage from './pages/EmployeePayslips';
import EmployeeProfilePage from './pages/EmployeeProfile';
import EmployeeAttendancePage from './pages/EmployeeAttendance';
import EmployeeLeavesPage from './pages/EmployeeLeaves';

const RootRedirect = () => {
  const userType = localStorage.getItem('userType');
  const userRole = (localStorage.getItem('userRole') || '').toLowerCase();

  if (userType === 'employee' || userRole === 'employee') {
    return <Navigate to="/employee/dashboard" replace />;
  }
  if (userType === 'admin' || userRole === 'admin' || userRole === 'hr' || userRole === 'ceo') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<p>Loading...</p>}>
        <Routes>
          <Route path="/login" element={<UnifiedLogin />} />
          <Route path="/activate/:token" element={<ActivateAccount />} />
          <Route path="/onboarding" element={<EmployeeOnboarding />} />

          <Route element={<ProtectedRoute role="admin" />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin/dashboard" element={<DashboardPage />} />
              <Route path="/admin/ceo-dashboard" element={<DashboardPage />} />
              <Route path="/admin/employees" element={<EmployeesPage />} />
              <Route path="/admin/employees/:id" element={<EmployeeDetailsPage />} />
              <Route path="/admin/payroll" element={<PayrollPage />} />
              <Route path="/admin/attendance" element={<AttendancePage />} />
              <Route path="/admin/leaves" element={<LeavesPage />} />
              <Route path="/admin/documents" element={<DocumentsPage />} />
              <Route path="/admin/directory" element={<DirectoryPage />} />
              <Route path="/admin/emails" element={<NotificationsPage />} />
              <Route path="/admin/notifications" element={<NotificationsPage />} />
              <Route path="/admin/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute role="employee" />}>
            <Route element={<EmployeeLayout />}>
              <Route path="/employee/dashboard" element={<EmployeeDashboardPage />} />
              <Route path="/employee/attendance" element={<EmployeeAttendancePage />} />
              <Route path="/employee/leaves" element={<EmployeeLeavesPage />} />
              <Route path="/employee/payslips" element={<EmployeePayslipsPage />} />
              <Route path="/employee/profile" element={<EmployeeProfilePage />} />
            </Route>
          </Route>

          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
