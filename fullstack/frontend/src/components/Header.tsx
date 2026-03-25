/**
 * Component: components\Header.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React from 'react';
import { LogOut } from 'lucide-react';
import SearchBar from './SearchBar';
import NotificationBell from './NotificationBell';
import Avatar from './Avatar';
import BrandMark from './BrandMark';

interface HeaderProps {
  collapsed: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  userName?: string;
  userRole?: string;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({
  collapsed,
  searchValue,
  onSearchChange,
  userName = 'User',
  userRole = 'Administrator',
  onLogout,
}) => {
  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 border-b border-slate-200 bg-white/95 backdrop-blur transition-all duration-300 ${
        collapsed ? 'left-[84px]' : 'left-72'
      }`}
    >
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="flex items-center gap-2 shrink-0">
            <BrandMark compact className="leading-none" />
          </div>
          <div className="min-w-0 flex-1">
            <SearchBar
              value={searchValue}
              onChange={onSearchChange}
              placeholder="Search employees, payroll, documents..."
            />
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationBell />
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5">
            <Avatar name={userName} size="sm" />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">{userName}</p>
              <p className="text-[11px] text-slate-500">{userRole}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

