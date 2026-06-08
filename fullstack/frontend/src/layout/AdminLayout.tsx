import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Wallet, Clock3,
  CalendarCheck, FolderClosed, BookUser, Settings, Mail,
  Grid3x3, BarChart3, Network, Landmark, Bell,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import TopBar from '@/components/TopBar';
import AppDrawer, { type DrawerNavItem } from '@/components/AppDrawer';
import AdminBreadcrumb from '@/components/AdminBreadcrumb';

const ADMIN_NAV: DrawerNavItem[] = [
  { label: 'Dashboard',        path: '/admin/dashboard',                 icon: LayoutDashboard },
  { label: 'Employees',        path: '/admin/employees',                 icon: Users           },
  { label: 'Analytics',        path: '/admin/employees/analytics',       icon: BarChart3       },
  { label: 'Org Chart',        path: '/admin/employees/org-chart',       icon: Network         },
  { label: 'Bank PF ESI',      path: '/admin/employees/bank-pf-esi',     icon: Landmark        },
  { label: 'Payroll',          path: '/admin/payroll',                   icon: Wallet          },
  { label: 'Attendance',       path: '/admin/attendance',                icon: Clock3          },
  { label: 'Leaves',           path: '/admin/leaves',                    icon: CalendarCheck   },
  { label: 'Documents',        path: '/admin/documents',                 icon: FolderClosed    },
  { label: 'Directory',        path: '/admin/directory',                 icon: BookUser        },
  { label: 'Emails',           path: '/admin/emails',                    icon: Mail            },
  { label: 'Notifications',    path: '/admin/notifications',             icon: Bell            },
  { label: 'Settings',         path: '/admin/settings',                  icon: Settings        },
];

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = async () => {
    try { await logout(); } catch { /* ignore */ } finally {
      ['user', 'userType', 'userRole', 'userId', 'authToken'].forEach((k) =>
        localStorage.removeItem(k)
      );
      navigate('/login');
    }
  };

  const userName = user?.full_name || user?.username || 'Admin';

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar
        leftIcon={
          <button
            onClick={() => setDrawerOpen((value) => !value)}
            aria-label="Open admin menu"
            className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${
              drawerOpen ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <Grid3x3 className="h-5 w-5" />
          </button>
        }
        userName={userName}
        userRole="Administrator"
        onLogout={handleLogout}
        showSearch
        onIconClick={() => navigate('/admin/dashboard')}
      />

      <AppDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={ADMIN_NAV}
        userName={userName}
        userRole="Administrator"
        onBrandClick={() => navigate('/admin/dashboard')}
      />

      <main className="pt-14 min-h-screen">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          <AdminBreadcrumb />
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
