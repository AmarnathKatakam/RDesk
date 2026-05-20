import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { label: 'Dashboard',      href: '/admin/payroll' },
  { label: 'Runs',           href: '/admin/payroll/runs' },
  { label: 'Monthly Inputs', href: '/admin/payroll/monthly-inputs' },
  { label: 'Preview',        href: '/admin/payroll/preview' },
  { label: 'Templates',      href: '/admin/payroll/salary-templates' },
  { label: 'Assignments',    href: '/admin/payroll/salary-assignments' },
  { label: 'Reports',        href: '/admin/payroll/reports' },
];

export default function PayrollNav() {
  const { pathname } = useLocation();

  // Exact match for dashboard, prefix match for others
  const isActive = (href: string) =>
    href === '/admin/payroll' ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex gap-0 border-b border-gray-200 mb-6 overflow-x-auto">
      {NAV_ITEMS.map(item => (
        <Link
          key={item.href}
          to={item.href}
          className={[
            'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
            isActive(item.href)
              ? 'text-indigo-600 border-indigo-600'
              : 'text-gray-500 border-transparent hover:text-gray-800 hover:border-gray-300',
          ].join(' ')}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
