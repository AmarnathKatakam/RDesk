import React, { useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, UserCircle, Clock3, CalendarDays, Grid3x3, FolderClosed, Landmark, Scale } from 'lucide-react';
import TopBar from '@/components/TopBar';
import AdminBreadcrumb from '@/components/AdminBreadcrumb';
import AppDrawer, { type DrawerNavItem } from '@/components/AppDrawer';

const EMPLOYEE_NAV: DrawerNavItem[] = [
  { label: 'Dashboard',  path: '/employee/dashboard',  icon: LayoutDashboard },
  { label: 'Attendance', path: '/employee/attendance', icon: Clock3          },
  { label: 'Payslips',   path: '/employee/payslips',   icon: FileText        },
  { label: 'Leaves',     path: '/employee/leaves',     icon: CalendarDays    },
  { label: 'Documents',  path: '/employee/documents',  icon: FolderClosed    },
  { label: 'Tax',        path: '/employee/tax-declaration', icon: Landmark   },
  { label: 'Regime',     path: '/employee/tax-regime', icon: Scale           },
  { label: 'Profile',    path: '/employee/profile',    icon: UserCircle      },
];

const EmployeeLayout: React.FC = () => {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const employee = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); }
    catch { return {}; }
  }, []);

  const handleLogout = () => {
    ['user', 'userType', 'userRole', 'userId', 'authToken'].forEach((k) =>
      localStorage.removeItem(k)
    );
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar
        leftIcon={
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label="Open menu"
            className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${
              drawerOpen ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <Grid3x3 className="h-5 w-5" />
          </button>
        }
        userName={employee?.name || 'Employee'}
        userRole="Employee"
        onLogout={handleLogout}
        showSearch={false}
        onIconClick={() => navigate('/employee/dashboard')}
      />

      <AppDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={EMPLOYEE_NAV}
        userName={employee?.name || 'Employee'}
        userRole="Employee"
        onBrandClick={() => navigate('/employee/dashboard')}
      />

      <main className="pt-14 min-h-screen">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
          <AdminBreadcrumb />
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default EmployeeLayout;
