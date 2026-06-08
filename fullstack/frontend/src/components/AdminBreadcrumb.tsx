import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

type TrailItem = {
  label: string;
  to: string;
};

const getTrail = (pathname: string): TrailItem[] => {
  if (pathname === '/employee/dashboard' || pathname === '/employee') {
    return [
      { label: 'Home', to: '/employee/dashboard' },
      { label: 'Employee', to: '/employee/dashboard' },
      { label: 'Dashboard', to: '/employee/dashboard' },
    ];
  }

  if (pathname.startsWith('/employee')) {
    if (pathname.startsWith('/employee/payslips')) {
      return [
        { label: 'Home', to: '/employee/dashboard' },
        { label: 'Employee', to: '/employee/dashboard' },
        { label: 'Payslips', to: '/employee/payslips' },
      ];
    }

    if (pathname.startsWith('/employee/attendance')) {
      return [
        { label: 'Home', to: '/employee/dashboard' },
        { label: 'Employee', to: '/employee/dashboard' },
        { label: 'Attendance', to: '/employee/attendance' },
      ];
    }

    if (pathname.startsWith('/employee/leaves')) {
      return [
        { label: 'Home', to: '/employee/dashboard' },
        { label: 'Employee', to: '/employee/dashboard' },
        { label: 'Leaves', to: '/employee/leaves' },
      ];
    }

    if (pathname.startsWith('/employee/documents')) {
      return [
        { label: 'Home', to: '/employee/dashboard' },
        { label: 'Employee', to: '/employee/dashboard' },
        { label: 'Documents', to: '/employee/documents' },
      ];
    }

    if (pathname.startsWith('/employee/tax')) {
      return [
        { label: 'Home', to: '/employee/dashboard' },
        { label: 'Employee', to: '/employee/dashboard' },
        { label: 'Tax', to: '/employee/tax' },
      ];
    }

    if (pathname.startsWith('/employee/regime')) {
      return [
        { label: 'Home', to: '/employee/dashboard' },
        { label: 'Employee', to: '/employee/dashboard' },
        { label: 'Regime', to: '/employee/regime' },
      ];
    }

    if (pathname.startsWith('/employee/profile')) {
      return [
        { label: 'Home', to: '/employee/dashboard' },
        { label: 'Employee', to: '/employee/dashboard' },
        { label: 'Profile', to: '/employee/profile' },
      ];
    }

    return [
      { label: 'Home', to: '/employee/dashboard' },
      { label: 'Employee', to: '/employee/dashboard' },
    ];
  }

  if (pathname === '/admin/payroll/runs' || pathname.startsWith('/admin/payroll/runs/')) {
    if (pathname === '/admin/payroll/runs') {
      return [
        { label: 'Home', to: '/admin/dashboard' },
        { label: 'Payroll', to: '/admin/payroll' },
        { label: 'Runs', to: '/admin/payroll/runs' },
      ];
    }

    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Payroll', to: '/admin/payroll' },
      { label: 'Runs', to: '/admin/payroll/runs' },
      { label: 'Run Details', to: pathname },
    ];
  }

  if (pathname === '/admin/dashboard' || pathname === '/admin' || pathname === '/admin/home') {
    return [{ label: 'Home', to: '/admin/dashboard' }];
  }

  if (pathname === '/admin/employees') {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Employee', to: '/admin/employees' },
    ];
  }

  if (pathname === '/admin/documents') {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Employee', to: '/admin/employees' },
      { label: 'Document', to: '/admin/documents' },
    ];
  }

  if (pathname === '/admin/emails') {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Employee', to: '/admin/employees' },
      { label: 'Email', to: '/admin/emails' },
    ];
  }

  if (pathname === '/admin/company-policies-forms') {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Employee', to: '/admin/employees' },
      { label: 'Company Policies', to: '/admin/company-policies-forms' },
    ];
  }

  if (pathname === '/admin/employee-segment') {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Employee', to: '/admin/employees' },
      { label: 'Employee Segment', to: '/admin/employee-segment' },
    ];
  }

  if (pathname.startsWith('/admin/employees/analytics')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Employee', to: '/admin/employees' },
      { label: 'Analytics Hub', to: '/admin/employees/analytics' },
    ];
  }

  if (pathname.startsWith('/admin/employees/org-chart')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Employee', to: '/admin/employees' },
      { label: 'Org Chart', to: '/admin/employees/org-chart' },
    ];
  }

  if (pathname.startsWith('/admin/employees/bank-pf-esi')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Employee', to: '/admin/employees' },
      { label: 'Bank / PF / ESI', to: '/admin/employees/bank-pf-esi' },
    ];
  }

  if (pathname.startsWith('/admin/employees/family-details')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Employee', to: '/admin/employees' },
      { label: 'Family Details', to: '/admin/employees/family-details' },
    ];
  }

  if (pathname.startsWith('/admin/employees/generate-letter')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Employee', to: '/admin/employees' },
      { label: 'Generate Letter', to: '/admin/employees/generate-letter' },
    ];
  }

  if (pathname.startsWith('/admin/employees/')) {
    if (pathname.includes('/profile')) {
      return [
        { label: 'Home', to: '/admin/dashboard' },
        { label: 'Employee', to: '/admin/employees' },
        { label: 'Profile', to: '/admin/employees' },
      ];
    }

    if (pathname !== '/admin/employees') {
      return [
        { label: 'Home', to: '/admin/dashboard' },
        { label: 'Employee', to: '/admin/employees' },
        { label: 'Employee Details', to: pathname },
      ];
    }

    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Employee', to: '/admin/employees' },
    ];
  }

  if (pathname.startsWith('/admin/payroll/preview')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Payroll', to: '/admin/payroll' },
      { label: 'Preview', to: '/admin/payroll/preview' },
    ];
  }

  if (pathname.startsWith('/admin/payroll/salary-templates')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Payroll', to: '/admin/payroll' },
      { label: 'Salary Templates', to: '/admin/payroll/salary-templates' },
    ];
  }

  if (pathname.startsWith('/admin/payroll/salary-assignments')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Payroll', to: '/admin/payroll' },
      { label: 'Salary Assignments', to: '/admin/payroll/salary-assignments' },
    ];
  }

  if (pathname.startsWith('/admin/payroll/monthly-inputs')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Payroll', to: '/admin/payroll' },
      { label: 'Monthly Inputs', to: '/admin/payroll/monthly-inputs' },
    ];
  }

  if (pathname.startsWith('/admin/payroll/reports')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Payroll', to: '/admin/payroll' },
      { label: 'Reports', to: '/admin/payroll/reports' },
    ];
  }

  if (pathname.startsWith('/admin/payroll/tax-declarations')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Payroll', to: '/admin/payroll' },
      { label: 'Tax Declarations', to: '/admin/payroll/tax-declarations' },
    ];
  }

  if (pathname.startsWith('/admin/payroll/tax-summary')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Payroll', to: '/admin/payroll' },
      { label: 'Tax Summary', to: '/admin/payroll/tax-summary' },
    ];
  }

  if (pathname.startsWith('/admin/payroll')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Payroll', to: '/admin/payroll' },
    ];
  }

  if (pathname.startsWith('/admin/attendance')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Attendance', to: '/admin/attendance' },
    ];
  }

  if (pathname.startsWith('/admin/leaves')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Leaves', to: '/admin/leaves' },
    ];
  }

  if (pathname.startsWith('/admin/documents')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Documents', to: '/admin/documents' },
    ];
  }

  if (pathname.startsWith('/admin/directory')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Directory', to: '/admin/directory' },
    ];
  }

  if (pathname.startsWith('/admin/emails')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Emails', to: '/admin/emails' },
    ];
  }

  if (pathname.startsWith('/admin/notifications')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Notifications', to: '/admin/notifications' },
    ];
  }

  if (pathname.startsWith('/admin/settings')) {
    return [
      { label: 'Home', to: '/admin/dashboard' },
      { label: 'Settings', to: '/admin/settings' },
    ];
  }

  return [{ label: 'Home', to: '/admin/dashboard' }];
};

const AdminBreadcrumb: React.FC = () => {
  const { pathname } = useLocation();
  const trail = getTrail(pathname);

  return (
    <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
      {trail.map((item, index) => {
        const isLast = index === trail.length - 1;
        return (
          <React.Fragment key={`${item.to}-${item.label}`}>
            {index > 0 && <ChevronRight className="h-3 w-3" />}
            {isLast ? (
              <span className="text-slate-600 font-medium">{item.label}</span>
            ) : (
              <Link to={item.to} className="hover:text-slate-600 transition-colors">
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default AdminBreadcrumb;