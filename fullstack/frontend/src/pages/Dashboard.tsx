import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis,
  Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Building2, CalendarCheck, DollarSign, Users, RefreshCw } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { employeeAPI, payslipAPI, dashboardAPI } from '@/services/api';
import { getJson, hrmsApi } from '@/services/hrmsApi';

import WelcomeHero from '@/components/dashboard/WelcomeHero';
import MyFavorites from '@/components/dashboard/MyFavorites';
import DashboardWidgets from '@/components/dashboard/DashboardWidgets';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import FooterHelp from '@/components/dashboard/FooterHelp';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsStats {
  totalEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  totalPayroll: number;
}
interface PayrollPoint   { label: string; value: number; }
interface AttendancePoint { date: string; present: number; absent: number; }
interface DepartmentPoint { name: string; value: number; }

const palette = ['#F5A623', '#2F2F2F', '#3B82F6', '#60A5FA', '#93C5FD'];

const normalizeList = <T,>(payload: any): T[] => {
  if (Array.isArray(payload))          return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data))    return payload.data;
  return [];
};

// ─── Chart wrapper (waits for real dimensions) ────────────────────────────────

const ChartViewport: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setReady(el.clientWidth > 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div ref={ref} className="h-72 min-w-0">{ready ? children : <div className="h-full w-full" />}</div>;
};

// ─── Help links (greytHR chip style) ─────────────────────────────────────────

const HELP_CHIPS = [
  'RothDesk Community', 'Statutory Compliances', 'Knowledge Centre',
  'Resource Centre', 'How-to Videos',
];

const HelpLinks: React.FC = () => (
  <div className="mt-6">
    <h3 className="text-sm font-semibold text-slate-700 mb-3">Help Links</h3>
    <div className="flex flex-wrap gap-2">
      {HELP_CHIPS.map((chip) => (
        <button
          key={chip}
          className="h-8 px-4 rounded-full border border-slate-200 text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-all duration-150"
        >
          {chip}
        </button>
      ))}
    </div>
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'welcome' | 'dashboard';

const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('welcome');

  // Analytics state (only loaded when Dashboard tab is opened)
  const [stats, setStats]           = useState<AnalyticsStats>({ totalEmployees: 0, presentToday: 0, onLeaveToday: 0, totalPayroll: 0 });
  const [payrollTrend, setPayrollTrend] = useState<PayrollPoint[]>([]);
  const [attendance, setAttendance]   = useState<AttendancePoint[]>([]);
  const [departments, setDepartments] = useState<DepartmentPoint[]>([]);
  const [loading, setLoading]         = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [empRes, overviewRes, attendRes, payrollRes, payslipsRes] = await Promise.all([
        employeeAPI.getAll(),
        hrmsApi.getAnalyticsOverview(),
        hrmsApi.getAnalyticsAttendance(),
        hrmsApi.getAnalyticsPayroll(),
        payslipAPI.getAll(),
      ]);

      const employees    = normalizeList<any>(empRes.data);
      const overviewData = overviewRes.ok  ? await getJson<any>(overviewRes)  : {};
      const attendData   = attendRes.ok    ? await getJson<any>(attendRes)    : {};
      const payrollData  = payrollRes.ok   ? await getJson<any>(payrollRes)   : {};
      const payslips     = normalizeList<any>(payslipsRes.data);

      // Departments
      const deptMap: Record<string, number> = {};
      for (const e of employees) {
        const d = e?.department?.department_name || 'Unassigned';
        deptMap[d] = (deptMap[d] || 0) + 1;
      }
      setDepartments(Object.entries(deptMap).map(([name, value]) => ({ name, value })));

      // Attendance
      const attendPoints = (attendData.graph_data || attendData.attendance || []).slice(-7);
      setAttendance(attendPoints);

      // Payroll trend
      const monthlyMap: Record<string, number> = {};
      for (const p of payslips) {
        const key = `${p?.pay_period_month || p?.month} ${p?.pay_period_year || p?.year}`;
        if (!p?.pay_period_month && !p?.month) continue;
        monthlyMap[key] = (monthlyMap[key] || 0) + Number(p?.net_pay || 0);
      }
      let trend = Object.entries(monthlyMap).map(([label, value]) => ({ label, value })).slice(-6);
      const currentPayroll = Number(overviewData?.stats?.total_payroll || 0) ||
        (payrollData.distribution || []).reduce((s: number, i: any) => s + Number(i.payroll || 0), 0);
      if (trend.length === 0) {
        const now = new Date();
        trend = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
          return { label: d.toLocaleString('en-US', { month: 'short' }), value: currentPayroll * (0.85 + i * 0.03) };
        });
      }
      setPayrollTrend(trend);

      setStats({
        totalEmployees: Number(overviewData?.stats?.total_employees || employees.length),
        presentToday:   Number(overviewData?.stats?.present_today   || attendPoints.at(-1)?.present || 0),
        onLeaveToday:   Number(overviewData?.stats?.on_leave_today  || 0),
        totalPayroll:   currentPayroll,
      });
      setAnalyticsLoaded(true);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load analytics lazily when tab is first opened
  useEffect(() => {
    if (activeTab === 'dashboard' && !analyticsLoaded) {
      void loadAnalytics();
    }
  }, [activeTab]);

  const statCards = useMemo(() => [
    { title: 'Total Employees',          value: stats.totalEmployees,                                                icon: Users,        color: 'primary'  as const },
    { title: 'Employees Present Today',  value: stats.presentToday,                                                  icon: CalendarCheck, color: 'success'  as const },
    { title: 'Employees On Leave',       value: stats.onLeaveToday,                                                  icon: Building2,    color: 'warning'  as const },
    { title: 'Total Payroll This Month', value: `Rs ${Math.round(stats.totalPayroll).toLocaleString('en-IN')}`,      icon: DollarSign,   color: 'accent'   as const },
  ], [stats]);

  return (
    <div className="space-y-0">

      {/* ── Tab Toggle (greytHR pill style) ── */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex bg-slate-100 rounded-full p-1 gap-1">
          {(['welcome', 'dashboard'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-8 px-5 rounded-full text-sm font-medium transition-all duration-200 capitalize ${
                activeTab === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'welcome' ? 'Welcome' : 'Dashboard'}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          WELCOME VIEW
      ══════════════════════════════════════════ */}
      {activeTab === 'welcome' && (
        <div className="space-y-2">
          <WelcomeHero />
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <MyFavorites />
            <HelpLinks />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          DASHBOARD / ANALYTICS VIEW
      ══════════════════════════════════════════ */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">

          {/* Widgets row */}
          <DashboardWidgets />

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <StatCard key={card.title} title={card.title} value={card.value} icon={card.icon} color={card.color} />
            ))}
          </div>

          {/* Payroll trend + Activity */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 xl:col-span-2 min-w-0">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-800">Payroll Cost Trend</h2>
                <button onClick={() => void loadAnalytics()} className="p-2 rounded-lg hover:bg-slate-100 transition-colors" title="Refresh">
                  <RefreshCw className={`h-4 w-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="h-72 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
                ) : (
                  <ChartViewport>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <LineChart data={payrollTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="label" />
                        <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                        <Tooltip formatter={(v: number) => `Rs ${Math.round(Number(v)).toLocaleString('en-IN')}`} />
                        <Line type="monotone" dataKey="value" stroke="#F5A623" strokeWidth={2.5} dot={{ fill: '#F5A623' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartViewport>
                )}
              </div>
            </div>
            <ActivityFeed />
          </div>

          {/* Attendance + Department charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 min-w-0">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-800">Attendance Overview</h2>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="h-72 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
                ) : (
                  <ChartViewport>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart data={attendance}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="present" fill="#F5A623" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="absent"  fill="#94A3B8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartViewport>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 min-w-0">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-800">Department Distribution</h2>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="h-72 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
                ) : (
                  <ChartViewport>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <PieChart>
                        <Pie data={departments} dataKey="value" nameKey="name" outerRadius={95} label>
                          {departments.map((entry, i) => (
                            <Cell key={entry.name} fill={palette[i % palette.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartViewport>
                )}
              </div>
            </div>
          </div>

          <FooterHelp />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
