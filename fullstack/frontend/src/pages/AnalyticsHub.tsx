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
  personal_email?: string;
  phone?: string;
  mobile?: string;
  doj?: string;
  dob?: string;
  dol?: string;
  resignation_date?: string;
  last_working_day?: string;
  employment_status?: string;
  reporting_manager?: number | null;
  reporting_manager_name?: string;
  gender?: string;
  blood_group?: string;
  category?: string;
  employee_category?: string;
  experience?: string | number;
  total_experience?: string | number;
  confirmation_date?: string;
  probation_end_date?: string;
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

const isValidDate = (value?: string | null) => {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
};

const isWithinNextDays = (value?: string | null, days = 30, yearly = false) => {
  if (!isValidDate(value)) return false;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setDate(end.getDate() + days);

  const source = new Date(value!);
  const target = yearly
    ? new Date(now.getFullYear(), source.getMonth(), source.getDate())
    : new Date(source);
  target.setHours(0, 0, 0, 0);

  if (yearly && target < now) {
    target.setFullYear(target.getFullYear() + 1);
  }

  return target >= now && target <= end;
};

const isWithinLastDays = (value?: string | null, days = 30) => {
  if (!isValidDate(value)) return false;

  const now = new Date();
  now.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setDate(start.getDate() - days);

  const target = new Date(value!);
  return target >= start && target <= now;
};

const getAge = (dob?: string | null) => {
  if (!isValidDate(dob)) return Number.POSITIVE_INFINITY;
  const birthDate = new Date(dob!);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
};

const hasValue = (value: unknown) =>
  value !== undefined && value !== null && String(value).trim() !== '';

const isResignedEmployee = (employee: EmployeeRow) => {
  const status = (employee.employment_status || '').toLowerCase();
  return (
    employee.is_active === false ||
    status.includes('resign') ||
    status.includes('inactive') ||
    hasValue(employee.dol) ||
    hasValue(employee.resignation_date) ||
    hasValue(employee.last_working_day)
  );
};

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
  title?: string;
}> = ({ employees, loading, onAddEmployee, title = 'All Employee Info' }) => {
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
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
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
  const activeItem = ANALYTICS_ITEMS.find((item) => item.id === activeId);
  const displayedEmployees = useMemo(() => {
    switch (activeId) {
      case 'all-employees':
        return employees.filter((emp) => hasValue(emp.employee_id) || hasValue(emp.name));
      case 'basic-info':
        return employees.filter((emp) =>
          hasValue(emp.employee_id) ||
          hasValue(emp.name) ||
          hasValue(emp.position) ||
          hasValue(emp.department?.department_name) ||
          hasValue(emp.location) ||
          hasValue(emp.email)
        );
      case 'personal-info':
        return employees.filter((emp) =>
          hasValue(emp.dob) ||
          hasValue(emp.personal_email) ||
          hasValue(emp.gender)
        );
      case 'birthdays':
        return employees.filter((emp) => isWithinNextDays(emp.dob, 30, true));
      case 'anniversaries':
        return employees.filter((emp) => isWithinNextDays(emp.doj, 30, true));
      case 'new-joiners':
        return employees.filter((emp) => isWithinLastDays(emp.doj, 30));
      case 'confirmations':
        return employees.filter((emp) =>
          isWithinNextDays(emp.confirmation_date || emp.probation_end_date, 30)
        );
      case 'resignees':
        return employees.filter(isResignedEmployee);
      case 'location-gender':
        return employees.filter((emp) => hasValue(emp.location) && hasValue(emp.gender));
      case 'location-blood':
        return employees.filter((emp) => hasValue(emp.location) && hasValue(emp.blood_group));
      case 'location':
        return employees.filter((emp) => hasValue(emp.location));
      case 'gender':
        return employees.filter((emp) => hasValue(emp.gender));
      case 'age':
        return employees
          .filter((emp) => isValidDate(emp.dob))
          .sort((a, b) => getAge(a.dob) - getAge(b.dob));
      case 'experience':
        return employees.filter((emp) =>
          hasValue(emp.experience) || hasValue(emp.total_experience) || isValidDate(emp.doj)
        );
      case 'years-service':
        return employees.filter((emp) => isValidDate(emp.doj));
      case 'emp-status':
        return employees.filter((emp) => typeof emp.is_active === 'boolean' || hasValue(emp.employment_status));
      case 'contact-list':
        return employees.filter((emp) =>
          hasValue(emp.email) || hasValue(emp.personal_email) || hasValue(emp.phone) || hasValue(emp.mobile)
        );
      case 'dept-list':
        return employees.filter((emp) =>
          hasValue(emp.department?.department_name) || hasValue(emp.reporting_manager_name) || hasValue(emp.reporting_manager)
        );
      case 'blood-group':
        return employees.filter((emp) => hasValue(emp.blood_group));
      case 'work-exp':
        return employees.filter((emp) =>
          hasValue(emp.experience) || hasValue(emp.total_experience) || isValidDate(emp.doj)
        );
      case 'category-info':
        return employees.filter((emp) =>
          hasValue(emp.category) || hasValue(emp.employee_category) || hasValue(emp.position)
        );
      default:
        return employees;
    }
  }, [activeId, employees]);

  return (
    <div className="space-y-4">

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
        employees={displayedEmployees}
        loading={loading}
        onAddEmployee={() => navigate('/admin/employees')}
        title={activeItem?.label || 'All Employee Info'}
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
 
