/**
* Component: pages\EmployeeDashboard.tsx
* Purpose: Defines UI structure and behavior for this view/component.
*/
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Clock, CalendarDays, Users, Award, FileText, Clock3, LogIn, LogOut as LogOutIcon, Timer, Upload, TrendingUp, Star } from 'lucide-react';
import { usePunchInFlow, usePunchOutFlow } from '@/hooks/usePunchInFlow';
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

const toTime = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';

const toFixedHours = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
};

const statusDotClass: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-600',
  LATE: 'bg-amber-500',
  HALF_DAY: 'bg-orange-500',
  ABSENT: 'bg-rose-500',
  LEAVE: 'bg-sky-500',
  HOLIDAY: 'bg-indigo-500',
  WEEK_OFF: 'bg-slate-400',
  NOT_MARKED: 'bg-slate-300',
};

const statusTileClass: Record<AttendanceStatus, string> = {
  PRESENT: 'border-emerald-100 bg-emerald-50/80 text-emerald-800',
  LATE: 'border-amber-100 bg-amber-50/90 text-amber-700',
  HALF_DAY: 'border-orange-100 bg-orange-50/90 text-orange-700',
  ABSENT: 'border-rose-100 bg-rose-50/90 text-rose-700',
  LEAVE: 'border-sky-100 bg-sky-50/90 text-sky-700',
  HOLIDAY: 'border-indigo-100 bg-indigo-50/90 text-indigo-700',
  WEEK_OFF: 'border-slate-200 bg-slate-50 text-slate-500',
  NOT_MARKED: 'border-slate-200 bg-white text-slate-500',
};
import { attendanceAPI } from '@/services/api';
import StatCard from '@/components/StatCard';
import { format } from 'date-fns';

interface DashboardData {
  success: boolean;
  employee: {
    name: string;
    employee_id: string;
    department?: string;
  };
  today: {
    date: string;
    team_present: number;
    team_late: number;
    team_total: number;
  };
  cards: {
    review: Array<{ title: string; status: string }>;
    who_is_in: {
      on_time: number;
      late: number;
    };
    upcoming_holidays: Array<{
      name: string;
      date: string;
      is_optional: boolean;
    }>;
    team_on_leave: Array<{
      id: number;
      employee_name: string;
      leave_type: string;
      start_date: string;
      end_date: string;
    }>;
    payslip: {
      has_latest: boolean;
      month?: string;
      year?: number;
    };
    summary: {
      present_days: number;
      late_days: number;
      leave_days: number;
      absent_days: number;
      half_days: number;
      total_working_hours: number;
      overtime_hours: number;
      payable_days: number;
    };
  };
}

interface MonthlySummary {
  present_days: number;
  late_days: number;
  leave_days: number;
  absent_days: number;
  half_days: number;
  total_working_hours: number;
  overtime_hours: number;
  payable_days?: number;
}

interface CalendarDay {
  date: string;
  status: AttendanceStatus;
  punch_in_time: string | null;
  punch_out_time: string | null;
  working_hours: number;
}

const defaultCards: DashboardData['cards'] = {
  review: [],
  who_is_in: {
    on_time: 0,
    late: 0,
  },
  upcoming_holidays: [],
  team_on_leave: [],
  payslip: {
    has_latest: false,
  },
  summary: {
    present_days: 0,
    late_days: 0,
    leave_days: 0,
    absent_days: 0,
    half_days: 0,
    total_working_hours: 0,
    overtime_hours: 0,
    payable_days: 0,
  },
};

const defaultToday: DashboardData['today'] = {
  date: '',
  team_present: 0,
  team_late: 0,
  team_total: 0,
};

const EmployeeDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    // Helper for time-based greeting
    const getGreeting = () => {
      const hour = currentTime.getHours();
      if (hour < 12) return 'Good morning';
      if (hour < 17) return 'Good afternoon';
      return 'Good evening';
    };
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [monthlyCalendarDays, setMonthlyCalendarDays] = useState<CalendarDay[]>([]);
  const [ytdData, setYtdData] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getEmployeeId = () => {
    const storedId = localStorage.getItem('userId');
    if (storedId && storedId !== 'undefined' && storedId !== 'null') return storedId;

    const userJson = localStorage.getItem('user');
    if (userJson) {
      try {
        const parsed = JSON.parse(userJson);
        if (parsed?.id) return String(parsed.id);
      } catch {
        // ignore malformed user payload
      }
    }

    return undefined;
  };

  const employeeId = getEmployeeId();

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      if (!employeeId) {
        setDashboardData(null);
        setTodayAttendance(null);
        setMonthlySummary(null);
        setMonthlyCalendarDays([]);
        setYtdData(null);
        return;
      }

      const monthNow = new Date();
      const currentMonth = monthNow.getMonth() + 1;
      const currentYear = monthNow.getFullYear();

      const [dashboardRes, todayRes, monthlyRes, ytdRes] = await Promise.allSettled([
        attendanceAPI.getEmployeeDashboard(employeeId),
        attendanceAPI.getToday(employeeId),
        attendanceAPI.getMonthly({ month: currentMonth, year: currentYear, employee_id: employeeId }),
        attendanceAPI.getEmployeeYTD(),
      ]);

      if (dashboardRes.status === 'fulfilled' && dashboardRes.value.data) {
        setDashboardData(dashboardRes.value.data);
      } else {
        setDashboardData(null);
      }

      if (todayRes.status === 'fulfilled') {
        setTodayAttendance(todayRes.value.data?.data || {
          status: 'NOT_MARKED',
          punch_in_time: null,
          punch_out_time: null,
          working_hours: 0,
        });
      } else {
        setTodayAttendance({
          status: 'NOT_MARKED',
          punch_in_time: null,
          punch_out_time: null,
          working_hours: 0,
        });
      }

      if (monthlyRes.status === 'fulfilled') {
        setMonthlySummary(monthlyRes.value.data?.summary || null);
        setMonthlyCalendarDays(Array.isArray(monthlyRes.value.data?.calendar) ? monthlyRes.value.data.calendar : []);
      } else {
        setMonthlySummary(null);
        setMonthlyCalendarDays([]);
      }

      if (ytdRes.status === 'fulfilled') {
        setYtdData(ytdRes.value.data);
      } else {
        setYtdData(null);
      }

      const failedRequests = [dashboardRes, todayRes, monthlyRes, ytdRes].filter(
        (result) => result.status === 'rejected'
      );

      if (failedRequests.length === 4) {
        setError('Failed to load attendance data.');
      } else if (failedRequests.length > 0) {
        setError('Some dashboard data could not be loaded. Showing the available information.');
      }
    } catch (err: any) {
      console.error('Dashboard load error:', err);
      setError(err?.response?.data?.message || 'Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  };

  // Load dashboard data
  useEffect(() => {
    void loadData();
  }, [employeeId]);

  const { beginPunchIn, dialog: punchInDialog, submitting: punchInSubmitting } = usePunchInFlow({
    employeeId,
    onSuccess: async (message) => {
      setError('');
      setSuccess(message);
      await loadData();
    },
    onError: (message) => {
      setSuccess('');
      setError(message);
    },
  });

  const { beginPunchOut, dialog: punchOutDialog, submitting: punchOutSubmitting } = usePunchOutFlow({
    employeeId,
    onSuccess: async (message) => {
      setError('');
      setSuccess(message);
      await loadData();
    },
    onError: (message) => {
      setSuccess('');
      setError(message);
    },
  });

  const employee = dashboardData?.employee;
  const cards = dashboardData?.cards || defaultCards;
  const today = dashboardData?.today || defaultToday;
  const reviewItems = cards.review || [];
  const activeMonthlySummary = monthlySummary || cards.summary || defaultCards.summary;
  const currentMonthDate = new Date(currentTime.getFullYear(), currentTime.getMonth(), 1);
  const currentMonthLabel = currentMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const daysInCurrentMonth = new Date(currentTime.getFullYear(), currentTime.getMonth() + 1, 0).getDate();
  const firstWeekday = currentMonthDate.getDay();
  const calendarByDate = useMemo(() => {
    return monthlyCalendarDays.reduce<Record<string, CalendarDay>>((acc, day) => {
      acc[day.date] = day;
      return acc;
    }, {});
  }, [monthlyCalendarDays]);
  const calendarCells = useMemo(() => {
    const blanks = Array.from({ length: firstWeekday }, (_, index) => ({ type: 'blank' as const, key: `blank-${index}` }));
    const days = Array.from({ length: daysInCurrentMonth }, (_, index) => {
      const dayNumber = index + 1;
      const dateKey = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
      return { type: 'day' as const, key: dateKey, dayNumber, data: calendarByDate[dateKey] };
    });
    return [...blanks, ...days];
  }, [calendarByDate, currentTime, daysInCurrentMonth, firstWeekday]);
  const presentDays = Number(activeMonthlySummary.present_days || 0);
  const lateDays = Number(activeMonthlySummary.late_days || 0);
  const absentDays = Number(activeMonthlySummary.absent_days || 0);
  const countedDays = presentDays + lateDays + absentDays;
  const attendancePercent = countedDays ? Math.round(((presentDays + lateDays) / countedDays) * 100) : 0;
  const averageWorkHours = presentDays + lateDays + Number(activeMonthlySummary.half_days || 0)
    ? Number(activeMonthlySummary.total_working_hours || 0) / (presentDays + lateDays + Number(activeMonthlySummary.half_days || 0))
    : 0;
  const bestStreak = useMemo(() => {
    let current = 0;
    let best = 0;
    let currentStart: Date | null = null;
    let bestStart: Date | null = null;
    let bestEnd: Date | null = null;
    monthlyCalendarDays.forEach((day) => {
      if (day.status === 'PRESENT' || day.status === 'LATE') {
        const dayDate = new Date(day.date);
        if (!currentStart) {
          currentStart = dayDate;
        }
        current += 1;
        if (current > best) {
          best = current;
          bestStart = currentStart;
          bestEnd = dayDate;
        }
      } else if (day.status === 'ABSENT') {
        current = 0;
        currentStart = null;
      }
    });
    return {
      days: best,
      label: bestStart && bestEnd ? `${format(bestStart, 'MMM d')} - ${format(bestEnd, 'MMM d')}` : 'This month',
    };
  }, [monthlyCalendarDays]);
  const attendanceStatus = (todayAttendance?.status || 'NOT_MARKED') as AttendanceStatus;
  const teamTotal = (today.team_total ?? today.team_present + today.team_late) + 1;
  const canPunchIn =
    !todayAttendance?.punch_in_time &&
    attendanceStatus !== 'LEAVE' &&
    attendanceStatus !== 'HOLIDAY' &&
    attendanceStatus !== 'WEEK_OFF';
  const canPunchOut = Boolean(todayAttendance?.punch_in_time && !todayAttendance?.punch_out_time);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-500 animate-spin">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 top-0 z-50 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Hi {employee?.name ? employee.name : ''}, {getGreeting()}
            </h1>
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {format(currentTime, 'dd MMMM yyyy, HH:mm:ss')}
            </p>
          </div>
          {/* Sign Out button removed */}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}
        {success ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
        ) : null}

        {/* Quick Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {/* Employee Details Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl">
                  <Award className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Employee Details</h3>
                  <p className="text-sm text-slate-500">Synced from your employee record</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/employee/documents')}
                className="border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Docs
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Employee ID</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{employee?.employee_id || '-'}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Department</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{employee?.department || '-'}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Team Employees</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{(today.team_total || 0) + 1}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Hurrah! You have nothing to review.</p>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">completed</span>
            </div>
          </div>

          {/* Who is in? */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">
                  Team<br />Attendance
                </h3>
                <p className="text-sm text-slate-500">Today</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Total</span>
                <span className="font-semibold text-slate-900">{teamTotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>On Time</span>
                <span className="font-semibold text-emerald-600">{today.team_present}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Late</span>
                <span className="font-semibold text-amber-600">{today.team_late}</span>
              </div>
            </div>
          </div>

          {/* Upcoming Holidays */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-xl">
                <CalendarDays className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Upcoming Holidays</h3>
              </div>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {cards.upcoming_holidays?.length ? (
                cards.upcoming_holidays.map((holiday, idx) => (
                  <div key={idx} className="text-sm p-2 bg-slate-50 rounded-lg">
                    <div className="font-medium">{holiday.name}</div>
                    <div className="text-xs text-slate-500">{format(new Date(holiday.date), 'MMM dd')}</div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 italic">No upcoming holidays</p>
              )}
            </div>
          </div>

          {/* Team on Leave */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 rounded-xl">
                <Users className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Team on Leave</h3>
              </div>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {cards.team_on_leave?.length ? (
                cards.team_on_leave.slice(0, 3).map((leave, idx) => (
                  <div key={idx} className="text-sm p-2 bg-slate-50 rounded-lg truncate">
                    {leave.employee_name} - {leave.leave_type}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 italic">No team members on leave</p>
              )}
            </div>
          </div>

          {/* Payslip */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-xl">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Payslip</h3>
              </div>
            </div>
            <div>
              {cards.payslip?.has_latest ? (
                <div>
                  <p className="text-sm font-medium">{cards.payslip.month} {cards.payslip.year}</p>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => navigate('/employee/payslips')}
                    className="h-auto p-0 text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    View Payslip
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">Not available</p>
              )}
            </div>
          </div>

        </div>

        {/* Attendance Section */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Today's Attendance</h2>
              <p className="text-slate-500">Swipe in/out with GPS verification</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() => void beginPunchIn()}
                disabled={loading || !canPunchIn || punchInSubmitting || punchOutSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
              >
                <LogIn className="h-4 w-4 mr-2" />
                {punchInSubmitting ? 'Swiping In...' : 'Swipe In'}
              </Button>
              <Button
                size="lg"
                onClick={() => void beginPunchOut()}
                disabled={loading || !canPunchOut || punchInSubmitting || punchOutSubmitting}
                className="bg-slate-800 hover:bg-slate-900 text-white shadow-lg"
              >
                <LogOutIcon className="h-4 w-4 mr-2" />
                {punchOutSubmitting ? 'Swiping Out...' : 'Swipe Out'}
              </Button>
            </div>
          </div>

          {/* Today's Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <StatCard 
              title="Status" 
              value={statusLabel[attendanceStatus] || 'Not Marked'} 
              icon={Clock3} 
              color="primary" 
            />
            <StatCard 
              title="Punch In" 
              value={todayAttendance ? toTime(todayAttendance.punch_in_time) : '-'} 
              icon={LogIn} 
              color="success" 
            />
            <StatCard
              title="Punch Out"
              value={todayAttendance ? toTime(todayAttendance.punch_out_time) : '-'}
              icon={LogOutIcon}
              color="warning"
            />
            <StatCard 
              title="Work Hours" 
              value={todayAttendance ? toFixedHours(todayAttendance.working_hours) : '0.00'} 
              icon={Timer} 
              color="accent" 
            />
          </div>

          {/* Monthly Summary */}
          <div>
            <h3 className="text-xl font-bold text-slate-900 mb-4">Monthly Summary</h3>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-1">
                <h4 className="text-base font-semibold text-slate-900">Attendance Overview</h4>
                <div className="mt-6 flex flex-col sm:flex-row xl:flex-col 2xl:flex-row items-center gap-6">
                  <div
                    className="relative h-44 w-44 shrink-0 rounded-full"
                    style={{
                      background: `conic-gradient(#34c78a 0 ${presentDays * 360 / Math.max(countedDays, 1)}deg, #f59e0b ${presentDays * 360 / Math.max(countedDays, 1)}deg ${(presentDays + lateDays) * 360 / Math.max(countedDays, 1)}deg, #e11d48 ${(presentDays + lateDays) * 360 / Math.max(countedDays, 1)}deg 360deg)`,
                    }}
                  >
                    <div className="absolute inset-9 rounded-full bg-white shadow-inner flex flex-col items-center justify-center text-center">
                      <span className="text-sm text-slate-600">Total Days</span>
                      <span className="text-3xl font-bold text-slate-900">{daysInCurrentMonth}</span>
                    </div>
                  </div>
                  <div className="w-full space-y-4">
                    {[
                      { label: 'Present', value: presentDays, color: 'bg-emerald-500' },
                      { label: 'Late', value: lateDays, color: 'bg-amber-500' },
                      { label: 'Absent', value: absentDays, color: 'bg-rose-500' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-3">
                          <span className={`h-3.5 w-3.5 rounded-full ${item.color}`} />
                          <span className="text-slate-700">{item.label}</span>
                        </div>
                        <span className="font-medium text-slate-900">
                          {item.value} ({countedDays ? ((item.value / countedDays) * 100).toFixed(1) : '0.0'}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="min-h-[132px] rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-3 shadow-sm">
                    <CalendarDays className="h-6 w-6 text-emerald-600" />
                    <p className="mt-4 text-[11px] font-semibold text-slate-600 leading-tight">Best Streak</p>
                    <p className="mt-2 text-base font-bold text-slate-900 leading-tight">{bestStreak.days} Days</p>
                    <p className="mt-1 text-[10px] font-medium text-slate-600 leading-tight">{bestStreak.label}</p>
                  </div>
                  <div className="min-h-[132px] rounded-lg border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-3 shadow-sm">
                    <TrendingUp className="h-6 w-6 text-sky-600" />
                    <p className="mt-4 text-[11px] font-semibold text-slate-600 leading-tight">Avg. Work Hours</p>
                    <p className="mt-2 text-base font-bold text-slate-900 leading-tight">{averageWorkHours.toFixed(2)} hrs</p>
                  </div>
                  <div className="min-h-[132px] rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-3 shadow-sm">
                    <Star className="h-6 w-6 text-violet-600" />
                    <p className="mt-4 text-[11px] font-semibold text-slate-600 leading-tight">Attendance %</p>
                    <p className="mt-2 text-base font-bold text-slate-900 leading-tight">{attendancePercent}%</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-2 overflow-x-auto">
                <div className="min-w-[680px]">
                  <div className="mb-5 text-center text-base font-semibold text-slate-900">{currentMonthLabel}</div>
                  <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium text-slate-700">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="py-1">{day}</div>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-7 gap-2">
                    {calendarCells.map((cell) => {
                      if (cell.type === 'blank') {
                        return <div key={cell.key} className="h-16 rounded-lg border border-transparent" />;
                      }
                      const status = (cell.data?.status || 'NOT_MARKED') as AttendanceStatus;
                      return (
                        <div
                          key={cell.key}
                          className={`h-16 rounded-lg border flex flex-col items-center justify-center gap-2 text-sm font-semibold ${statusTileClass[status]}`}
                        >
                          <span>{cell.dayNumber}</span>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass[status]}`} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-slate-700">
                    {[
                      { label: 'Present', status: 'PRESENT' as AttendanceStatus },
                      { label: 'Late', status: 'LATE' as AttendanceStatus },
                      { label: 'Absent', status: 'ABSENT' as AttendanceStatus },
                      { label: 'Not Set', status: 'NOT_MARKED' as AttendanceStatus },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${statusDotClass[item.status]}`} />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {punchInDialog}
      {punchOutDialog}
    </div>
  );
};

export default EmployeeDashboardPage;


 
