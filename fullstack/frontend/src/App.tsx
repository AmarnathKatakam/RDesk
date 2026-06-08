/**
 * App.tsx — RothDesk HRMS Root Component
 * ========================================
 * Defines the entire client-side routing tree using React Router v6.
 *
 * Role-based routing structure:
 *   /login                → public login page (all roles)
 *   /activate/:token      → employee account activation (email link)
 *   /onboarding           → employee first-time onboarding form
 *
 *   /ceo/*                → CEO portal  (role: ceo)
 *   /admin/*              → Admin/HR portal (role: admin or hr)
 *   /employee/*           → Employee self-service portal (role: employee)
 *
 *   /                     → RootRedirect — reads localStorage and sends user
 *                           to the correct dashboard based on their role
 *   *                     → catch-all redirects to /
 *
 * Auth is managed by AuthContext (JWT for admin/HR, session for employees).
 * ProtectedRoute wraps each role group and redirects to /login if not authenticated.
 */

import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';

// Layouts — persistent shell (sidebar + header) for each role
import AdminLayout    from './layout/AdminLayout';
import CEOLayout      from './layout/CEOLayout';
import EmployeeLayout from './layout/EmployeeLayout';

// Public pages
import UnifiedLogin       from './components/UnifiedLogin';
import ActivateAccount    from './components/ActivateAccount';
import EmployeeOnboarding from './components/EmployeeOnboarding';

// CEO pages
import CEODashboardPage from './pages/CEODashboard';
import CEOAnalyticsPage from './pages/CEOAnalytics';

// Admin / HR pages — Employee management
import DashboardPage            from './pages/Dashboard';
import EmployeesPage            from './pages/Employees';
import EmployeeDetailsPage      from './pages/EmployeeDetails';
import EmployeeAdminProfilePage from './pages/EmployeeProfile';
import AnalyticsHubPage         from './pages/AnalyticsHub';
import OrgChartPage             from './pages/OrgChart';
import BankPfEsiPage            from './pages/BankPfEsi';
import FamilyDetailsPage        from './pages/FamilyDetails';
import GenerateLetterPage       from './pages/GenerateLetter';

// Admin / HR pages — Payroll
import PayrollDashboardPage  from './pages/PayrollDashboard';
import PayrollPreviewPage    from './pages/PayrollPreview';
import PayrollRunListPage    from './pages/PayrollRunList';
import PayrollRunDetailPage  from './pages/PayrollRunDetail';
import SalaryTemplatesPage   from './pages/SalaryTemplates';
import SalaryAssignmentPage  from './pages/SalaryAssignment';
import MonthlyInputsPage     from './pages/MonthlyInputs';
import PayrollReportsPage    from './pages/PayrollReports';

// Admin / HR pages — Tax
import TaxDeclarationAdminPage from './pages/TaxDeclarationAdmin';
import TaxSummaryPage          from './pages/TaxSummary';

// Admin / HR pages — Operations
import AttendancePage       from './pages/Attendance';
import LeavesPage           from './pages/Leaves';
import DocumentsPage        from './pages/Documents';
import DirectoryPage        from './pages/Directory';
import MassCommunicationPage from './pages/MassCommunication';
import NotificationsPage    from './pages/Notifications';
import SettingsPage         from './pages/Settings';
import CompanyPoliciesFormsPage from './pages/CompanyPoliciesForms';
import EmployeeSegmentPage      from './pages/EmployeeSegment';

// Help, resources, and footer pages
import RothDeskCommunityPage     from './pages/help/RothDeskCommunity';
import StatutoryCompliancesPage  from './pages/help/StatutoryCompliances';
import KnowledgeCentrePage       from './pages/help/KnowledgeCentre';
import ResourceCentrePage        from './pages/help/ResourceCentre';
import HowToVideosPage           from './pages/help/HowToVideos';
import DocumentationPage         from './pages/help/Documentation';
import HRPoliciesPage            from './pages/help/HRPolicies';
import PayrollCompliancePage     from './pages/help/PayrollCompliance';
import SupportCenterPage         from './pages/help/SupportCenter';
import PrivacyPolicyPage         from './pages/help/PrivacyPolicy';
import TermsOfServicePage        from './pages/help/TermsOfService';
import ContactPage               from './pages/help/Contact';

// Employee self-service pages
import EmployeeDashboardPage  from './pages/EmployeeDashboard';
import EmployeeAttendancePage from './pages/EmployeeAttendance';
import EmployeeLeavesPage     from './pages/EmployeeLeaves';
import EmployeePayslipsPage   from './pages/EmployeePayslips';
import EmployeeSelfProfilePage from './pages/EmployeeSelfProfile';
import TaxDeclarationPage     from './pages/TaxDeclaration';
import RegimeComparisonPage   from './pages/RegimeComparison';

/**
 * RootRedirect
 * Reads the user's role from localStorage and redirects to the correct dashboard.
 * This is the landing page for "/" — users never stay here.
 */
const RootRedirect = () => {
  const userType = localStorage.getItem('userType');
  const userRole = (localStorage.getItem('userRole') || '').toLowerCase();

  if (userType === 'employee' || userRole === 'employee') {
    return <Navigate to="/employee/dashboard" replace />;
  }
  if (userRole === 'ceo') {
    return <Navigate to="/ceo/dashboard" replace />;
  }
  if (userType === 'admin' || userRole === 'admin' || userRole === 'hr') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  // Not logged in — go to login
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      {/* Suspense handles any lazy-loaded chunks while they load */}
      <Suspense 
        fallback={
          <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        }
      >      
        <Routes>

          {/* ----------------------------------------------------------------
              Public Routes — no authentication required
          ---------------------------------------------------------------- */}
          <Route path="/login"              element={<UnifiedLogin />} />
          <Route path="/activate/:token"    element={<ActivateAccount />} />
          <Route path="/onboarding"         element={<EmployeeOnboarding />} />

          {/* ----------------------------------------------------------------
              CEO Routes
              Accessible only to users with role="ceo"
          ---------------------------------------------------------------- */}
          <Route element={<ProtectedRoute role="ceo" />}>
            <Route element={<CEOLayout />}>
              <Route path="/ceo/dashboard"  element={<CEODashboardPage />} />
              <Route path="/ceo/analytics"  element={<CEOAnalyticsPage />} />
            </Route>
          </Route>

          {/* ----------------------------------------------------------------
              Admin / HR Routes
              Accessible to role="admin" or role="hr"
          ---------------------------------------------------------------- */}
          <Route element={<ProtectedRoute role="admin" />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin"                      element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/home"                 element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/employee"             element={<Navigate to="/admin/employees" replace />} />
              <Route path="/admin/employees/home"       element={<Navigate to="/admin/employees" replace />} />
              <Route path="/admin/employees/analytics/home" element={<Navigate to="/admin/employees/analytics" replace />} />
              <Route path="/admin/employees/org-chart/home" element={<Navigate to="/admin/employees/org-chart" replace />} />
              <Route path="/admin/employees/bank-pf-esi/home" element={<Navigate to="/admin/employees/bank-pf-esi" replace />} />
              <Route path="/admin/employees/family-details/home" element={<Navigate to="/admin/employees/family-details" replace />} />
              <Route path="/admin/employees/generate-letter/home" element={<Navigate to="/admin/employees/generate-letter" replace />} />
              <Route path="/admin/payroll/home"        element={<Navigate to="/admin/payroll" replace />} />
              <Route path="/admin/payroll/preview/home" element={<Navigate to="/admin/payroll/preview" replace />} />
              <Route path="/admin/payroll/runs/home"    element={<Navigate to="/admin/payroll/runs" replace />} />
              <Route path="/admin/payroll/salary-templates/home" element={<Navigate to="/admin/payroll/salary-templates" replace />} />
              <Route path="/admin/payroll/salary-assignments/home" element={<Navigate to="/admin/payroll/salary-assignments" replace />} />
              <Route path="/admin/payroll/monthly-inputs/home" element={<Navigate to="/admin/payroll/monthly-inputs" replace />} />
              <Route path="/admin/payroll/reports/home" element={<Navigate to="/admin/payroll/reports" replace />} />
              <Route path="/admin/payroll/tax-declarations/home" element={<Navigate to="/admin/payroll/tax-declarations" replace />} />
              <Route path="/admin/payroll/tax-summary/home" element={<Navigate to="/admin/payroll/tax-summary" replace />} />
              <Route path="/admin/attendance/home"     element={<Navigate to="/admin/attendance" replace />} />
              <Route path="/admin/leaves/home"         element={<Navigate to="/admin/leaves" replace />} />
              <Route path="/admin/documents/home"      element={<Navigate to="/admin/documents" replace />} />
              <Route path="/admin/directory/home"      element={<Navigate to="/admin/directory" replace />} />
              <Route path="/admin/emails/home"         element={<Navigate to="/admin/emails" replace />} />
              <Route path="/admin/notifications/home"  element={<Navigate to="/admin/notifications" replace />} />
              <Route path="/admin/settings/home"       element={<Navigate to="/admin/settings" replace />} />

              {/* Dashboard */}
              <Route path="/admin/dashboard"  element={<DashboardPage />} />

              {/* Employee Management */}
              <Route path="/admin/employees"                        element={<EmployeesPage />} />
              <Route path="/admin/employees/:id"                    element={<EmployeeDetailsPage />} />
              <Route path="/admin/employees/:id/profile"            element={<EmployeeAdminProfilePage />} />
              <Route path="/admin/employees/analytics"              element={<AnalyticsHubPage />} />
              <Route path="/admin/employees/org-chart"              element={<OrgChartPage />} />
              <Route path="/admin/employees/bank-pf-esi"            element={<BankPfEsiPage />} />
              <Route path="/admin/employees/family-details"         element={<FamilyDetailsPage />} />
              <Route path="/admin/employees/generate-letter"        element={<GenerateLetterPage />} />

              {/* Payroll */}
              <Route path="/admin/payroll"                          element={<PayrollDashboardPage />} />
              <Route path="/admin/payroll/preview"                  element={<PayrollPreviewPage />} />
              <Route path="/admin/payroll/runs"                     element={<PayrollRunListPage />} />
              <Route path="/admin/payroll/runs/:runId"              element={<PayrollRunDetailPage />} />
              <Route path="/admin/payroll/salary-templates"         element={<SalaryTemplatesPage />} />
              <Route path="/admin/payroll/salary-assignments"       element={<SalaryAssignmentPage />} />
              <Route path="/admin/payroll/monthly-inputs"           element={<MonthlyInputsPage />} />
              <Route path="/admin/payroll/reports"                  element={<PayrollReportsPage />} />

              {/* Tax */}
              <Route path="/admin/payroll/tax-declarations"         element={<TaxDeclarationAdminPage />} />
              <Route path="/admin/payroll/tax-summary"              element={<TaxSummaryPage />} />

              {/* Operations */}
              <Route path="/admin/attendance"   element={<AttendancePage />} />
              <Route path="/admin/leaves"       element={<LeavesPage />} />
              <Route path="/admin/documents"    element={<DocumentsPage />} />
              <Route path="/admin/directory"    element={<DirectoryPage />} />
              <Route path="/admin/emails"       element={<MassCommunicationPage />} />
              <Route path="/admin/notifications" element={<NotificationsPage />} />
              <Route path="/admin/settings"     element={<SettingsPage />} />
              <Route path="/admin/company-policies-forms" element={<CompanyPoliciesFormsPage />} />
              <Route path="/admin/employee-segment"        element={<EmployeeSegmentPage />} />

              {/* Help, resources, and footer links */}
              <Route path="/admin/help/rothdesk-community"       element={<RothDeskCommunityPage />} />
              <Route path="/admin/help/statutory-compliances"    element={<StatutoryCompliancesPage />} />
              <Route path="/admin/help/knowledge-centre"         element={<KnowledgeCentrePage />} />
              <Route path="/admin/help/resource-centre"          element={<ResourceCentrePage />} />
              <Route path="/admin/help/how-to-videos"            element={<HowToVideosPage />} />
              <Route path="/admin/resources/documentation"       element={<DocumentationPage />} />
              <Route path="/admin/resources/hr-policies"         element={<HRPoliciesPage />} />
              <Route path="/admin/resources/payroll-compliance"  element={<PayrollCompliancePage />} />
              <Route path="/admin/resources/support-center"      element={<SupportCenterPage />} />
              <Route path="/admin/privacy-policy"                element={<PrivacyPolicyPage />} />
              <Route path="/admin/terms-of-service"              element={<TermsOfServicePage />} />
              <Route path="/admin/contact"                       element={<ContactPage />} />

            </Route>
          </Route>

          {/* ----------------------------------------------------------------
              Employee Self-Service Routes
              Accessible only to role="employee"
          ---------------------------------------------------------------- */}
          <Route element={<ProtectedRoute role="employee" />}>
            <Route element={<EmployeeLayout />}>
              <Route path="/employee/dashboard"       element={<EmployeeDashboardPage />} />
              <Route path="/employee/attendance"      element={<EmployeeAttendancePage />} />
              <Route path="/employee/leaves"          element={<EmployeeLeavesPage />} />
              <Route path="/employee/documents"       element={<DocumentsPage />} />
              <Route path="/employee/payslips"        element={<EmployeePayslipsPage />} />
              <Route path="/employee/tax-declaration" element={<TaxDeclarationPage />} />
              <Route path="/employee/tax-regime"      element={<RegimeComparisonPage />} />
              <Route path="/employee/profile"         element={<EmployeeSelfProfilePage />} />
            </Route>
          </Route>

          {/* ----------------------------------------------------------------
              Fallback Routes
          ---------------------------------------------------------------- */}
          <Route path="/"  element={<RootRedirect />} />
          <Route path="*"  element={<Navigate to="/" replace />} />

        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
