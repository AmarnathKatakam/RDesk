import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppLauncher from '@/components/AppLauncher';
import NotificationBell from '@/components/NotificationBell';
import Avatar from '@/components/Avatar';

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [search, setSearch] = useState('');

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
      <header className="fixed top-0 inset-x-0 z-40 h-14 bg-white border-b border-slate-200 shadow-sm">
        <div className="h-full px-4 flex items-center gap-3">
          <AppLauncher />
          <div className="flex items-center gap-2 shrink-0">
            <img src="/logo.svg" alt="RothDesk" className="h-7 w-auto" />
          </div>
          <div className="flex-1 max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employees, payroll, documents…"
                className="w-full h-9 pl-9 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <NotificationBell />
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5">
              <Avatar name={userName} size="sm" />
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-900">{userName}</p>
                <p className="text-[11px] text-slate-500">Administrator</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>
      <main className="pt-14 min-h-screen">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
