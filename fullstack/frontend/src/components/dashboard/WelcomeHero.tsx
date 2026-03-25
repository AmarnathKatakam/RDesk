/**
 * Component: components\dashboard\WelcomeHero.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useState, useEffect } from 'react';
import { Users, DollarSign, CalendarCheck, Clock, Loader2, AlertCircle } from 'lucide-react';
import { dashboardAPI } from '@/services/api';

interface QuickStats {
  totalEmployees: number;
  payrollThisMonth: number;
  pendingLeaves: number;
  attendanceToday: number;
}

const WelcomeHero: React.FC = () => {
  const [stats, setStats] = useState<QuickStats>({
    totalEmployees: 0,
    payrollThisMonth: 0,
    pendingLeaves: 0,
    attendanceToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentDate = new Date();
  const greeting = currentDate.getHours() < 12 ? 'Good Morning' : currentDate.getHours() < 18 ? 'Good Afternoon' : 'Good Evening';

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all dashboard data in parallel. Do not suppress errors with zero fallbacks.
        const [
          employeeResponse,
          payrollResponse,
          leaveResponse,
          attendanceResponse
        ] = await Promise.all([
          dashboardAPI.getEmployeeCount(),
          dashboardAPI.getPayrollMonthSummary(),
          dashboardAPI.getLeavePendingCount(),
          dashboardAPI.getAttendanceTodaySummary(),
        ]);

        const totalEmployees = employeeResponse.data?.count ?? 0;
        const payrollThisMonth = payrollResponse.data?.total ?? 0;
        const pendingLeaves = leaveResponse.data?.count ?? 0;
        const attendanceData = attendanceResponse.data;
        
        // Calculate attendance percentage
        const attendanceToday = attendanceData?.total 
          ? Math.round((attendanceData.present / attendanceData.total) * 100) 
          : 0;

        setStats({
          totalEmployees,
          payrollThisMonth,
          pendingLeaves,
          attendanceToday,
        });
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
        setError('Failed to load dashboard data. Please refresh or check API connectivity.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  // Format currency in Indian Rupees
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

  if (error) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-roth-secondary via-gray-800 to-black p-8 text-white mb-6">
        <div className="relative z-10 flex items-center justify-center h-32">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-roth-secondary via-gray-800 to-black p-8 text-white mb-6">
      {/* Abstract Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />
          <circle cx="80" cy="20" r="30" fill="currentColor" />
          <circle cx="90" cy="80" r="40" fill="currentColor" />
          <circle cx="10" cy="90" r="20" fill="currentColor" />
        </svg>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-roth-accent opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-roth-accent opacity-10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>

      <div className="relative z-10">
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: '"Droid Serif", serif' }}>
          {greeting}, Admin!
        </h1>
        <p className="text-gray-300 mb-8 max-w-xl">
          Welcome to RDesk - Your complete HR & Payroll management solution. 
          Here's what's happening with your organization today.
        </p>

        {/* Quick Stats - Loaded from API */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-roth-accent" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-roth-accent/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-roth-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalEmployees}</p>
                  <p className="text-xs text-gray-400">Total Employees</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.payrollThisMonth)}</p>
                  <p className="text-xs text-gray-400">Payroll This Month</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <CalendarCheck className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pendingLeaves}</p>
                  <p className="text-xs text-gray-400">Pending Leaves</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.attendanceToday}%</p>
                  <p className="text-xs text-gray-400">Attendance Today</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WelcomeHero;


