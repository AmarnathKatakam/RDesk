/**
 * Component: components\LeaveManagement.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays, CheckCircle, Clock, History, Plus, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getJson, hrmsApi } from '@/services/hrmsApi';

interface LeaveRequest {
  id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  number_of_days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  created_at: string;
  approved_date?: string | null;
  rejection_reason?: string | null;
}

interface LeaveType {
  id: number;
  name: string;
  max_days_per_year: number;
}

type LeaveTab = 'APPLY' | 'PENDING' | 'HISTORY';

const LeaveManagement: React.FC = () => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<LeaveTab>('APPLY');
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  useEffect(() => {
    void loadLeaveData();
  }, []);

  const loadLeaveData = async () => {
    try {
      setLoading(true);
      setError('');

      const [requestsRes, typesRes] = await Promise.all([
        hrmsApi.getLeaveRequests(),
        hrmsApi.getLeaveTypes(),
      ]);

      if (requestsRes.ok) {
        const data = await getJson<{ leave_requests?: LeaveRequest[] }>(requestsRes);
        setLeaveRequests(data.leave_requests || []);
      } else {
        setError('Failed to load leave requests');
      }

      if (typesRes.ok) {
        const data = await getJson<{ leave_types?: LeaveType[] }>(typesRes);
        setLeaveTypes(data.leave_types || []);
      } else {
        setError('Failed to load leave types');
      }
    } catch (err) {
      setError('Failed to load leave data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError('');

      const formPayload = new FormData();
      formPayload.append('leave_type_id', formData.leave_type_id);
      formPayload.append('start_date', formData.start_date);
      formPayload.append('end_date', formData.end_date);
      formPayload.append('reason', formData.reason);

      const response = await hrmsApi.applyLeave(formPayload);
      const data = await getJson<{ success?: boolean; message?: string }>(response);

      if (response.ok && data.success !== false) {
        setSuccess('Leave request submitted successfully. Admin has been notified.');
        setFormData({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
        setActiveTab('PENDING');
        await loadLeaveData();
        window.setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message || 'Failed to apply leave');
      }
    } catch (err) {
      setError('An error occurred while applying for leave');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'REJECTED':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'PENDING':
        return <Clock className="h-5 w-5 text-amber-600" />;
      default:
        return <Clock className="h-5 w-5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      PENDING: 'bg-amber-100 text-amber-800',
      CANCELLED: 'bg-slate-100 text-slate-700',
    };

    return statusClasses[status as keyof typeof statusClasses] || 'bg-slate-100 text-slate-700';
  };

  const totalDays =
    formData.start_date && formData.end_date
      ? Math.max(
          Math.floor(
            (new Date(formData.end_date).getTime() - new Date(formData.start_date).getTime()) /
              (1000 * 60 * 60 * 24)
          ) + 1,
          0
        )
      : 0;

  const selectedLeaveType = leaveTypes.find((item) => String(item.id) === formData.leave_type_id);
  const pendingRequests = leaveRequests.filter((item) => item.status === 'PENDING');
  const historyRequests = leaveRequests.filter((item) => item.status !== 'PENDING');

  const tabs: Array<{ key: LeaveTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'APPLY', label: 'Apply', icon: Plus },
    { key: 'PENDING', label: 'Pending', icon: Clock },
    { key: 'HISTORY', label: 'History', icon: History },
  ];

  const renderRequestCard = (request: LeaveRequest) => (
    <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {getStatusIcon(request.status)}
            <h4 className="font-semibold text-slate-900">{request.leave_type}</h4>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadge(request.status)}`}>
              {request.status}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            {format(parseISO(request.start_date), 'MMM dd, yyyy')} - {format(parseISO(request.end_date), 'MMM dd, yyyy')} ({request.number_of_days} days)
          </p>
          <p className="mt-2 text-sm text-slate-700">{request.reason}</p>
          <p className="mt-2 text-xs text-slate-500">
            Applied on {format(parseISO(request.created_at), 'MMM dd, yyyy HH:mm')}
          </p>

          {request.approved_date && (
            <p className="mt-2 text-xs text-slate-500">
              Updated on {format(parseISO(request.approved_date), 'MMM dd, yyyy HH:mm')}
            </p>
          )}

          {request.rejection_reason && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Rejection reason: {request.rejection_reason}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Leave Apply</h1>
          <p className="text-sm text-slate-500">
            Submit leave requests, track pending approvals, and review your leave history.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
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

      {activeTab === 'APPLY' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-amber-100 bg-amber-50/80 px-6 py-3 text-xs text-amber-900">
            Leave is reviewed by admin after submission. You will receive a notification when it is approved or rejected.
          </div>

          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div>
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Applying for Leave</h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Leave Type *</label>
                    <select
                      value={formData.leave_type_id}
                      onChange={(event) => setFormData((prev) => ({ ...prev, leave_type_id: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      required
                    >
                      <option value="">Select leave type</option>
                      {leaveTypes.map((leaveType) => (
                        <option key={leaveType.id} value={leaveType.id}>
                          {leaveType.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <p className="text-slate-500">Applying For</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {totalDays} day{totalDays === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">From Date *</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(event) => setFormData((prev) => ({ ...prev, start_date: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">To Date *</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(event) => setFormData((prev) => ({ ...prev, end_date: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Reason *</label>
                  <textarea
                    value={formData.reason}
                    onChange={(event) => setFormData((prev) => ({ ...prev, reason: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    rows={4}
                    placeholder="Enter reason for leave..."
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Submitting...' : 'Submit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ leave_type_id: '', start_date: '', end_date: '', reason: '' })}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2 text-slate-900">
                <CalendarDays className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold">Leave Summary</h4>
              </div>

              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="text-slate-500">Selected Leave Type</p>
                  <p className="mt-1 font-medium text-slate-900">{selectedLeaveType?.name || 'Not selected'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Leave Type</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {selectedLeaveType?.name || 'Select a leave type'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Applying For</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {totalDays} day{totalDays === 1 ? '' : 's'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Pending Requests</p>
                  <p className="mt-1 font-medium text-slate-900">{pendingRequests.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'PENDING' && (
        <div className="space-y-3">
          {pendingRequests.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-500 shadow-sm">
              No pending leave requests.
            </div>
          ) : (
            pendingRequests.map(renderRequestCard)
          )}
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div className="space-y-3">
          {historyRequests.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-500 shadow-sm">
              No leave history found.
            </div>
          ) : (
            historyRequests.map(renderRequestCard)
          )}
        </div>
      )}
    </div>
  );
};

export default LeaveManagement;
