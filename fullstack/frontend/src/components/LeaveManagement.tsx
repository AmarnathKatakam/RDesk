import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  CalendarDays,
  CheckCircle,
  Clock,
  Coins,
  History,
  IndianRupee,
  Plus,
  WalletCards,
  XCircle,
} from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { getJson, hrmsApi } from '@/services/hrmsApi';

interface LeaveBreakdownItem {
  date: string;
  status: 'PAID' | 'LOP';
  leave_year?: number;
  leave_year_label?: string;
  leave_code?: string | null;
}

interface LeaveRequest {
  id: number;
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
  rejection_reason?: string | null;
  approved_by?: string | null;
  day_breakdown?: LeaveBreakdownItem[];
}

interface LeaveType {
  id: number;
  name: string;
  code?: string | null;
  max_days_per_year: number;
  is_paid: boolean;
}

interface LeaveBalance {
  leave_type_id: number;
  leave_type: string;
  leave_code?: string | null;
  is_paid: boolean;
  opening_balance: number;
  allocated: number;
  used: number;
  encashed: number;
  remaining: number;
  encashable_days?: number;
  year: number;
  leave_year?: number;
  leave_year_label?: string;
  updated_at: string;
}

interface LeavePolicy {
  name: string;
  earned_leave_per_year: number;
  casual_leave_per_year: number;
  sick_leave_per_year: number;
  el_carry_forward_limit: number;
  el_encashment_limit: number;
  accrual_enabled: boolean;
  accrual_rate_per_month: number;
}

interface EncashmentSummary {
  leave_year: number;
  leave_year_label: string;
  eligible_days: number;
  limit: number;
  already_encashed: number;
  remaining_earned_leave: number;
}

type LeaveTab = 'APPLY' | 'PENDING' | 'HISTORY';

const formatDays = (value: number) => {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0);

const LeaveManagement: React.FC = () => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [balanceYear, setBalanceYear] = useState<number | null>(null);
  const [balanceYearLabel, setBalanceYearLabel] = useState<string>('');
  const [policy, setPolicy] = useState<LeavePolicy | null>(null);
  const [encashmentSummary, setEncashmentSummary] = useState<EncashmentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [encashing, setEncashing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<LeaveTab>('APPLY');
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });
  const [encashForm, setEncashForm] = useState({
    requested_days: '',
    remarks: '',
  });

  useEffect(() => {
    void loadLeaveData();
  }, []);

  const loadLeaveData = async () => {
    try {
      setLoading(true);
      setError('');

      const [requestsRes, typesRes, balanceRes] = await Promise.all([
        hrmsApi.getLeaveRequests(),
        hrmsApi.getLeaveTypes(),
        hrmsApi.getLeaveBalance(),
      ]);

      if (!requestsRes.ok || !typesRes.ok || !balanceRes.ok) {
        setError('Failed to load leave information');
        return;
      }

      const [requestsData, typesData, balanceData] = await Promise.all([
        getJson<{ leave_requests?: LeaveRequest[] }>(requestsRes),
        getJson<{ leave_types?: LeaveType[] }>(typesRes),
        getJson<{
          balances?: LeaveBalance[];
          year?: number;
          leave_year_label?: string;
          policy?: LeavePolicy;
          encashment?: EncashmentSummary;
        }>(balanceRes),
      ]);

      setLeaveRequests(requestsData.leave_requests || []);
      setLeaveTypes(typesData.leave_types || []);
      setBalances(balanceData.balances || []);
      setBalanceYear(balanceData.year || null);
      setBalanceYearLabel(balanceData.leave_year_label || '');
      setPolicy(balanceData.policy || null);
      setEncashmentSummary(balanceData.encashment || null);
    } catch {
      setError('Failed to load leave information');
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
      const data = await getJson<{
        success?: boolean;
        message?: string;
        leave_request?: LeaveRequest;
      }>(response);

      if (response.ok && data.success !== false) {
        const lopDays = data.leave_request?.lop_days || 0;
        setSuccess(
          lopDays > 0
            ? `Leave request submitted. ${formatDays(lopDays)} day(s) are currently projected as LOP until more balance accrues or is available at approval time.`
            : 'Leave request submitted successfully. It is now pending approval.'
        );
        setFormData({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
        setActiveTab('PENDING');
        await loadLeaveData();
        window.setTimeout(() => setSuccess(''), 4500);
      } else {
        setError(data.message || 'Failed to apply leave');
      }
    } catch {
      setError('An error occurred while applying for leave');
    } finally {
      setLoading(false);
    }
  };

  const handleEncash = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setEncashing(true);
      setError('');

      const payload = new FormData();
      payload.append('requested_days', encashForm.requested_days);
      payload.append('remarks', encashForm.remarks);

      const response = await hrmsApi.encashLeave(payload);
      const data = await getJson<{
        success?: boolean;
        message?: string;
        encashment?: { encash_amount?: number; encashed_days?: number };
      }>(response);

      if (response.ok && data.success !== false) {
        const encashedDays = data.encashment?.encashed_days || 0;
        const encashAmount = data.encashment?.encash_amount || 0;
        setSuccess(
          `EL encashed successfully for ${formatDays(encashedDays)} day(s). Amount: ${formatCurrency(encashAmount)}.`
        );
        setEncashForm({ requested_days: '', remarks: '' });
        await loadLeaveData();
        window.setTimeout(() => setSuccess(''), 4500);
      } else {
        setError(data.message || 'Failed to encash earned leave');
      }
    } catch {
      setError('An error occurred while processing encashment');
    } finally {
      setEncashing(false);
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
  const selectedBalance = balances.find((item) => String(item.leave_type_id) === formData.leave_type_id);
  const pendingRequests = leaveRequests.filter((item) => item.status === 'PENDING');
  const historyRequests = leaveRequests.filter((item) => item.status !== 'PENDING');
  const hasInvalidDateRange = Boolean(formData.start_date && formData.end_date && totalDays === 0);
  const projectedPaidDays = selectedBalance ? Math.min(totalDays, selectedBalance.remaining) : 0;
  const projectedLopDays = selectedBalance ? Math.max(totalDays - selectedBalance.remaining, 0) : 0;

  let liveValidation = '';
  if (selectedBalance && totalDays > 0) {
    if (projectedLopDays > 0) {
      liveValidation = `You only have ${formatDays(selectedBalance.remaining)} ${selectedBalance.leave_code || selectedBalance.leave_type} remaining. ${formatDays(projectedLopDays)} day(s) will currently be treated as LOP if approved with today's balance.`;
    } else {
      const remainingAfterApply = selectedBalance.remaining - totalDays;
      liveValidation = `${selectedBalance.leave_code || selectedBalance.leave_type} remaining after this request: ${formatDays(remainingAfterApply)} day(s).`;
    }
  } else if (hasInvalidDateRange) {
    liveValidation = 'End date must be on or after start date.';
  }

  const isSubmitDisabled =
    loading ||
    !formData.leave_type_id ||
    !formData.start_date ||
    !formData.end_date ||
    !formData.reason.trim() ||
    hasInvalidDateRange;

  const tabs: Array<{ key: LeaveTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'APPLY', label: 'Apply', icon: Plus },
    { key: 'PENDING', label: 'Pending', icon: Clock },
    { key: 'HISTORY', label: 'History', icon: History },
  ];

  const renderRequestCard = (request: LeaveRequest) => (
    <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            {getStatusIcon(request.status)}
            <h4 className="font-semibold text-slate-900">{request.leave_type}</h4>
            {request.leave_code && (
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {request.leave_code}
              </span>
            )}
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadge(request.status)}`}>
              {request.status}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            {format(parseISO(request.start_date), 'MMM dd, yyyy')} - {format(parseISO(request.end_date), 'MMM dd, yyyy')} ({formatDays(request.number_of_days)} day{request.number_of_days === 1 ? '' : 's'})
          </p>
          <p className="mt-2 text-sm text-slate-700">{request.reason}</p>
          <p className="mt-2 text-xs text-slate-500">
            Applied on {format(parseISO(request.created_at), 'MMM dd, yyyy HH:mm')}
          </p>

          {request.approved_date && (
            <p className="mt-2 text-xs text-slate-500">
              Updated on {format(parseISO(request.approved_date), 'MMM dd, yyyy HH:mm')}
              {request.approved_by ? ` by ${request.approved_by}` : ''}
            </p>
          )}

          {(request.paid_days > 0 || request.lop_days > 0) && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              Paid leave: {formatDays(request.paid_days)} day(s)
              {request.lop_days > 0 ? ` • LOP: ${formatDays(request.lop_days)} day(s) • Impact: ${formatCurrency(request.lop_amount)}` : ''}
            </div>
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
            Check your policy balance, submit new requests, track approvals, and encash eligible earned leave.
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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              Leave Balance {balanceYearLabel || (balanceYear ? `for ${balanceYear}` : '')}
            </h2>
          </div>
          {policy && (
            <p className="text-sm text-slate-500">
              Policy: {policy.name} • EL accrual {formatDays(policy.accrual_rate_per_month)} / month
            </p>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {balances.map((balance) => (
            <div
              key={balance.leave_type_id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{balance.leave_type}</p>
                {balance.leave_code && (
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                    {balance.leave_code}
                  </span>
                )}
              </div>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {formatDays(balance.remaining)} / {formatDays(balance.allocated)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Used {formatDays(balance.used)}
                {balance.encashed > 0 ? ` • Encashed ${formatDays(balance.encashed)}` : ''}
              </p>
              {balance.leave_code === 'EL' && (
                <p className="mt-2 text-xs text-slate-500">
                  Encashable now: {formatDays(balance.encashable_days || 0)} day(s)
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {activeTab === 'APPLY' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-amber-100 bg-amber-50/80 px-6 py-3 text-xs text-amber-900">
              Requests stay pending until HR or your manager approves them. Paid balance is consumed on approval, and any shortfall is tracked as LOP.
            </div>

            <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Apply for Leave</h3>

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
                            {leaveType.code ? ` (${leaveType.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                      <p className="text-slate-500">Applying For</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {formatDays(totalDays)} day{totalDays === 1 ? '' : 's'}
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
                        min={formData.start_date || undefined}
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

                  {liveValidation && (
                    <div
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        projectedLopDays > 0 || hasInvalidDateRange
                          ? 'border-amber-200 bg-amber-50 text-amber-900'
                          : 'border-blue-200 bg-blue-50 text-blue-700'
                      }`}
                    >
                      {liveValidation}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitDisabled}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                    <p className="text-slate-500">Current Balance</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {selectedBalance
                        ? `${formatDays(selectedBalance.remaining)} / ${formatDays(selectedBalance.allocated)}`
                        : 'Select a leave type'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Applying For</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {formatDays(totalDays)} day{totalDays === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Paid Days Covered</p>
                    <p className="mt-1 font-medium text-slate-900">{formatDays(projectedPaidDays)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Projected LOP</p>
                    <p className={`mt-1 font-medium ${projectedLopDays > 0 ? 'text-amber-900' : 'text-slate-900'}`}>
                      {formatDays(projectedLopDays)} day{projectedLopDays === 1 ? '' : 's'}
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

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Earned Leave Encashment</h3>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Convert eligible EL into payout using your current basic salary snapshot.
                </p>
              </div>
              {encashmentSummary && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Eligible: <span className="font-semibold text-slate-900">{formatDays(encashmentSummary.eligible_days)}</span> day(s)
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <form onSubmit={handleEncash} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Days to Encash *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={encashForm.requested_days}
                      onChange={(event) => setEncashForm((prev) => ({ ...prev, requested_days: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="e.g. 2"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Remarks</label>
                    <input
                      type="text"
                      value={encashForm.remarks}
                      onChange={(event) => setEncashForm((prev) => ({ ...prev, remarks: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="Optional note"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={encashing || !encashForm.requested_days}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <IndianRupee className="h-4 w-4" />
                  {encashing ? 'Processing...' : 'Encash EL'}
                </button>
              </form>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm">
                <p className="font-semibold text-slate-900">Encashment Snapshot</p>
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-slate-500">Leave Cycle</p>
                    <p className="mt-1 font-medium text-slate-900">{encashmentSummary?.leave_year_label || balanceYearLabel || 'Current cycle'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Eligible Days</p>
                    <p className="mt-1 font-medium text-slate-900">{formatDays(encashmentSummary?.eligible_days || 0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Already Encashed</p>
                    <p className="mt-1 font-medium text-slate-900">{formatDays(encashmentSummary?.already_encashed || 0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Policy Limit</p>
                    <p className="mt-1 font-medium text-slate-900">{formatDays(encashmentSummary?.limit || policy?.el_encashment_limit || 0)} day(s)</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
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
