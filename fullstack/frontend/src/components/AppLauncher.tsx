import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Wallet, Clock3, CalendarCheck,
  FolderClosed, BookUser, Settings, Grid3x3,
} from 'lucide-react';

interface AppItem {
  label: string;
  path: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

const APPS: AppItem[] = [
  { label: 'Dashboard',   path: '/admin/dashboard',  icon: LayoutDashboard, iconColor: 'text-blue-600',   iconBg: 'bg-blue-50'   },
  { label: 'Employees',   path: '/admin/employees',  icon: Users,           iconColor: 'text-indigo-600', iconBg: 'bg-indigo-50' },
  { label: 'Payroll',     path: '/admin/payroll',    icon: Wallet,          iconColor: 'text-orange-600', iconBg: 'bg-orange-50' },
  { label: 'Attendance',  path: '/admin/attendance', icon: Clock3,          iconColor: 'text-cyan-600',   iconBg: 'bg-cyan-50'   },
  { label: 'Leaves',      path: '/admin/leaves',     icon: CalendarCheck,   iconColor: 'text-yellow-600', iconBg: 'bg-yellow-50' },
  { label: 'Documents',   path: '/admin/documents',  icon: FolderClosed,    iconColor: 'text-rose-600',   iconBg: 'bg-rose-50'   },
  { label: 'Directory',   path: '/admin/directory',  icon: BookUser,        iconColor: 'text-purple-600', iconBg: 'bg-purple-50' },
  { label: 'Settings',    path: '/admin/settings',   icon: Settings,        iconColor: 'text-slate-600',  iconBg: 'bg-slate-100' },
];

const AppLauncher: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleNav = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* 9-dot trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="App launcher"
        className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${
          open ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
        }`}
      >
        <Grid3x3 className="h-5 w-5" />
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute left-0 top-12 z-50 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-3"
          style={{ animation: 'rd-launcher-in 0.15s ease-out' }}
        >
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
            Modules
          </p>
          <div className="space-y-0.5">
            {APPS.map((app) => {
              const isActive = location.pathname.startsWith(app.path);
              return (
                <button
                  key={app.path}
                  onClick={() => handleNav(app.path)}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-all duration-150 group ${
                    isActive
                      ? 'bg-blue-50 text-blue-800'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className={`h-8 w-8 rounded-lg ${app.iconBg} flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105`}>
                    <app.icon className={`h-4 w-4 ${app.iconColor}`} />
                  </div>
                  <span className="text-sm font-medium">{app.label}</span>
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes rd-launcher-in {
          from { opacity: 0; transform: scale(0.95) translateY(-6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default AppLauncher;
