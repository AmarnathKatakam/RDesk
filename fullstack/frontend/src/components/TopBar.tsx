/**
 * TopBar — shared top navigation bar.
 * Used by both Admin and Employee layouts.
 * Left: leftIcon slot (caller provides the single toggle icon) + BrandMark
 * Right: search (optional) + notifications + user + logout
 */
import React, { useState } from 'react';
import { LogOut, Search } from 'lucide-react';
import BrandMark from './BrandMark';
import NotificationBell from './NotificationBell';
import Avatar from './Avatar';

interface TopBarProps {
  /** Single icon rendered at the far left — caller owns this (9-dot, hamburger, etc.) */
  leftIcon: React.ReactNode;
  userName: string;
  userRole?: string;
  onLogout: () => void;
  showSearch?: boolean;
  onIconClick?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  leftIcon,
  userName,
  userRole,
  onLogout,
  showSearch = true,
  onIconClick,
}) => {
  const [search, setSearch] = useState('');

  return (
    <header className="fixed top-0 inset-x-0 z-40 h-14 bg-white border-b border-slate-200 shadow-sm">
      <div className="h-full px-3 sm:px-5 flex items-center gap-2">

        {/* Single left icon — provided by caller */}
        {leftIcon}

        {/* Brand */}
        <BrandMark compact className="shrink-0 mr-2" onIconClick={onIconClick} />

        {/* Search */}
        {showSearch && (
          <div className="flex-1 max-w-md mx-auto hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full h-8 pl-8 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-xs outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
              />
            </div>
          </div>
        )}

        {/* Right */}
        <div className="flex items-center gap-1.5 ml-auto">
          <NotificationBell />

          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5">
            <Avatar name={userName} size="sm" />
            <div className="leading-tight">
              <p className="text-xs font-semibold text-slate-900 max-w-[90px] truncate">{userName}</p>
              {userRole && <p className="text-[10px] text-slate-400">{userRole}</p>}
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Logout"
            className="h-8 w-8 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
