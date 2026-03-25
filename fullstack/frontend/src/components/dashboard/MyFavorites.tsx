import React, { useCallback, useEffect, useState } from 'react';
import {
  UserPlus, FileText, Wallet, Building2, Clock, Calendar,
  BarChart3, Users, Send, KeyRound, ClipboardCheck, Star,
  Plus, X, Search,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── Action catalogue ────────────────────────────────────────────────────────

export interface Action {
  id: string;
  title: string;
  icon: React.ElementType;
  category: 'Employee' | 'Payroll' | 'Attendance' | 'Leave' | 'Reports' | 'Other';
  path: string;
  iconColor: string;
  iconBg: string;
  cardBg: string;
}

const ALL_ACTIONS: Action[] = [
  { id: 'add-employee',       title: 'Add Employee',            icon: UserPlus,       category: 'Employee',   path: '/admin/employees',  iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    cardBg: 'bg-blue-50'    },
  { id: 'regen-password',     title: 'Regenerate Password',     icon: KeyRound,       category: 'Employee',   path: '/admin/employees',  iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    cardBg: 'bg-blue-50'    },
  { id: 'employee-directory', title: 'Employee Directory',      icon: Users,          category: 'Employee',   path: '/admin/directory',  iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    cardBg: 'bg-blue-50'    },
  { id: 'process-payroll',    title: 'Process Payroll',         icon: Wallet,         category: 'Payroll',    path: '/admin/payroll',    iconColor: 'text-orange-600',  iconBg: 'bg-orange-100',  cardBg: 'bg-orange-50'  },
  { id: 'generate-payslip',   title: 'Generate Payslip',        icon: FileText,       category: 'Payroll',    path: '/admin/payroll',    iconColor: 'text-orange-600',  iconBg: 'bg-orange-100',  cardBg: 'bg-orange-50'  },
  { id: 'salary-structure',   title: 'Salary Structure',        icon: Building2,      category: 'Payroll',    path: '/admin/settings',   iconColor: 'text-orange-600',  iconBg: 'bg-orange-100',  cardBg: 'bg-orange-50'  },
  { id: 'send-payslips',      title: 'Send Payslips',           icon: Send,           category: 'Payroll',    path: '/admin/payroll',    iconColor: 'text-orange-600',  iconBg: 'bg-orange-100',  cardBg: 'bg-orange-50'  },
  { id: 'attendance-report',  title: 'Attendance Report',       icon: Clock,          category: 'Attendance', path: '/admin/attendance', iconColor: 'text-cyan-600',    iconBg: 'bg-cyan-100',    cardBg: 'bg-cyan-50'    },
  { id: 'attendance-muster',  title: 'Attendance Muster',       icon: ClipboardCheck, category: 'Attendance', path: '/admin/attendance', iconColor: 'text-cyan-600',    iconBg: 'bg-cyan-100',    cardBg: 'bg-cyan-50'    },
  { id: 'leave-requests',     title: 'Leave Requests',          icon: Calendar,       category: 'Leave',      path: '/admin/leaves',     iconColor: 'text-yellow-600',  iconBg: 'bg-yellow-100',  cardBg: 'bg-yellow-50'  },
  { id: 'leave-approvals',    title: 'Leave Approvals',         icon: ClipboardCheck, category: 'Leave',      path: '/admin/leaves',     iconColor: 'text-yellow-600',  iconBg: 'bg-yellow-100',  cardBg: 'bg-yellow-50'  },
  { id: 'payroll-reports',    title: 'Payroll Reports',         icon: BarChart3,      category: 'Reports',    path: '/admin/directory',  iconColor: 'text-purple-600',  iconBg: 'bg-purple-100',  cardBg: 'bg-purple-50'  },
];

const DEFAULT_FAVORITES = ['add-employee', 'regen-password', 'process-payroll', 'generate-payslip', 'attendance-muster', 'leave-requests'];
const STORAGE_KEY = 'rothdesk_favorites';
const MAX_FAVORITES = 8;

type FilterChip = 'All' | 'My Favorites' | Action['category'];
const CHIPS: FilterChip[] = ['All', 'My Favorites', 'Employee', 'Payroll', 'Attendance', 'Leave', 'Reports', 'Other'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* ignore */ }
  return DEFAULT_FAVORITES;
}

function saveFavorites(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  favorites: string[];
  onToggle: (id: string) => void;
}

const FavoritesModal: React.FC<ModalProps> = ({ open, onClose, favorites, onToggle }) => {
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<FilterChip>('All');

  useEffect(() => {
    if (!open) { setQuery(''); setChip('All'); }
  }, [open]);

  // close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const filtered = ALL_ACTIONS.filter((a) => {
    const matchesQuery = a.title.toLowerCase().includes(query.toLowerCase());
    if (chip === 'All') return matchesQuery;
    if (chip === 'My Favorites') return matchesQuery && favorites.includes(a.id);
    return matchesQuery && a.category === chip;
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15,23,42,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        style={{ animation: 'rd-modal-in 0.18s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-base font-semibold text-slate-800">Customize Quick Actions</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search here"
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* Filter chips */}
        <div className="px-5 pb-3 flex gap-2 overflow-x-auto scrollbar-none">
          {CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              className={`shrink-0 h-7 px-3 rounded-full text-xs font-medium transition-all ${
                chip === c
                  ? 'bg-blue-900 text-white'
                  : 'border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <p className="px-5 pb-2 text-xs text-slate-400">
          {favorites.length}/{MAX_FAVORITES} selected — click ⭐ to add/remove
        </p>

        {/* Grid */}
        <div className="px-5 pb-5 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-3">
          {filtered.map((action) => {
            const isFav = favorites.includes(action.id);
            const atMax = !isFav && favorites.length >= MAX_FAVORITES;
            return (
              <div
                key={action.id}
                className={`relative rounded-xl p-3 border transition-all duration-150 ${
                  isFav ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
                } ${atMax ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                onClick={() => !atMax && onToggle(action.id)}
              >
                {/* Star */}
                <button
                  className="absolute top-2 right-2 p-0.5"
                  onClick={(e) => { e.stopPropagation(); if (!atMax || isFav) onToggle(action.id); }}
                >
                  <Star
                    className={`h-3.5 w-3.5 transition-colors ${isFav ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}
                  />
                </button>
                {/* Icon */}
                <div className={`h-9 w-9 rounded-lg ${action.iconBg} flex items-center justify-center mb-2`}>
                  <action.icon className={`h-4 w-4 ${action.iconColor}`} />
                </div>
                <p className="text-xs font-medium text-slate-700 leading-tight pr-4">{action.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{action.category}</p>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-4 py-10 text-center text-sm text-slate-400">No actions found</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const MyFavorites: React.FC = () => {
  const navigate = useNavigate();
  const [favoriteIds, setFavoriteIds] = useState<string[]>(loadFavorites);
  const [modalOpen, setModalOpen] = useState(false);

  const favoriteActions = favoriteIds
    .map((id) => ALL_ACTIONS.find((a) => a.id === id))
    .filter(Boolean) as Action[];

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < MAX_FAVORITES ? [...prev, id] : prev;
      saveFavorites(next);
      return next;
    });
  }, []);

  return (
    <>
      <style>{`
        @keyframes rd-modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="mb-6">
        <h2 className="text-base font-semibold text-slate-800 mb-3">My Favourites</h2>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {/* Add button */}
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-2xl p-3 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 min-h-[88px] hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
          >
            <div className="h-10 w-10 rounded-xl bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
              <Plus className="h-5 w-5 text-slate-400 group-hover:text-blue-500" />
            </div>
            <span className="text-[11px] font-medium text-slate-400 group-hover:text-blue-500">Add</span>
          </button>

          {/* Favorite cards */}
          {favoriteActions.map((action) => (
            <button
              key={action.id}
              onClick={() => navigate(action.path)}
              className={`${action.cardBg} rounded-2xl p-3 flex flex-col items-center justify-center gap-2 min-h-[88px] border border-transparent hover:border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group`}
            >
              <div className={`h-10 w-10 rounded-xl ${action.iconBg} flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}>
                <action.icon className={`h-5 w-5 ${action.iconColor}`} />
              </div>
              <span className="text-[11px] font-medium text-slate-700 text-center leading-tight">
                {action.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      <FavoritesModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        favorites={favoriteIds}
        onToggle={toggleFavorite}
      />
    </>
  );
};

export default MyFavorites;
