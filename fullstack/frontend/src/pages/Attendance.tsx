/**
 * Component: pages\Attendance.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarClock, Clock3, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { attendanceAPI, departmentAPI, employeeAPI } from '@/services/api';
import { Button } from '@/components/ui/button';

type AttendanceStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'LEAVE' | 'HOLIDAY' | 'WEEK_OFF' | 'NOT_MARKED';

const statusLabel: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  HALF_DAY: 'Half Day',
  ABSENT: 'Absent',
  LEAVE: 'Leave',
  HOLIDAY: 'Holiday',
  WEEK_OFF: 'Week Off',
  NOT_MARKED: 'Not Marked',
};

const statusClass: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-700',
  LATE: 'bg-amber-100 text-amber-700',
  HALF_DAY: 'bg-orange-100 text-orange-700',
  ABSENT: 'bg-rose-100 text-rose-700',
  LEAVE: 'bg-sky-100 text-sky-700',
  HOLIDAY: 'bg-indigo-100 text-indigo-700',
  WEEK_OFF: 'bg-slate-100 text-slate-700',
  NOT_MARKED: 'bg-zinc-100 text-zinc-700',
};

const toDateInput = (d: Date) => d.toISOString().slice(0, 10);
const toTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
const toFixedHours = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
};

const AttendancePage: React.FC = () => {
  const now = new Date();
  const [tab, setTab] = useState<'dashboard' | 'reports' | 'config'>('dashboard');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);

  const [filters, setFilters] = useState({
    date: toDateInput(now),
    department: '',
    location: '',
    shift: '',
  });
  const [dashboard, setDashboard] = useState<any>({
    summary: { total_employees: 0, present: 0, late: 0, leave: 0, absent: 0 },
    trend: [],
    employees: [],
  });
  const [rowShiftSelection, setRowShiftSelection] = useState<Record<number, string>>({});
  const [rowAssigningEmployeeId, setRowAssigningEmployeeId] = useState<number | null>(null);

  const [reportMonth, setReportMonth] = useState(now.getMonth() + 1);
  const [reportYear, setReportYear] = useState(now.getFullYear());
  const [monthlyRows, setMonthlyRows] = useState<any[]>([]);

  const [shiftForm, setShiftForm] = useState({
    name: '',
    start_time: '09:30',
    end_time: '18:30',
    late_after: '09:45',
    half_day_after: '11:00',
    overtime_allowed: true,
  });
  const [locationForm, setLocationForm] = useState({
    name: '',
    latitude: '',
    longitude: '',
    allowed_radius_meters: 200,
  });
  const [policyForm, setPolicyForm] = useState({
    name: '',
    enforce_gps: true,
    allow_remote_punch: false,
    auto_mark_absent: true,
    min_half_day_hours: '4.00',
    full_day_hours: '8.00',
    week_off_days: '5,6',
  });
  const [assignmentForm, setAssignmentForm] = useState({
    employee_id: '',
    shift_id: '',
    office_location_id: '',
    policy_id: '',
    effective_from: toDateInput(now),
  });

  const loadDashboard = async () => {
    const params: Record<string, string> = { date: filters.date };
    if (filters.department) params.department = filters.department;
    if (filters.location) params.location = filters.location;
    if (filters.shift) params.shift = filters.shift;
    const response = await attendanceAPI.getDashboardData(params);
    const dashboardEmployees = response.data?.employees || [];
    setDashboard({
      summary: response.data?.summary || { total_employees: 0, present: 0, late: 0, leave: 0, absent: 0 },
      trend: response.data?.trend || [],
      employees: dashboardEmployees,
    });
    setRowShiftSelection((prev) => {
      const next = { ...prev };
      dashboardEmployees.forEach((row: any) => {
        next[row.employee_id] = row.assigned_shift_id ? String(row.assigned_shift_id) : '';
      });
      return next;
    });
  };

  const loadConfig = async () => {
    const [deptRes, empRes, shiftRes, locRes, polRes] = await Promise.all([
      departmentAPI.getAll(),
      employeeAPI.getAll(),
      attendanceAPI.getShifts(),
      attendanceAPI.getOfficeLocations(),
      attendanceAPI.getPolicies(),
    ]);
    setDepartments(Array.isArray(deptRes.data) ? deptRes.data : deptRes.data?.results || []);
    setEmployees(Array.isArray(empRes.data) ? empRes.data : empRes.data?.results || []);
    setShifts(shiftRes.data?.shifts || []);
    setLocations(locRes.data?.office_locations || []);
    setPolicies(polRes.data?.policies || []);
  };

  const loadMonthly = async () => {
    const response = await attendanceAPI.getMonthly({ month: reportMonth, year: reportYear });
    setMonthlyRows(response.data?.summaries || []);
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      setError('');
      await Promise.all([loadDashboard(), loadConfig(), loadMonthly()]);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!loading) {
      void loadDashboard();
    }
  }, [filters]);

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((emp) => {
      if (emp.location) set.add(emp.location);
    });
    return Array.from(set.values());
  }, [employees]);

  const createShift = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await attendanceAPI.createShift(shiftForm);
      setSuccess('Shift created.');
      setShiftForm({
        name: '',
        start_time: '09:30',
        end_time: '18:30',
        late_after: '09:45',
        half_day_after: '11:00',
        overtime_allowed: true,
      });
      await loadConfig();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create shift.');
    }
  };

  const createLocation = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await attendanceAPI.createOfficeLocation({
        ...locationForm,
        latitude: Number(locationForm.latitude),
        longitude: Number(locationForm.longitude),
      });
      setSuccess('Office location created.');
      setLocationForm({ name: '', latitude: '', longitude: '', allowed_radius_meters: 200 });
      await loadConfig();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create office location.');
    }
  };

  const createPolicy = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const weekOffDays = policyForm.week_off_days
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6);
      await attendanceAPI.createPolicy({
        ...policyForm,
        week_off_days: weekOffDays.length ? weekOffDays : [5, 6],
      });
      setSuccess('Policy created.');
      setPolicyForm({
        name: '',
        enforce_gps: true,
        allow_remote_punch: false,
        auto_mark_absent: true,
        min_half_day_hours: '4.00',
        full_day_hours: '8.00',
        week_off_days: '5,6',
      });
      await loadConfig();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create policy.');
    }
  };

  const assignShift = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await attendanceAPI.assignShift(assignmentForm);
      setSuccess('Shift assigned.');
      setAssignmentForm({ employee_id: '', shift_id: '', office_location_id: '', policy_id: '', effective_from: toDateInput(now) });
      await loadDashboard();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to assign shift.');
    }
  };

  const assignShiftToRow = async (employeeId: number) => {
    const selectedShift = rowShiftSelection[employeeId];
    if (!selectedShift) {
      setError('Please select a shift before assigning.');
      return;
    }

    try {
      setRowAssigningEmployeeId(employeeId);
      setError('');
      await attendanceAPI.assignShift({
        employee_id: employeeId,
        shift_id: selectedShift,
        effective_from: filters.date || toDateInput(new Date()),
      });
      setSuccess('Shift assigned successfully.');
      await loadDashboard();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to assign shift.');
    } finally {
      setRowAssigningEmployeeId(null);
    }
  };

  const runAbsentAutomation = async () => {
    try {
      await attendanceAPI.runAbsentAutomation(filters.date);
      setSuccess(`Absent automation executed for ${filters.date}.`);
      await Promise.all([loadDashboard(), loadMonthly()]);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to run absent automation.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Attendance Management</h1>
          <p className="text-sm text-slate-500">Shift + GPS attendance, late rules, leave-aware status, reports and payroll-ready summaries.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={tab === 'dashboard' ? 'default' : 'outline'} onClick={() => setTab('dashboard')}>Dashboard</Button>
          <Button variant={tab === 'reports' ? 'default' : 'outline'} onClick={() => setTab('reports')}>Reports</Button>
          <Button variant={tab === 'config' ? 'default' : 'outline'} onClick={() => setTab('config')}>Admin Config</Button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      {tab === 'dashboard' && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <input type="date" value={filters.date} onChange={(e) => setFilters((p) => ({ ...p, date: e.target.value }))} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
            <select value={filters.department} onChange={(e) => setFilters((p) => ({ ...p, department: e.target.value }))} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
              <option value="">All departments</option>
              {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.department_name}</option>)}
            </select>
            <select value={filters.location} onChange={(e) => setFilters((p) => ({ ...p, location: e.target.value }))} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
              <option value="">All locations</option>
              {locationOptions.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
            <select value={filters.shift} onChange={(e) => setFilters((p) => ({ ...p, shift: e.target.value }))} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
              <option value="">All shifts</option>
              {shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
            </select>
            <Button onClick={() => void loadDashboard()}>Refresh</Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <StatCard title="Total Employees" value={dashboard.summary.total_employees} icon={ShieldCheck} color="primary" />
            <StatCard title="Present" value={dashboard.summary.present} icon={UserCheck} color="success" />
            <StatCard title="Late" value={dashboard.summary.late} icon={Clock3} color="warning" />
            <StatCard title="Leave" value={dashboard.summary.leave} icon={CalendarClock} color="accent" />
            <StatCard title="Absent" value={dashboard.summary.absent} icon={UserX} color="danger" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Attendance Trend</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboard.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tickFormatter={(val) => String(val).slice(5)} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} />
                    <Line type="monotone" dataKey="absent" stroke="#64748b" strokeWidth={2} />
                    <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Today Distribution</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { label: 'Present', value: dashboard.summary.present },
                    { label: 'Late', value: dashboard.summary.late },
                    { label: 'Leave', value: dashboard.summary.leave },
                    { label: 'Absent', value: dashboard.summary.absent },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0ea5e9" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Employee Attendance Table</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Employee</th>
                    <th className="px-2 py-2">Department</th>
                    <th className="px-2 py-2">Location</th>
                    <th className="px-2 py-2">In</th>
                    <th className="px-2 py-2">Out</th>
                    <th className="px-2 py-2">Hours</th>
                    <th className="px-2 py-2">Assigned Shift</th>
                    <th className="px-2 py-2">Shift Status</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Assign Shift</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard.employees || []).map((row: any) => (
                    <tr key={row.employee_id} className="border-b border-slate-100">
                      <td className="px-2 py-2"><div className="font-medium text-slate-800">{row.name}</div><div className="text-xs text-slate-500">{row.employee_code}</div></td>
                      <td className="px-2 py-2">{row.department || '-'}</td>
                      <td className="px-2 py-2">{row.location || '-'}</td>
                      <td className="px-2 py-2">{toTime(row.punch_in_time)}</td>
                      <td className="px-2 py-2">{toTime(row.punch_out_time)}</td>
                      <td className="px-2 py-2">{toFixedHours(row.working_hours)}</td>
                      <td className="px-2 py-2">{row.assigned_shift || 'Not Assigned'}</td>
                      <td className="px-2 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.shift_assignment_status === 'Shift Assigned'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          {row.shift_assignment_status || 'Not Assigned'}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass[row.status as AttendanceStatus] || statusClass.NOT_MARKED}`}>
                          {statusLabel[row.status as AttendanceStatus] || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={rowShiftSelection[row.employee_id] || ''}
                            onChange={(event) =>
                              setRowShiftSelection((prev) => ({
                                ...prev,
                                [row.employee_id]: event.target.value,
                              }))
                            }
                            className="h-8 rounded-md border border-slate-200 px-2 text-xs"
                          >
                            <option value="">Select shift</option>
                            {shifts.map((shift) => (
                              <option key={shift.id} value={shift.id}>
                                {shift.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            disabled={rowAssigningEmployeeId === row.employee_id}
                            onClick={() => void assignShiftToRow(row.employee_id)}
                          >
                            {rowAssigningEmployeeId === row.employee_id ? 'Saving...' : 'Assign'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'reports' && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <select value={reportMonth} onChange={(e) => setReportMonth(Number(e.target.value))} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('en-US', { month: 'long' })}</option>)}
            </select>
            <select value={reportYear} onChange={(e) => setReportYear(Number(e.target.value))} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <Button onClick={() => void loadMonthly()}>Load Monthly Summary</Button>
            <Button onClick={() => void runAbsentAutomation()} variant="outline">Run Absent Automation</Button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Monthly Attendance Summary</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Employee</th>
                    <th className="px-2 py-2">Present</th>
                    <th className="px-2 py-2">Late</th>
                    <th className="px-2 py-2">Leave</th>
                    <th className="px-2 py-2">Half Day</th>
                    <th className="px-2 py-2">Absent</th>
                    <th className="px-2 py-2">Work Hours</th>
                    <th className="px-2 py-2">Overtime</th>
                    <th className="px-2 py-2">Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-2 py-2"><div className="font-medium text-slate-800">{row.employee_name}</div><div className="text-xs text-slate-500">{row.employee_code}</div></td>
                      <td className="px-2 py-2">{row.present_days}</td>
                      <td className="px-2 py-2">{row.late_days}</td>
                      <td className="px-2 py-2">{row.leave_days}</td>
                      <td className="px-2 py-2">{row.half_days}</td>
                      <td className="px-2 py-2">{row.absent_days}</td>
                      <td className="px-2 py-2">{toFixedHours(row.total_working_hours)}</td>
                      <td className="px-2 py-2">{toFixedHours(row.overtime_hours)}</td>
                      <td className="px-2 py-2">{toFixedHours(row.payable_days)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'config' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <form onSubmit={createShift} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">Create Shift</h2>
            <input className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Shift name" value={shiftForm.name} onChange={(e) => setShiftForm((p) => ({ ...p, name: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-2">
              <input type="time" className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={shiftForm.start_time} onChange={(e) => setShiftForm((p) => ({ ...p, start_time: e.target.value }))} required />
              <input type="time" className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={shiftForm.end_time} onChange={(e) => setShiftForm((p) => ({ ...p, end_time: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="time" className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={shiftForm.late_after} onChange={(e) => setShiftForm((p) => ({ ...p, late_after: e.target.value }))} required />
              <input type="time" className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={shiftForm.half_day_after} onChange={(e) => setShiftForm((p) => ({ ...p, half_day_after: e.target.value }))} required />
            </div>
            <label className="text-sm text-slate-600"><input type="checkbox" className="mr-2" checked={shiftForm.overtime_allowed} onChange={(e) => setShiftForm((p) => ({ ...p, overtime_allowed: e.target.checked }))} />Overtime allowed</label>
            <Button type="submit">Create Shift</Button>
          </form>

          <form onSubmit={createLocation} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">Create Office Location</h2>
            <input className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Location name" value={locationForm.name} onChange={(e) => setLocationForm((p) => ({ ...p, name: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" step="0.000001" className="rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Latitude" value={locationForm.latitude} onChange={(e) => setLocationForm((p) => ({ ...p, latitude: e.target.value }))} required />
              <input type="number" step="0.000001" className="rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Longitude" value={locationForm.longitude} onChange={(e) => setLocationForm((p) => ({ ...p, longitude: e.target.value }))} required />
            </div>
            <input type="number" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Allowed radius meters" value={locationForm.allowed_radius_meters} onChange={(e) => setLocationForm((p) => ({ ...p, allowed_radius_meters: Number(e.target.value) }))} required />
            <Button type="submit">Create Office Location</Button>
          </form>

          <form onSubmit={createPolicy} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">Create Attendance Policy</h2>
            <input className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Policy name" value={policyForm.name} onChange={(e) => setPolicyForm((p) => ({ ...p, name: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Min half-day hours" value={policyForm.min_half_day_hours} onChange={(e) => setPolicyForm((p) => ({ ...p, min_half_day_hours: e.target.value }))} />
              <input className="rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Full-day hours" value={policyForm.full_day_hours} onChange={(e) => setPolicyForm((p) => ({ ...p, full_day_hours: e.target.value }))} />
            </div>
            <input className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Week-off days e.g. 5,6" value={policyForm.week_off_days} onChange={(e) => setPolicyForm((p) => ({ ...p, week_off_days: e.target.value }))} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-600">
              <label><input type="checkbox" className="mr-2" checked={policyForm.enforce_gps} onChange={(e) => setPolicyForm((p) => ({ ...p, enforce_gps: e.target.checked }))} />Enforce GPS</label>
              <label><input type="checkbox" className="mr-2" checked={policyForm.allow_remote_punch} onChange={(e) => setPolicyForm((p) => ({ ...p, allow_remote_punch: e.target.checked }))} />Allow Remote</label>
              <label><input type="checkbox" className="mr-2" checked={policyForm.auto_mark_absent} onChange={(e) => setPolicyForm((p) => ({ ...p, auto_mark_absent: e.target.checked }))} />Auto Absent</label>
            </div>
            <Button type="submit">Create Policy</Button>
          </form>

          <form onSubmit={assignShift} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">Assign Shift</h2>
            <select className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={assignmentForm.employee_id} onChange={(e) => setAssignmentForm((p) => ({ ...p, employee_id: e.target.value }))} required>
              <option value="">Employee</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_id})</option>)}
            </select>
            <select className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={assignmentForm.shift_id} onChange={(e) => setAssignmentForm((p) => ({ ...p, shift_id: e.target.value }))} required>
              <option value="">Shift</option>
              {shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
            </select>
            <select className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={assignmentForm.office_location_id} onChange={(e) => setAssignmentForm((p) => ({ ...p, office_location_id: e.target.value }))}>
              <option value="">Office Location (optional)</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
            <select className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={assignmentForm.policy_id} onChange={(e) => setAssignmentForm((p) => ({ ...p, policy_id: e.target.value }))}>
              <option value="">Policy (optional)</option>
              {policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}
            </select>
            <input type="date" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={assignmentForm.effective_from} onChange={(e) => setAssignmentForm((p) => ({ ...p, effective_from: e.target.value }))} required />
            <Button type="submit">Assign</Button>
          </form>
        </div>
      )}

      {loading ? <div className="text-sm text-slate-500">Loading attendance module...</div> : null}
    </div>
  );
};

export default AttendancePage;

