/**
 * Component: pages\EmployeeAttendance.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, MapPin, Timer, LogIn, LogOut } from 'lucide-react';
import { attendanceAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/StatCard';
import { usePunchInFlow } from '@/hooks/usePunchInFlow';

type AttendanceStatus =
  | 'PRESENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'ABSENT'
  | 'LEAVE'
  | 'HOLIDAY'
  | 'WEEK_OFF'
  | 'NOT_MARKED';

interface TodayAttendance {
  date: string;
  status: AttendanceStatus;
  punch_in_time: string | null;
  punch_out_time: string | null;
  working_hours: number;
  overtime_hours: number;
}

interface MonthlySummary {
  present_days: number;
  late_days: number;
  leave_days: number;
  absent_days: number;
  half_days: number;
  total_working_hours: number;
  overtime_hours: number;
}

interface CalendarDay {
  date: string;
  status: AttendanceStatus;
  punch_in_time: string | null;
  punch_out_time: string | null;
  working_hours: number;
}

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

const toTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '-';

const toFixedHours = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
};

const EmployeeAttendancePage: React.FC = () => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [todayData, setTodayData] = useState<TodayAttendance | null>(null);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'IN' | 'OUT' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const employeeId = localStorage.getItem('userId') || undefined;

  const loadAttendance = async () => {
    try {
      setLoading(true);
      setError('');
      const [todayRes, monthlyRes] = await Promise.all([
        attendanceAPI.getToday(employeeId),
        attendanceAPI.getMonthly({ month, year, employee_id: employeeId }),
      ]);
      setTodayData(todayRes.data?.data || null);
      setSummary(monthlyRes.data?.summary || null);
      setCalendarDays(Array.isArray(monthlyRes.data?.calendar) ? monthlyRes.data.calendar : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAttendance();
  }, [month, year]);

  const { beginPunchIn, dialog: punchInDialog, submitting: punchInSubmitting } = usePunchInFlow({
    employeeId,
    onSuccess: async (message) => {
      setError('');
      setSuccess(message);
      await loadAttendance();
    },
    onError: (message) => {
      setSuccess('');
      setError(message);
    },
  });

  const getCoordinates = (): Promise<{ latitude: number; longitude: number }> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported in this browser. Please enable location services.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        (geoError) => {
          if (geoError.code === geoError.PERMISSION_DENIED) {
            reject(new Error('Location permission denied. Please enable location access in your browser settings.'));
          } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
            reject(new Error('Location information is unavailable. Please try again or check your device settings.'));
          } else if (geoError.code === geoError.TIMEOUT) {
            reject(new Error('Location request timed out. Please try again.'));
          } else {
            reject(new Error('Unable to get your location. Please try again.'));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000,
        }
      );
    });

  const runPunch = async (mode: 'IN' | 'OUT') => {
    try {
      setActionLoading(mode);
      setError('');
      setSuccess('');
      const coords = await getCoordinates();
      if (mode === 'IN') {
        await attendanceAPI.punchIn({
          employee_id: employeeId,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        setSuccess('Punch in recorded successfully.');
      } else {
        await attendanceAPI.punchOut({
          employee_id: employeeId,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        setSuccess('Punch out recorded successfully.');
      }
      await loadAttendance();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to mark attendance.');
    } finally {
      setActionLoading(null);
    }
  };

  const canPunchIn = useMemo(
    () => Boolean(todayData && !todayData.punch_in_time && todayData.status !== 'LEAVE' && todayData.status !== 'HOLIDAY' && todayData.status !== 'WEEK_OFF'),
    [todayData]
  );
  const canPunchOut = useMemo(
    () => Boolean(todayData && todayData.punch_in_time && !todayData.punch_out_time),
    [todayData]
  );

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const monthLabel = new Date(year, month - 1, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Attendance</h1>
          <p className="text-sm text-slate-500">Punch in/out with GPS verification and review monthly attendance calendar.</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Today Status" value={statusLabel[(todayData?.status || 'NOT_MARKED') as AttendanceStatus]} icon={Clock3} color="primary" />
        <StatCard title="Punch In" value={toTime(todayData?.punch_in_time)} icon={LogIn} color="success" />
        <StatCard title="Punch Out" value={toTime(todayData?.punch_out_time)} icon={LogOut} color="warning" />
        <StatCard title="Today Work Hours" value={toFixedHours(todayData?.working_hours)} icon={Timer} color="accent" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Attendance Actions</h2>
            <p className="text-sm text-slate-500">Location is captured at the time of punch.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => void beginPunchIn()}
              disabled={!canPunchIn || actionLoading !== null || punchInSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <MapPin className="mr-2 h-4 w-4" />
              {punchInSubmitting ? 'Marking In...' : 'Swipe In'}
            </Button>
            <Button
              onClick={() => void runPunch('OUT')}
              disabled={!canPunchOut || actionLoading !== null || punchInSubmitting}
              className="bg-slate-800 hover:bg-slate-900"
            >
              <MapPin className="mr-2 h-4 w-4" />
              {actionLoading === 'OUT' ? 'Marking Out...' : 'Swipe Out'}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Attendance Calendar</h2>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleString('en-US', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Present Days</p>
            <p className="text-lg font-semibold text-slate-900">{summary?.present_days || 0}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Late Days</p>
            <p className="text-lg font-semibold text-slate-900">{summary?.late_days || 0}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Leave Days</p>
            <p className="text-lg font-semibold text-slate-900">{summary?.leave_days || 0}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Absent Days</p>
            <p className="text-lg font-semibold text-slate-900">{summary?.absent_days || 0}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Total Work Hours</p>
            <p className="text-lg font-semibold text-slate-900">{toFixedHours(summary?.total_working_hours)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Overtime Hours</p>
            <p className="text-lg font-semibold text-slate-900">{toFixedHours(summary?.overtime_hours)}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="mb-2 text-sm font-medium text-slate-700">{monthLabel}</div>
            <div className="grid grid-cols-7 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="px-2 py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {Array.from({ length: firstWeekday }).map((_, index) => (
                <div key={`blank-${index}`} className="h-24 rounded-lg border border-transparent" />
              ))}
              {calendarDays.map((day) => {
                const dayDate = new Date(day.date);
                const dayNum = dayDate.getDate();
                const code = (day.status || 'NOT_MARKED') as AttendanceStatus;
                return (
                  <div key={day.date} className="h-24 rounded-lg border border-slate-200 bg-white p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-700">{dayNum}</p>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass[code]}`}>
                        {statusLabel[code]}
                      </span>
                    </div>
                    <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                      <p>In: {toTime(day.punch_in_time)}</p>
                      <p>Out: {toTime(day.punch_out_time)}</p>
                      <p>Hrs: {toFixedHours(day.working_hours)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {loading ? <div className="text-sm text-slate-500">Loading attendance...</div> : null}
      {punchInDialog}
    </div>
  );
};

export default EmployeeAttendancePage;

