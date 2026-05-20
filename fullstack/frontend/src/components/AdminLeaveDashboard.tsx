import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  CheckCircle2,
  Clock3,
  IndianRupee,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { getJson, hrmsApi } from '@/services/hrmsApi';

interface LeaveRequest {
  id: number;
  employee_name: string;
  employee_id: string;
  leave_type: string;
  leave_type_id: number | null;
  leave_code?: string | null;
  start_date: string;
  end_date: string;
  number_of_days: number;
  paid_days: number;
  lop_days: number;
  lop_amount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  created_at: string;
  updated_at: string;
  approved_date?: string | null;
  approved_by?: string | null;
  rejection_reason?: string | null;
}

interface LeaveSummary {
  total_requests: number;
  pending: number;
  approved: number;
  rejected: number;
  total_requested_days: number;
  total_paid_days: number;
  total_lop_days: number;
  total_lop_amount: number;
}

type LeaveStatusTab = 'PENDING' | 'APPROVED' | 'REJECTED';

const statusConfig: Record<
  LeaveStatusTab,
  {
    label: string;
    emptyText: string;
    badgeClassName: string;
  }
> = {
  PENDING: {
    label: 'Pending',
    emptyText: 'No pending leave requests.',
    badgeClassName: 'bg-amber-100 text-amber-800',
  },
  APPROVED: {
    label: 'Approved',
    emptyText: 'No approved leave requests.',
    badgeClassName: 'bg-green-100 text-green-800',
  },
  REJECTED: {
    label: 'Rejected',
    emptyText: 'No rejected leave requests.',
    badgeClassName: 'bg-rose-100 text-rose-800',
  },
};

const formatDays = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0);

const AdminLeaveDashboard: React.FC = () => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [summary, setSummary] = useState<LeaveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<LeaveStatusTab>('PENDING');

  useEffect(() => {
    void loadLeaves();
  }, []);

  const loadLeaves = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await hrmsApi.getAdminLeaves();
      if (!response.ok) {
        setError('Failed to load leave requests');
        return;
      }

      const data = await getJson<{ leave_requests?: LeaveRequest[]; summary?: LeaveSummary }>(response);
      setLeaveRequests(data.leave_requests || []);
      setSummary(data.summary || null);
    } catch {
      setError('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (updatedLeave: LeaveRequest) => {
    setLeaveRequests((prev) =>
      prev.map((leave) => (leave.id === updatedLeave.id ? { ...leave, ...updatedLeave } : leave))
    );
  };

  const handleApprove = async (leaveId: number) => {
    try {
      setProcessingId(leaveId);
      setError('');

      const response = await hrmsApi.approveLeave(leaveId);
      const data = await getJson<{ success?: boolean; message?: string; leave_request?: LeaveRequest }>(response);

      if (!response.ok || data.success === false || !data.leave_request) {
        setError(data.message || 'Failed to approve leave request');
        return;
      }

      updateRow(data.leave_request);
      setSuccess(
        data.leave_request.lop_days > 0
          ? `Leave approved. ${formatDays(data.leave_request.lop_days)} day(s) will flow to payroll as LOP.`
          : 'Leave approved successfully'
      );
      await loadLeaves();
      window.setTimeout(() => setSuccess(''), 2500);
    } catch {
      setError('Failed to approve leave request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (leaveId: number) => {
    try {
      setProcessingId(leaveId);
      setError('');
      const rejectionReason = rejectionNotes[leaveId]?.trim() || 'Rejected by admin';

      const response = await hrmsApi.rejectLeave(leaveId, rejectionReason);
      const data = await getJson<{ success?: boolean; message?: string; leave_request?: LeaveRequest }>(response);

      if (!response.ok || data.success === false || !data.leave_request) {
        setError(data.message || 'Failed to reject leave request');
        return;
      }

      updateRow(data.leave_request);
      setRejectionNotes((prev) => {
        const next = { ...prev };
        delete next[leaveId];
        return next;
      });
      setSuccess('Leave rejected successfully');
      await loadLeaves();
      window.setTimeout(() => setSuccess(''), 2500);
    } catch {
      setError('Failed to reject leave request');
    } finally {
      setProcessingId(null);
    }
  };

  const tabCounts = {
    PENDING: leaveRequests.filter((leave) => leave.status === 'PENDING').length,
    APPROVED: leaveRequests.filter((leave) => leave.status === 'APPROVED').length,
    REJECTED: leaveRequests.filter((leave) => leave.status === 'REJECTED').length,
  };

  const filteredRows = leaveRequests.filter((leave) => leave.status === activeTab);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-500 shadow-sm">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
        Loading leave requests...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Leave Management</h1>
          <p className="text-sm text-slate-500">
            Review requests, control approvals, and track payroll-facing LOP impact from leave decisions.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Pending</p>
            <p className="mt-2 text-2xl font-semibold text-amber-900">{tabCounts.PENDING}</p>
          </div>
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-green-700">Approved</p>
            <p className="mt-2 text-2xl font-semibold text-green-900">{tabCounts.APPROVED}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-rose-700">Rejected</p>
            <p className="mt-2 text-2xl font-semibold text-rose-900">{tabCounts.REJECTED}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Total LOP</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatDays(summary?.total_lop_days || 0)}</p>
            <p className="mt-1 text-xs text-slate-500">{formatCurrency(summary?.total_lop_amount || 0)}</p>
          </div>
        </div>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      {summary && (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Requested Days</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatDays(summary.total_requested_days)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Paid Leave Days</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatDays(summary.total_paid_days)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">LOP Days</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatDays(summary.total_lop_days)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">LOP Impact</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(summary.total_lop_amount)}</p>
          </div>
        </div>
      )}

      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {(Object.keys(statusConfig) as LeaveStatusTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === tab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {statusConfig[tab].label} ({tabCounts[tab]})
          </button>
        ))}
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-500 shadow-sm">
          {statusConfig[activeTab].emptyText}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRows.map((leave) => (
            <div key={leave.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-semibold text-slate-900">
                      {leave.employee_name} ({leave.employee_id})
                    </h3>
                    {leave.leave_code && (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {leave.leave_code}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusConfig[activeTab].badgeClassName}`}>
                      {leave.status}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-600">{leave.leave_type}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    {format(parseISO(leave.start_date), 'MMM dd, yyyy')} to {format(parseISO(leave.end_date), 'MMM dd, yyyy')} ({formatDays(leave.number_of_days)} day{leave.number_of_days === 1 ? '' : 's'})
                  </p>
                  <p className="mt-3 text-sm text-slate-700">{leave.reason}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Requested on {format(parseISO(leave.created_at), 'MMM dd, yyyy HH:mm')}
                  </p>

                  {leave.approved_date && (
                    <p className="mt-1 text-xs text-slate-500">
                      Reviewed on {format(parseISO(leave.approved_date), 'MMM dd, yyyy HH:mm')}
                      {leave.approved_by ? ` by ${leave.approved_by}` : ''}
                    </p>
                  )}

                  {(leave.paid_days > 0 || leave.lop_days > 0) && (
                    <div className="mt-3 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      <span>Paid: {formatDays(leave.paid_days)} day(s)</span>
                      <span>LOP: {formatDays(leave.lop_days)} day(s)</span>
                      <span className="inline-flex items-center gap-1 font-medium text-slate-900">
                        <IndianRupee className="h-4 w-4" />
                        {formatCurrency(leave.lop_amount)}
                      </span>
                    </div>
                  )}

                  {leave.rejection_reason && (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      Rejection reason: {leave.rejection_reason}
                    </div>
                  )}
                </div>

                {leave.status === 'PENDING' && (
                  <div className="w-full max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <ShieldCheck className="h-4 w-4 text-blue-600" />
                      Review Action
                    </div>
                    {leave.lop_days > 0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        This request is currently projected to create {formatDays(leave.lop_days)} LOP day(s) with an estimated impact of {formatCurrency(leave.lop_amount)}.
                      </div>
                    )}
                    <input
                      type="text"
                      value={rejectionNotes[leave.id] || ''}
                      onChange={(event) =>
                        setRejectionNotes((prev) => ({
                          ...prev,
                          [leave.id]: event.target.value,
                        }))
                      }
                      placeholder="Optional rejection reason"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleApprove(leave.id)}
                        disabled={processingId === leave.id}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => void handleReject(leave.id)}
                        disabled={processingId === leave.id}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {leave.status !== 'PENDING' && (
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {leave.status === 'APPROVED' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Clock3 className="h-4 w-4 text-rose-600" />
                    )}
                    {leave.status === 'APPROVED'
                      ? leave.lop_days > 0
                        ? `Attendance marked as leave. ${formatDays(leave.lop_days)} day(s) moved to payroll as LOP.`
                        : 'Attendance marked as leave with no LOP impact.'
                      : 'No attendance changes applied.'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminLeaveDashboard;
