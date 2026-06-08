/**
 * AppDrawer — shared slide-out left navigation drawer.
 * Used by both Admin (via AppLauncher) and Employee layouts.
 * Branding: BrandMark (employee style)
 * Behavior: Admin-style toggle + overlay
 */
import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import BrandMark from './BrandMark';

export interface DrawerNavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AppDrawerProps {
  open: boolean;
  onClose: () => void;
  items: DrawerNavItem[];
  userName?: string;
  userRole?: string;
  onBrandClick?: () => void;
}

const AppDrawer: React.FC<AppDrawerProps> = ({ open, onClose, items, userName, userRole, onBrandClick }) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        ref={drawerRef}
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-slate-200 shadow-xl flex flex-col transition-transform duration-250 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <BrandMark compact onIconClick={onBrandClick} />
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-colors"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-50 to-purple-50 text-teal-700 border border-teal-100'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-gradient-to-br from-teal-500 to-purple-600' : 'bg-slate-100'
                  }`}>
                    <item.icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  </div>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer user info */}
        {userName && (
          <div className="p-4 border-t border-slate-100 shrink-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{userName}</p>
            {userRole && <p className="text-xs text-slate-400">{userRole}</p>}
          </div>
        )}
      </aside>
    </>
  );
};

export default AppDrawer;
