import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, Search, Star,
  Users, UserPlus, UserMinus, Calendar, Award,
  MapPin, Droplets, Briefcase, Phone, Building2,
  FileText, BarChart3, RefreshCw, ExternalLink, Pencil, Plus,
} from 'lucide-react';
import { employeeAPI } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeRow {
  id: number;
  employee_id: string;
  name: string;
  email?: string;
  doj?: string;
  dob?: string;
  position?: string;
  location?: string;
  is_active: boolean;
  department?: { id: number; department_name: string } | null;
}

// ─── Analytics catalogue ─────────────────────────────────────────────────────

interface AnalyticsItem {
  id: string;
  label: string;
  icon: React.ElementType;
  group: string;
}

const ANALYTICS_ITEMS: AnalyticsItem[] = [
  { id: 'all-employees',   label: 'All Employee Info',              icon: Users,      group: 'Headcount Summaries' },
  { id: 'basic-info',      label: 'Basic Information',              icon: FileText,   group: 'Employee List'       },
  { id: 'personal-info',   label: 'Personal Information (PII Data)',icon: FileText,   group: 'Employee List'       },
  { id: 'resignees',       label: 'Recent Resignees',               icon: UserMinus,  group: 'Event List'          },
  { id: 'location-gender', label: 'Location-wise Gender Headcount', icon: MapPin,     group: 'Headcount Summaries' },
  { id: 'location-blood',  label: 'Location-wise Blood Group Headcount', icon: Droplets, group: 'Headcount Summaries' },
  { id: 'location',        label: 'Location-wise Headcount',        icon: MapPin,     group: 'Headcount Summaries' },
  // View All items
  { id: 'birthdays',       label: 'Upcoming Birthdays',             icon: Calendar,   group: 'Event List'          },
  { id: 'anniversaries',   label: 'Upcoming Anniversaries',         icon: Award,      group: 'Event List'          },
  { id: 'confirmations',   label: 'Confirmation Dues',              icon: FileText,   group: 'Event List'          },
  { id: 'new-joiners',     label: 'Recent New Joiners',             icon: UserPlus,   group: 'Event List'          },
  { id: 'gender',          label: 'Gender-wise Headcount',          icon: Users,      group: 'Headcount Summaries' },
  { id: 'age',             label: 'Age-wise Headcount',             icon: BarChart3,  group: 'Headcount Summaries' },
  { id: 'experience',      label: 'Total Experience Headcount',     icon: Briefcase,  group: 'Headcount Summaries' },
  { id: 'years-service',   label: 'Years in Service Headcount',     icon: Award,      group: 'Headcount Summaries' },
  { id: 'emp-status',      label: 'Employment Status Headcount',    icon: Users,      group: 'Headcount Summaries' },
  { id: 'contact-list',    label: 'Contact List of All Employees',  icon: Phone,      group: 'Employee List'       },
  { id: 'dept-list',       label: 'Department List with Manager',   icon: Building2,  group: 'Employee List'       },
  { id: 'blood-group',     label: 'Blood Group Details',            icon: Droplets,   group: 'Employee List'       },
  { id: 'work-exp',        label: 'Work Experience',                icon: Briefcase,  group: 'Employee List'       },
  { id: 'category-info',   label: 'Category Information',           icon: BarChart3,  group: 'Employee List'       },
];

// First 7 appear in the Recent row
const RECENT_IDS = ['all-employees', 'basic-info', 'personal-info', 'resignees', 'location-gender', 'location-blood', 'location'];
const GROUPS = ['Event List', 'Headcount Summaries', 'Employee List'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeList = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const toDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

// ─── View All panel ───────────────────────────────────────────────────────────

const ViewAllPanel: React.FC<{
  onClose: () => void;
  onSelect: (id: string) => void;
  activeId: string;
}> = ({ onClose, onSelect, activeId }) => {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(GROUPS));

  const toggle = (g: string) =>
    setOpenGroups((prev) => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n; });

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="ml-auto w-80 h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-800">All Analytics Views</span>
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">Close</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {GROUPS.map((group) => {
            const items = ANALYTICS_ITEMS.filter((i) => i.group === group);
            const isOpen = openGroups.has(group);
            return (
              <div key={group} className="border-b border-slate-50">
                <button
                  onClick={() => toggle(group)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-left"
                >
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{group}</span>
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                </button>
                {isOpen && items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { onSelect(item.id); onClose(); }}
                    className={`w-full flex items-center gap-2.5 px-5 py-2 text-sm text-left transition-colors ${
                      activeId === item.id
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {item.label}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Employee table ───────────────────────────────────────────────────────────

const EmployeeAnalyticsTable: React.FC<{
  employees: EmployeeRow[];
  loading: boolean;
  onAddEmployee: () => void;
}> = ({ employees, loading, onAddEmployee }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      e.name?.toLowerCase().includes(q) ||
      e.employee_id?.toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q) ||
      (e.department?.department_name || '').toLowerCase().includes(q)
    );
  }, [employees, query]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Table header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">All Employee Info</h3>
        <button
          onClick={onAddEmployee}
          className="h-8 px-3 rounded-lg bg-blue-900 text-white text-xs font-medium inline-flex items-center gap-1.5 hover:bg-blue-800 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Employee
        </button>
      </div>

      {/* Search + restore row */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-8 w-52 pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        {query && (
          <button onClick={() => setQuery('')} className="text-xs text-slate-400 hover:text-slate-600 underline">
            Restore
          </button>
        )}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} records</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <th className="px-4 py-2.5">Emp ID</th>
              <th className="px-4 py-2.5">Emp Name</th>
              <th className="px-4 py-2.5">DOJ</th>
              <th className="px-4 py-2.5">Department</th>
              <th className="px-4 py-2.5">Location</th>
              <th className="px-4 py-2.5">Email ID</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">
                  No employees found.
                </td>
              </tr>
            ) : (
              filtered.map((emp) => (
                <tr key={emp.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{emp.employee_id}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => navigate(`/admin/employees/${emp.id}/profile`)}
                      className="font-medium text-blue-700 hover:text-blue-900 hover:underline text-left"
                    >
                      {emp.name}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{toDate(emp.doj)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{emp.department?.department_name || '-'}</td>
                  <td className="px-4 py-2.5 text-slate-500">{emp.location || '-'}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{emp.email || '-'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      emp.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {emp.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const AnalyticsHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState('all-employees');
  const [showViewAll, setShowViewAll] = useState(false);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { void loadEmployees(); }, []);

  const loadEmployees = async (silent = false) => {
    try {
      if (silent) setRefreshing(true); else setLoading(true);
      const res = await employeeAPI.getAll();
      setEmployees(normalizeList<EmployeeRow>(res.data));
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const recentItems = ANALYTICS_ITEMS.filter((i) => RECENT_IDS.includes(i.id));

  return (
    <div className="space-y-4">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-slate-400">
        <button onClick={() => navigate('/admin/employees')} className="hover:text-slate-600">Home</button>
        <ChevronRight className="h-3 w-3" />
        <button onClick={() => navigate('/admin/employees')} className="hover:text-slate-600">Employee</button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-slate-600 font-medium">Analytics Hub</span>
      </nav>

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-slate-800">Analytics Hub</h1>
        <button
          onClick={() => void loadEmployees(true)}
          className="h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Recent row — greytHR style horizontal tabs */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recent</span>
          <button
            onClick={() => setShowViewAll(true)}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
          >
            View All <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          {recentItems.map((item) => {
            const isActive = activeId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveId(item.id)}
                className={`shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-all ${
                  isActive
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Star className={`h-3 w-3 ${isActive ? 'text-blue-400' : 'text-slate-300'}`} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content area — always shows employee table (default: All Employee Info) */}
      <EmployeeAnalyticsTable
        employees={employees}
        loading={loading}
        onAddEmployee={() => navigate('/admin/employees')}
      />

      {/* View All slide-in panel */}
      {showViewAll && (
        <ViewAllPanel
          onClose={() => setShowViewAll(false)}
          onSelect={(id) => setActiveId(id)}
          activeId={activeId}
        />
      )}
    </div>
  );
};

export default AnalyticsHubPage;
