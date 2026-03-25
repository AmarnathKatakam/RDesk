/**
 * Component: pages\EmployeeDashboard.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useState } from 'react';
import { Clock, CalendarDays, Users, Award, FileText, Clock3, LogIn, LogOut as LogOutIcon, Timer } from 'lucide-react';
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
import { attendanceAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/StatCard';
import { format } from 'date-fns';
import { usePunchInFlow } from '@/hooks/usePunchInFlow';

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
  const [actionLoading, setActionLoading] = useState<'IN' | 'OUT' | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const userId = localStorage.getItem('userId') || undefined;

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load dashboard data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        if (!userId) return;

        const [dashboardRes, todayRes] = await Promise.all([
          attendanceAPI.getEmployeeDashboard(userId),
          attendanceAPI.getToday(userId)
        ]);

        setDashboardData(dashboardRes.data);
        setTodayAttendance(todayRes.data?.data);
      } catch (error) {
        console.error('Dashboard load error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const reloadDashboard = async () => {
    try {
      if (!userId) return;
      const [dashboardRes, todayRes] = await Promise.all([
        attendanceAPI.getEmployeeDashboard(userId),
        attendanceAPI.getToday(userId)
      ]);

      setDashboardData(dashboardRes.data);
      setTodayAttendance(todayRes.data?.data);
    } catch (error) {
      console.error('Dashboard reload error:', error);
    }
  };

  const { beginPunchIn, dialog: punchInDialog, submitting: punchInSubmitting } = usePunchInFlow({
    employeeId: userId,
    onSuccess: async (message) => {
      setActionError('');
      setActionSuccess(message);
      await reloadDashboard();
    },
    onError: (message) => {
      setActionSuccess('');
      setActionError(message);
    },
  });

  const getLocation = (): Promise<{ latitude: number; longitude: number }> => 
    new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }),
        reject,
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  const handleSwipe = async (type: 'IN' | 'OUT') => {
    try {
      setActionLoading(type);
      setActionError('');
      setActionSuccess('');
      const coords = await getLocation();
      if (type === 'IN') {
        await attendanceAPI.punchIn({
          latitude: coords.latitude,
          longitude: coords.longitude
        });
      } else {
        await attendanceAPI.punchOut({
          latitude: coords.latitude,
          longitude: coords.longitude
        });
      }
      setActionSuccess('Punch out recorded successfully.');
      await reloadDashboard();
    } catch (error) {
      console.error('Swipe error:', error);
      setActionError('Unable to mark attendance.');
    } finally {
      setActionLoading(null);
    }
  };

  const employee = dashboardData?.employee;
  const cards = dashboardData?.cards || defaultCards;
  const today = dashboardData?.today || defaultToday;

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
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-4 sm:px-6 py-4">
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
        {/* Quick Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {/* Review Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-100 rounded-xl">
                <Award className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Review</h3>
                <p className="text-sm text-slate-500">Pending approvals & documents</p>
              </div>
            </div>
            <div className="space-y-2">
              {cards.review?.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {item.status}
                  </span>
                </div>
              )) || <p className="text-slate-500 italic">Hurrah! You have nothing to review.</p>}
            </div>
          </div>

          {/* Who is in? */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Who is in?</h3>
              </div>
            </div>
            <div className="space-y-3">
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
                  <Button variant="link" className="h-auto p-0 text-sm font-medium text-blue-600 hover:text-blue-700">
                    View Payslip →
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
          {actionError ? (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {actionError}
            </div>
          ) : null}
          {actionSuccess ? (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {actionSuccess}
            </div>
          ) : null}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Today's Attendance</h2>
              <p className="text-slate-500">Swipe in/out with GPS verification. Location is used only at punch time.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() => void beginPunchIn()}
                disabled={actionLoading === 'IN' || punchInSubmitting || !todayAttendance || todayAttendance.punch_in_time}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
              >
                <LogIn className="h-4 w-4 mr-2" />
                {punchInSubmitting ? 'Swiping In...' : 'Swipe In'}
              </Button>
              <Button
                size="lg"
                onClick={() => handleSwipe('OUT')}
                disabled={actionLoading === 'OUT' || punchInSubmitting || !todayAttendance || !todayAttendance.punch_in_time || todayAttendance.punch_out_time}
                className="bg-slate-800 hover:bg-slate-900 text-white shadow-lg"
              >
                <LogOutIcon className="h-4 w-4 mr-2" />
                {actionLoading === 'OUT' ? 'Swiping Out...' : 'Swipe Out'}
              </Button>
            </div>
          </div>

          {/* Today's Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard 
              title="Status" 
              value={todayAttendance ? statusLabel[todayAttendance.status as AttendanceStatus] : 'Not Marked'} 
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
              title="Work Hours" 
              value={todayAttendance ? toFixedHours(todayAttendance.working_hours) : '0.00'} 
              icon={Timer} 
              color="accent" 
            />
          </div>

          {/* Monthly Calendar - Simplified */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <h3 className="text-lg font-semibold mb-4">Monthly Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Present</span>
                  <span className="font-semibold">{dashboardData?.cards.summary?.present_days || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Late</span>
                  <span className="font-semibold text-amber-600">{dashboardData?.cards.summary?.late_days || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Absent</span>
                  <span className="font-semibold text-rose-600">{dashboardData?.cards.summary?.absent_days || 0}</span>
                </div>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="grid grid-cols-7 gap-2 text-center">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
                  <div key={day} className="font-semibold text-slate-600 py-2">{day}</div>
                ))}
                {/* Calendar days would go here */}
                {Array.from({ length: 35 }).map((_, idx) => (
                  <div key={idx} className="h-16 border rounded-lg bg-slate-50 flex items-center justify-center text-xs cursor-pointer hover:bg-slate-100">
                    {idx + 1}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {punchInDialog}
    </div>
  );
};

export default EmployeeDashboardPage;


