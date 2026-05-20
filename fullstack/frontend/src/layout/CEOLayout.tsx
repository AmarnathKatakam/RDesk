import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, LogOut,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import TopBar from '@/components/TopBar';
import AppDrawer, { type DrawerNavItem } from '@/components/AppDrawer';

// CEO has limited navigation - focused on analytics & dashboards
const CEO_NAV: DrawerNavItem[] = [
  { label: 'Dashboard',  path: '/ceo/dashboard',  icon: LayoutDashboard },
  { label: 'Analytics',  path: '/ceo/analytics',  icon: TrendingUp      },
];

const CEOLayout: React.FC = () => {
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

  const userName = user?.full_name || user?.username || 'CEO';

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar
        leftIcon={<div />}
        userName={userName}
        userRole="Chief Executive Officer"
        onLogout={handleLogout}
        showSearch={false}
        onIconClick={() => setDrawerOpen((v) => !v)}
      />

      <AppDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={CEO_NAV}
        userName={userName}
        userRole="Chief Executive Officer"
      />

      <main className="pt-14 min-h-screen">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default CEOLayout;
