import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { label: 'Dashboard',          path: '/admin/payroll' },
  { label: 'Payroll Runs',       path: '/admin/payroll/runs' },
  { label: 'Monthly Inputs',     path: '/admin/payroll/monthly-inputs' },
  { label: 'Salary Templates',   path: '/admin/payroll/salary-templates' },
  { label: 'Salary Assignments', path: '/admin/payroll/salary-assignments' },
];

export default function PayrollNav() {
  const { pathname } = useLocation();

  // Exact match for dashboard, prefix match for others
  const isActive = (path: string) =>
    path === '/admin/payroll'
      ? pathname === '/admin/payroll'
      : pathname.startsWith(path);

  return (
    <div className="flex gap-0 border-b border-gray-200 mb-6 overflow-x-auto">
      {NAV_ITEMS.map(item => (
        <Link
          key={item.path}
          to={item.path}
          className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
            isActive(item.path)
              ? 'text-indigo-600 border-indigo-600'
              : 'text-gray-500 border-transparent hover:text-gray-800 hover:border-gray-300'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
