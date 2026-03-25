import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Settings, LogOut, ChevronDown, Menu, X } from 'lucide-react';
import AppLauncher from './AppLauncher';
import NotificationBell from './NotificationBell';
import Avatar from './Avatar';

// ─── Dropdown config ──────────────────────────────────────────────────────────

interface DropdownItem {
  label: string;
  path?: string;
}

interface NavMenuItem {
  label: string;
  path?: string;           // direct link (no dropdown)
  activePrefix?: string;   // highlight when route starts with this
  items?: DropdownItem[];
}

const NAV_MENU: NavMenuItem[] = [
  {
    label: 'Employee',
    path: '/admin/employees',
    activePrefix: '/admin/employees',
  },
  {
    label: 'Main',
    items: [
      { label: 'Analytics Hub',      path: '/admin/dashboard'  },
      { label: 'Organisation Chart', path: '/admin/directory'  },
    ],
  },
  {
    label: 'Information',
    items: [
      { label: 'Bank / PF / ESI',     path: '/admin/documents'  },
      { label: 'Family Details',      path: '/admin/documents'  },
      { label: 'Passport & Visa',     path: '/admin/documents'  },
      { label: 'Position History',    path: '/admin/employees'  },
      { label: 'Separation',          path: '/admin/employees'  },
      { label: 'Nomination Details',  path: '/admin/documents'  },
      { label: 'Employee Documents',  path: '/admin/documents'  },
      { label: 'Employee Salary',     path: '/admin/payroll'    },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Generate Letter',    path: '/admin/documents'  },
      { label: 'Excel Import',       path: '/admin/employees'  },
      { label: 'Bulletin Board',     path: '/admin/directory'  },
      { label: 'Mass Communication', path: '/admin/emails'     },
    ],
  },
  {
    label: 'Setup',
    items: [
      { label: 'Company Policies & Forms', path: '/admin/settings' },
      { label: 'Employee Segment',         path: '/admin/settings' },
    ],
  },
];

// ─── DropdownMenu ─────────────────────────────────────────────────────────────

interface DropdownMenuProps {
  items: DropdownItem[];
  onNavigate: (path: string) => void;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ items, onNavigate }) => (
  <div
    className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-[210px] bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 overflow-hidden"
    style={{ animation: 'rd-dd-in 0.14s ease-out' }}
  >
    {items.map((item) => (
      <button
        key={item.label}
        onClick={() => item.path && onNavigate(item.path)}
        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left group"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-blue-500 transition-colors shrink-0" />
        {item.label}
      </button>
    ))}
  </div>
);

// ─── NavItem ──────────────────────────────────────────────────────────────────

interface NavItemProps {
  item: NavMenuItem;
  isActive: boolean;
  openKey: string | null;
  onOpen: (label: string | null) => void;
  onNavigate: (path: string) => void;
}

const NavItem: React.FC<NavItemProps> = ({ item, isActive, openKey, onOpen, onNavigate }) => {
  const isOpen = openKey === item.label;
  const hasDropdown = !!item.items?.length;

  const handleClick = () => {
    if (hasDropdown) {
      onOpen(isOpen ? null : item.label);
    } else if (item.path) {
      onNavigate(item.path);
      onOpen(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={`h-8 px-3 rounded-lg inline-flex items-center gap-1 text-sm font-medium transition-all duration-150 whitespace-nowrap ${
          isActive
            ? 'bg-emerald-50 text-emerald-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        {item.label}
        {hasDropdown && (
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {hasDropdown && isOpen && item.items && (
        <DropdownMenu items={item.items} onNavigate={(path) => { onNavigate(path); onOpen(null); }} />
      )}
    </div>
  );
};

// ─── HrmsNavbar ───────────────────────────────────────────────────────────────

interface HrmsNavbarProps {
  userName: string;
  onLogout: () => void;
}

const HrmsNavbar: React.FC<HrmsNavbarProps> = ({ userName, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpenKey(null); setMobileOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <>
      <style>{`
        @keyframes rd-dd-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <header className="fixed top-0 inset-x-0 z-40 h-14 bg-white border-b border-slate-200 shadow-sm">
        <div ref={navRef} className="h-full px-3 sm:px-5 flex items-center gap-2">

          {/* ── Left: launcher + logo + nav ── */}
          <AppLauncher />

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0 mr-2">
            <img src="/logo.svg" alt="BlackRoth" className="h-7 w-auto" />
          </div>

          {/* Primary nav — hidden on mobile */}
          <nav className="hidden md:flex items-center gap-0.5">
            {NAV_MENU.map((item) => {
              const isActive = item.activePrefix
                ? location.pathname.startsWith(item.activePrefix)
                : false;
              return (
                <NavItem
                  key={item.label}
                  item={item}
                  isActive={isActive}
                  openKey={openKey}
                  onOpen={setOpenKey}
                  onNavigate={handleNavigate}
                />
              );
            })}
          </nav>

          {/* ── Right ── */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Search */}
            <div className="hidden lg:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="h-8 w-48 pl-8 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            <NotificationBell />

            <button
              onClick={() => navigate('/admin/settings')}
              className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>

            {/* User pill */}
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1">
              <Avatar name={userName} size="sm" />
              <span className="text-xs font-semibold text-slate-800 max-w-[80px] truncate">{userName}</span>
            </div>

            <button
              onClick={onLogout}
              className="h-8 w-8 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* ── Mobile accordion menu ── */}
        {mobileOpen && (
          <div className="md:hidden absolute top-14 inset-x-0 bg-white border-b border-slate-200 shadow-lg z-50 max-h-[70vh] overflow-y-auto">
            {NAV_MENU.map((item) => (
              <MobileNavItem key={item.label} item={item} onNavigate={handleNavigate} location={location.pathname} />
            ))}
          </div>
        )}
      </header>
    </>
  );
};

// ─── Mobile accordion item ────────────────────────────────────────────────────

const MobileNavItem: React.FC<{ item: NavMenuItem; onNavigate: (p: string) => void; location: string }> = ({
  item, onNavigate, location,
}) => {
  const [open, setOpen] = useState(false);
  const isActive = item.activePrefix ? location.startsWith(item.activePrefix) : false;

  if (!item.items) {
    return (
      <button
        onClick={() => item.path && onNavigate(item.path)}
        className={`w-full flex items-center px-5 py-3 text-sm font-medium border-b border-slate-100 ${isActive ? 'text-emerald-700 bg-emerald-50' : 'text-slate-700'}`}
      >
        {item.label}
      </button>
    );
  }

  return (
    <div className="border-b border-slate-100">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-slate-700"
      >
        {item.label}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="bg-slate-50 pb-1">
          {item.items.map((sub) => (
            <button
              key={sub.label}
              onClick={() => sub.path && onNavigate(sub.path)}
              className="w-full flex items-center gap-2 px-8 py-2.5 text-sm text-slate-600 hover:text-slate-900"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
              {sub.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default HrmsNavbar;
