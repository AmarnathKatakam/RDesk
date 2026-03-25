/**
 * Component: components\dashboard\DashboardWidgets.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useState, useEffect } from 'react';
import { Users, UserPlus, UserCheck, DollarSign, Clock, AlertCircle, CheckCircle, XCircle, Calendar, CalendarCheck, CalendarX, Loader2, AlertTriangle } from 'lucide-react';
import { dashboardAPI } from '@/services/api';

// Types for API responses
interface EmployeeSummary {
  total: number;
  active: number;
  new_hires: number;
}

interface PayrollSummary {
  processed: number;
  pending: number;
  next_payroll_date: string;
}

interface AttendanceData {
  present: number;
  absent: number;
  late: number;
}

interface LeaveData {
  pending: number;
  approved: number;
}

const DashboardWidgets: React.FC = () => {
  // State for all widgets
  const [employeeSummary, setEmployeeSummary] = useState<EmployeeSummary | null>(null);
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [leaveData, setLeaveData] = useState<LeaveData | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchAllWidgetData = async () => {
      try {
        setLoading(true);
        setErrors({});

        // Fetch all data in parallel
        const [
          employeeRes,
          payrollRes,
          attendanceRes,
          leaveRes
        ] = await Promise.allSettled([
          dashboardAPI.getEmployeeSummary(),
          dashboardAPI.getPayrollMonthSummary(),
          dashboardAPI.getAttendanceTodaySummary(),
          dashboardAPI.getLeaveOverview(),
        ]);

        // Handle Employee Summary
        if (employeeRes.status === 'fulfilled' && employeeRes.value.data) {
          setEmployeeSummary(employeeRes.value.data);
        } else {
          setErrors(prev => ({ ...prev, employee: true }));
        }

        // Handle Payroll Summary
        if (payrollRes.status === 'fulfilled' && payrollRes.value.data) {
          setPayrollSummary(payrollRes.value.data);
        } else {
          setErrors(prev => ({ ...prev, payroll: true }));
        }

        // Handle Attendance
        if (attendanceRes.status === 'fulfilled' && attendanceRes.value.data) {
          setAttendanceData(attendanceRes.value.data);
        } else {
          setErrors(prev => ({ ...prev, attendance: true }));
        }

        // Handle Leave
        if (leaveRes.status === 'fulfilled' && leaveRes.value.data) {
          setLeaveData(leaveRes.value.data);
        } else {
          setErrors(prev => ({ ...prev, leave: true }));
        }
      } catch (err) {
        console.error('Failed to fetch widget data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllWidgetData();
  }, []);

  // Calculate active rate
  const activeRate = employeeSummary?.total 
    ? ((employeeSummary.active / employeeSummary.total) * 100).toFixed(1)
    : '0';

  // Calculate attendance percentage
  const totalAttendance = attendanceData 
    ? attendanceData.present + attendanceData.absent + attendanceData.late 
    : 0;
  const attendancePercent = totalAttendance 
    ? Math.round((attendanceData.present / totalAttendance) * 100) 
    : 0;

  // Format currency
  const formatCurrency = (amount: number): string => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)}Cr`;
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    } else if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}K`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-roth-accent" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Employee Summary Widget */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-roth-accent" />
            <h3 className="font-semibold text-gray-900">Employee Summary</h3>
            {errors.employee && (
              <AlertTriangle className="h-4 w-4 text-amber-500 ml-auto" />
            )}
          </div>
        </div>
        <div className="p-6">
          {errors.employee ? (
            <div className="flex items-center justify-center py-4 text-amber-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>Failed to load employee data</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{employeeSummary?.total ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Total</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                    <UserCheck className="h-6 w-6 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{employeeSummary?.active ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Active</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                    <UserPlus className="h-6 w-6 text-amber-600" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{employeeSummary?.new_hires ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">New Hires</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Active Rate</span>
                  <span className="font-semibold text-emerald-600">{activeRate}%</span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${activeRate}%` }}
                  ></div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payroll Summary Widget */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-roth-accent" />
            <h3 className="font-semibold text-gray-900">Payroll Summary</h3>
            {errors.payroll && (
              <AlertTriangle className="h-4 w-4 text-amber-500 ml-auto" />
            )}
          </div>
        </div>
        <div className="p-6">
          {errors.payroll ? (
            <div className="flex items-center justify-center py-4 text-amber-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>Failed to load payroll data</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">Processed</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(payrollSummary?.processed ?? 0)}</p>
                  <p className="text-xs text-gray-500 mt-1">This Month</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700">Pending</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(payrollSummary?.pending ?? 0)}</p>
                  <p className="text-xs text-gray-500 mt-1">Awaiting</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Next Payroll Date</span>
                  <span className="font-semibold text-gray-900">{formatDate(payrollSummary?.next_payroll_date ?? '')}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Attendance Overview Widget */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-roth-accent" />
            <h3 className="font-semibold text-gray-900">Attendance Overview</h3>
            {errors.attendance && (
              <AlertTriangle className="h-4 w-4 text-amber-500 ml-auto" />
            )}
          </div>
        </div>
        <div className="p-6">
          {errors.attendance ? (
            <div className="flex items-center justify-center py-4 text-amber-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>Failed to load attendance data</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle className="h-8 w-8 text-emerald-600" />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{attendanceData?.present ?? 0}</p>
                  <p className="text-xs text-gray-500">Present</p>
                </div>
                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-2">
                    <XCircle className="h-8 w-8 text-rose-600" />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{attendanceData?.absent ?? 0}</p>
                  <p className="text-xs text-gray-500">Absent</p>
                </div>
                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2">
                    <Clock className="h-8 w-8 text-amber-600" />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{attendanceData?.late ?? 0}</p>
                  <p className="text-xs text-gray-500">Late</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-500">Today's Attendance</span>
                  <span className="font-semibold text-emerald-600">{attendancePercent}%</span>
                </div>
                <div className="flex w-full h-3 rounded-full overflow-hidden bg-gray-200">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    style={{ width: `${totalAttendance ? (attendanceData?.present ?? 0) / totalAttendance * 100 : 0}%` }}
                  ></div>
                  <div 
                    className="bg-rose-500 h-full transition-all duration-500" 
                    style={{ width: `${totalAttendance ? (attendanceData?.absent ?? 0) / totalAttendance * 100 : 0}%` }}
                  ></div>
                  <div 
                    className="bg-amber-500 h-full transition-all duration-500" 
                    style={{ width: `${totalAttendance ? (attendanceData?.late ?? 0) / totalAttendance * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Leave Overview Widget */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-roth-accent" />
            <h3 className="font-semibold text-gray-900">Leave Overview</h3>
            {errors.leave && (
              <AlertTriangle className="h-4 w-4 text-amber-500 ml-auto" />
            )}
          </div>
        </div>
        <div className="p-6">
          {errors.leave ? (
            <div className="flex items-center justify-center py-4 text-amber-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>Failed to load leave data</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarX className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700">Pending</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{leaveData?.pending ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Awaiting Approval</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarCheck className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">Approved</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{leaveData?.approved ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">This Month</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button className="w-full text-sm text-roth-accent hover:text-roth-secondary font-medium transition-colors flex items-center justify-center gap-1">
                  View All Leave Requests →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardWidgets;


