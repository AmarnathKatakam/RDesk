import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';

// ─── Menu config ──────────────────────────────────────────────────────────────

interface DropdownItem { label: string; path: string; }
interface NavItem {
  label: string;
  active?: boolean;
  path?: string;
  items?: DropdownItem[];
}

const MENU: NavItem[] = [
  { label: 'Employee', path: '/admin/employees', active: true },
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
      { label: 'Bank / PF / ESI',    path: '/admin/documents'  },
      { label: 'Family Details',     path: '/admin/documents'  },
      { label: 'Passport & Visa',    path: '/admin/documents'  },
      { label: 'Position History',   path: '/admin/employees'  },
      { label: 'Separation',         path: '/admin/employees'  },
      { label: 'Nomination Details', path: '/admin/documents'  },
      { label: 'Employee Documents', path: '/admin/documents'  },
      { label: 'Employee Salary',    path: '/admin/payroll'    },
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

// ─── Dropdown panel ───────────────────────────────────────────────────────────

const DropdownPanel: React.FC<{ items: DropdownItem[]; onNav: (p: string) => void }> = ({ items, onNav }) => (
  <div
    className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-[200px] bg-white rounded-xl shadow-lg border border-slate-100 py-1.5"
    style={{ animation: 'emp-dd 0.13s ease-out' }}
  >
    {items.map((item) => (
      <button
        key={item.label}
        onClick={() => onNav(item.path)}
        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left group"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-emerald-500 shrink-0 transition-colors" />
        {item.label}
      </button>
    ))}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  pageView: 'dashboard' | 'table';
  onViewChange: (v: 'dashboard' | 'table') => void;
  onAddEmployee: () => void;
}

const EmployeeModuleNav: React.FC<Props> = ({ pageView, onViewChange, onAddEmployee }) => {
  const navigate = useNavigate();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenKey(null);
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

  const handleNav = (path: string) => {
    navigate(path);
    setOpenKey(null);
    setMobileOpen(false);
  };

  return (
    <>
      <style>{`
        @keyframes emp-dd {
          from { opacity: 0; transform: translateY(-5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Breadcrumb ── */}
      <p className="text-xs text-slate-400 mb-1">Home &rsaquo; Employee</p>

      {/* ── Nav bar ── */}
      <div ref={ref} className="bg-white rounded-2xl border border-slate-100 shadow-sm">

        {/* Desktop row */}
        <div className="hidden md:flex items-center justify-between px-4 h-12">

          {/* Left: menu items */}
          <div className="flex items-center gap-0.5">
            {MENU.map((item) => {
              const isOpen = openKey === item.label;
              const hasDD = !!item.items?.length;

              return (
                <div key={item.label} className="relative">
                  <button
                    onClick={() => {
                      if (hasDD) { setOpenKey(isOpen ? null : item.label); }
                      else if (item.path) handleNav(item.path);
                    }}
                    className={`h-8 px-3 rounded-lg inline-flex items-center gap-1 text-sm font-medium transition-all ${
                      item.active
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                    {hasDD && (
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                    )}
                  </button>

                  {hasDD && isOpen && item.items && (
                    <DropdownPanel items={item.items} onNav={handleNav} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: view toggle + add button */}
          <div className="flex items-center gap-2">
            <div className="inline-flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => onViewChange('dashboard')}
                className={`h-7 px-3 rounded-md text-xs font-medium transition-all ${pageView === 'dashboard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Overview
              </button>
              <button
                onClick={() => onViewChange('table')}
                className={`h-7 px-3 rounded-md text-xs font-medium transition-all ${pageView === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Table
              </button>
            </div>
            <button
              onClick={onAddEmployee}
              className="h-8 px-3 rounded-lg bg-blue-900 text-white text-xs font-medium inline-flex items-center gap-1.5 hover:bg-blue-800 transition-colors"
            >
              + Add Employee
            </button>
          </div>
        </div>

        {/* Mobile row */}
        <div className="md:hidden flex items-center justify-between px-4 h-12">
          <span className="text-sm font-semibold text-emerald-700">Employee</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onAddEmployee}
              className="h-8 px-3 rounded-lg bg-blue-900 text-white text-xs font-medium"
            >
              + Add
            </button>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile accordion */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-100 pb-2">
            {MENU.map((item) => <MobileItem key={item.label} item={item} onNav={handleNav} />)}
            <div className="flex gap-2 px-4 pt-3">
              <button onClick={() => { onViewChange('dashboard'); setMobileOpen(false); }} className={`flex-1 h-8 rounded-lg text-xs font-medium border ${pageView === 'dashboard' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600'}`}>Overview</button>
              <button onClick={() => { onViewChange('table'); setMobileOpen(false); }} className={`flex-1 h-8 rounded-lg text-xs font-medium border ${pageView === 'table' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600'}`}>Table</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ─── Mobile accordion item ────────────────────────────────────────────────────

const MobileItem: React.FC<{ item: NavItem; onNav: (p: string) => void }> = ({ item, onNav }) => {
  const [open, setOpen] = useState(false);
  if (!item.items) {
    return (
      <button
        onClick={() => item.path && onNav(item.path)}
        className={`w-full text-left px-4 py-2.5 text-sm font-medium border-b border-slate-50 ${item.active ? 'text-emerald-700' : 'text-slate-700'}`}
      >
        {item.label}
      </button>
    );
  }
  return (
    <div className="border-b border-slate-50">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700">
        {item.label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="bg-slate-50 pb-1">
          {item.items.map((sub) => (
            <button key={sub.label} onClick={() => onNav(sub.path)} className="w-full flex items-center gap-2 px-7 py-2 text-sm text-slate-600 hover:text-slate-900">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
              {sub.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeeModuleNav;
