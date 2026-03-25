/**
 * Component: components\CEODashboard.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useState } from 'react';
import { Users, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as PieChartComponent,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { getJson, hrmsApi } from '@/services/hrmsApi';

interface DashboardStats {
  total_employees: number;
  active_employees: number;
  present_today: number;
  absent_today: number;
  on_leave_today: number;
  total_payroll: number;
  average_salary: number;
}

interface AttendanceData {
  date: string;
  present: number;
  absent: number;
}

interface LeaveStats {
  total_requests: number;
  approved: number;
  rejected: number;
  pending: number;
  by_type: Record<string, number>;
}

interface PayrollDistribution {
  department: string;
  payroll: number;
}

const CEODashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);
  const [leaveStats, setLeaveStats] = useState<LeaveStats | null>(null);
  const [payrollData, setPayrollData] = useState<PayrollDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6'];

  useEffect(() => {
    void loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const [overviewResponse, attendanceResponse, leaveResponse, payrollResponse] = await Promise.all([
        hrmsApi.getAnalyticsOverview(),
        hrmsApi.getAnalyticsAttendance(),
        hrmsApi.getAnalyticsLeave(),
        hrmsApi.getAnalyticsPayroll(),
      ]);

      if (overviewResponse.ok) {
        const data = await getJson<{ stats?: DashboardStats; overview?: DashboardStats }>(overviewResponse);
        setStats(data.stats || data.overview || null);
      }

      if (attendanceResponse.ok) {
        const data = await getJson<{ graph_data?: AttendanceData[]; attendance?: AttendanceData[] }>(attendanceResponse);
        setAttendanceData(data.graph_data || data.attendance || []);
      }

      if (leaveResponse.ok) {
        const data = await getJson<{ stats?: LeaveStats; leave_stats?: LeaveStats }>(leaveResponse);
        setLeaveStats(data.stats || data.leave_stats || null);
      }

      if (payrollResponse.ok) {
        const data = await getJson<{ distribution?: PayrollDistribution[]; payroll?: PayrollDistribution[] }>(payrollResponse);
        setPayrollData(data.distribution || data.payroll || []);
      }
    } catch (loadError) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>;
  }

  const leaveChartData = leaveStats
    ? [
        { name: 'Approved', value: leaveStats.approved },
        { name: 'Pending', value: leaveStats.pending },
        { name: 'Rejected', value: leaveStats.rejected },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">CEO Dashboard</h2>
        <p className="text-gray-600 mt-1">Company analytics and insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats && (
          <>
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Employees</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.total_employees}</p>
                  <p className="text-xs text-green-600 mt-1">Active: {stats.active_employees}</p>
                </div>
                <Users className="w-12 h-12 text-blue-600 opacity-20" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Present Today</p>
                  <p className="text-3xl font-bold text-green-600">{stats.present_today}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.total_employees > 0
                      ? ((stats.present_today / stats.total_employees) * 100).toFixed(1)
                      : 0}
                    % attendance
                  </p>
                </div>
                <CheckCircle className="w-12 h-12 text-green-600 opacity-20" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Absent Today</p>
                  <p className="text-3xl font-bold text-red-600">{stats.absent_today}</p>
                  <p className="text-xs text-gray-500 mt-1">On leave: {stats.on_leave_today}</p>
                </div>
                <XCircle className="w-12 h-12 text-red-600 opacity-20" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Salary</p>
                  <p className="text-2xl font-bold text-blue-600">Rs {(stats.average_salary / 100000).toFixed(1)}L</p>
                  <p className="text-xs text-gray-500 mt-1">Total: Rs {(stats.total_payroll / 100000).toFixed(1)}L/mo</p>
                </div>
                <TrendingUp className="w-12 h-12 text-blue-600 opacity-20" />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Attendance Trend (Last 30 Days)</h3>
          {attendanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => format(parseISO(date), 'MMM dd')}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip labelFormatter={(date) => format(parseISO(String(date)), 'MMM dd, yyyy')} formatter={(value) => value} />
                <Legend />
                <Line type="monotone" dataKey="present" stroke="#10b981" name="Present" strokeWidth={2} />
                <Line type="monotone" dataKey="absent" stroke="#ef4444" name="Absent" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-500">No data available</div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Leave Requests</h3>
          {leaveStats && leaveChartData.length > 0 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={250}>
                <PieChartComponent>
                  <Pie
                    data={leaveChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {leaveChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChartComponent>
              </ResponsiveContainer>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-gray-600">Total Requests</p>
                  <p className="font-semibold text-gray-900">{leaveStats.total_requests}</p>
                </div>
                <div className="p-2 bg-green-50 rounded">
                  <p className="text-gray-600">Approved</p>
                  <p className="font-semibold text-green-700">{leaveStats.approved}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No leave data available</div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Payroll Distribution by Department</h3>
          {payrollData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={payrollData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip
                  formatter={(value) => `Rs ${(Number(value) / 100000).toFixed(2)}L`}
                  labelFormatter={(label) => `Department: ${label}`}
                />
                <Bar dataKey="payroll" fill="#3b82f6" name="Monthly Payroll" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-500">No payroll data available</div>
          )}
        </div>
      </div>

      {leaveStats && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Leave Statistics Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{leaveStats.pending}</p>
              <p className="text-sm text-gray-600 mt-1">Pending Leaves</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{leaveStats.approved}</p>
              <p className="text-sm text-gray-600 mt-1">Approved Leaves</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{leaveStats.rejected}</p>
              <p className="text-sm text-gray-600 mt-1">Rejected Leaves</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{leaveStats.total_requests}</p>
              <p className="text-sm text-gray-600 mt-1">Total Requests</p>
            </div>
          </div>

          {Object.keys(leaveStats.by_type).length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Leaves by Type</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(leaveStats.by_type).map(([type, count]) => (
                  <div key={type} className="p-3 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-600">{type}</p>
                    <p className="text-lg font-semibold text-gray-900">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-center">
        <button onClick={loadDashboardData} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium">
          Refresh Data
        </button>
      </div>
    </div>
  );
};

export default CEODashboard;

