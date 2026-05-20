import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Wallet, Clock3,
  CalendarCheck, FolderClosed, BookUser, Settings, Mail,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import TopBar from '@/components/TopBar';
import AppDrawer, { type DrawerNavItem } from '@/components/AppDrawer';

const ADMIN_NAV: DrawerNavItem[] = [
  { label: 'Dashboard',  path: '/admin/dashboard',  icon: LayoutDashboard },
  { label: 'Employees',  path: '/admin/employees',  icon: Users           },
  { label: 'Payroll',    path: '/admin/payroll',    icon: Wallet          },
  { label: 'Attendance', path: '/admin/attendance', icon: Clock3          },
  { label: 'Leaves',     path: '/admin/leaves',     icon: CalendarCheck   },
  { label: 'Documents',  path: '/admin/documents',  icon: FolderClosed    },
  { label: 'Directory',  path: '/admin/directory',  icon: BookUser        },
  { label: 'Emails',     path: '/admin/emails',     icon: Mail            },
  { label: 'Settings',   path: '/admin/settings',   icon: Settings        },
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
        leftIcon={<div />}
        userName={userName}
        userRole="Administrator"
        onLogout={handleLogout}
        showSearch
      />

      <AppDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={ADMIN_NAV}
        userName={userName}
        userRole="Administrator"
      />

      <main className="pt-14 min-h-screen">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
