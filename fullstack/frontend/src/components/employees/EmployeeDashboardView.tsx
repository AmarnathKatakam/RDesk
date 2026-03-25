import React, { useMemo } from 'react';
import {
  Users, UserCheck, UserPlus, UserMinus, TrendingUp, TrendingDown,
  Calendar, MapPin, Building2,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid,
  XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeRow {
  id: number;
  employee_id: string;
  name: string;
  email?: string;
  doj?: string;
  department?: { id: number; department_name: string } | null;
  location: string;
  is_active: boolean;
  position?: string;
}

interface Props {
  employees: EmployeeRow[];
  loading: boolean;
  departmentFilter: string;
  locationFilter: string;
  onDepartmentChange: (v: string) => void;
  onLocationChange: (v: string) => void;
  departments: { id: number; department_name: string }[];
  locations: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#06B6D4'];

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name: string) {
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500', 'bg-cyan-500'];
  return colors[name.charCodeAt(0) % colors.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  trend?: number;
  sub?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, iconBg, iconColor, trend, sub }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-start gap-4">
    <div className={`h-11 w-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
      <Icon className={`h-5 w-5 ${iconColor}`} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-slate-500 font-medium">{title}</p>
      <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
          {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(trend)}% vs last month
        </div>
      )}
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

interface ActivityCardProps {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  items: { name: string; meta: string }[];
  emptyText: string;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ title, icon: Icon, iconColor, items, emptyText }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
    <div className="flex items-center gap-2 mb-4">
      <Icon className={`h-4 w-4 ${iconColor}`} />
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <span className="ml-auto text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{items.length}</span>
    </div>
    {items.length === 0 ? (
      <p className="text-xs text-slate-400 text-center py-4">{emptyText}</p>
    ) : (
      <div className="space-y-3">
        {items.slice(0, 5).map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full ${avatarColor(item.name)} flex items-center justify-center shrink-0`}>
              <span className="text-white text-xs font-semibold">{getInitials(item.name)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
              <p className="text-xs text-slate-400">{item.meta}</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const EmployeeDashboardView: React.FC<Props> = ({
  employees, loading, departmentFilter, locationFilter,
  onDepartmentChange, onLocationChange, departments, locations,
}) => {

  // Apply filters
  const filtered = useMemo(() => employees.filter((e) => {
    const deptOk = !departmentFilter || String(e.department?.id) === departmentFilter;
    const locOk  = !locationFilter  || e.location === locationFilter;
    return deptOk && locOk;
  }), [employees, departmentFilter, locationFilter]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);

  // Overview stats
  const total   = filtered.length;
  const active  = filtered.filter((e) => e.is_active).length;
  const joiners = filtered.filter((e) => e.doj && new Date(e.doj) >= thirtyDaysAgo).length;

  // Department distribution for pie
  const deptDist = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of filtered) {
      const d = e.department?.department_name || 'Unassigned';
      map[d] = (map[d] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // Location distribution for bar
  const locDist = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of filtered) {
      const l = e.location || 'Unknown';
      map[l] = (map[l] || 0) + 1;
    }
    return Object.entries(map).map(([location, count]) => ({ location, count }));
  }, [filtered]);

  // Headcount trend (last 6 months — cumulative joiners)
  const headcountTrend = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleString('en-US', { month: 'short' });
      const count = filtered.filter((e) => e.doj && new Date(e.doj) <= d).length;
      return { label, count };
    });
  }, [filtered]);

  // New joiners list
  const newJoiners = useMemo(() =>
    filtered
      .filter((e) => e.doj && new Date(e.doj) >= thirtyDaysAgo)
      .sort((a, b) => new Date(b.doj!).getTime() - new Date(a.doj!).getTime())
      .map((e) => ({
        name: e.name,
        meta: `${e.department?.department_name || 'N/A'} · ${e.doj ? new Date(e.doj).toLocaleDateString('en-IN') : ''}`,
      })),
  [filtered]);

  // By department list
  const byDept = useMemo(() =>
    deptDist.map((d) => ({ name: d.name, meta: `${d.value} employee${d.value !== 1 ? 's' : ''}` })),
  [deptDist]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 h-24 animate-pulse">
            <div className="h-3 bg-slate-100 rounded w-1/2 mb-3" />
            <div className="h-6 bg-slate-100 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select
          value={departmentFilter}
          onChange={(e) => onDepartmentChange(e.target.value)}
          className="h-9 rounded-xl border border-slate-200 px-3 text-sm bg-white text-slate-700"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.department_name}</option>
          ))}
        </select>
        <select
          value={locationFilter}
          onChange={(e) => onLocationChange(e.target.value)}
          className="h-9 rounded-xl border border-slate-200 px-3 text-sm bg-white text-slate-700"
        >
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* ── Overview cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Employees"  value={total}   icon={Users}      iconBg="bg-blue-50"    iconColor="text-blue-600"    sub="All records" />
        <StatCard title="Active Employees" value={active}  icon={UserCheck}  iconBg="bg-emerald-50" iconColor="text-emerald-600" trend={2} />
        <StatCard title="New Joiners"      value={joiners} icon={UserPlus}   iconBg="bg-purple-50"  iconColor="text-purple-600"  sub="Last 30 days" />
        <StatCard title="Departments"      value={deptDist.length} icon={Building2} iconBg="bg-orange-50" iconColor="text-orange-600" sub="Active" />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Headcount trend */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Employee Headcount Trend</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={headcountTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2.5} dot={{ fill: '#3B82F6', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department pie */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">By Department</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={deptDist} dataKey="value" nameKey="name" outerRadius={75} innerRadius={35} paddingAngle={3}>
                  {deptDist.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Location bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Employees by Location</h3>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={locDist} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="location" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Activity widgets ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <ActivityCard
          title="New Joiners"
          icon={UserPlus}
          iconColor="text-purple-500"
          items={newJoiners}
          emptyText="No new joiners in the last 30 days"
        />
        <ActivityCard
          title="By Department"
          icon={Building2}
          iconColor="text-blue-500"
          items={byDept}
          emptyText="No department data"
        />
        <ActivityCard
          title="By Location"
          icon={MapPin}
          iconColor="text-emerald-500"
          items={locDist.map((l) => ({ name: l.location, meta: `${l.count} employee${l.count !== 1 ? 's' : ''}` }))}
          emptyText="No location data"
        />
      </div>
    </div>
  );
};

export default EmployeeDashboardView;
