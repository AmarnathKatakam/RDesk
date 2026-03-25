/**
 * Component: components\AdminLeaveApproval.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { hrmsApi, getJson } from '@/services/hrmsApi';

interface PendingLeave {
  id: number;
  employee_name: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  number_of_days: number;
  reason: string;
  created_at: string;
}

const AdminLeaveApproval: React.FC = () => {
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    void loadPendingLeaves();
  }, []);

  const loadPendingLeaves = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await hrmsApi.getPendingLeaves();

      if (!response.ok) {
        setError('Failed to load pending leave requests');
        return;
      }

      const data = await getJson<{ pending_leaves?: PendingLeave[] }>(response);
      setPendingLeaves(data.pending_leaves || []);
    } catch (loadError) {
      setError('Failed to load pending leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (leaveId: number) => {
    try {
      setProcessingId(leaveId);
      setError('');
      const response = await hrmsApi.approveLeave(leaveId);
      const data = await getJson<{ success?: boolean; message?: string }>(response);

      if (!response.ok || data.success === false) {
        setError(data.message || 'Failed to approve leave request');
        return;
      }

      setSuccess('Leave approved successfully');
      setPendingLeaves((prev) => prev.filter((leave) => leave.id !== leaveId));
      setTimeout(() => setSuccess(''), 2500);
    } catch (approveError) {
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
      const data = await getJson<{ success?: boolean; message?: string }>(response);

      if (!response.ok || data.success === false) {
        setError(data.message || 'Failed to reject leave request');
        return;
      }

      setSuccess('Leave rejected successfully');
      setPendingLeaves((prev) => prev.filter((leave) => leave.id !== leaveId));
      setRejectionNotes((prev) => {
        const next = { ...prev };
        delete next[leaveId];
        return next;
      });
      setTimeout(() => setSuccess(''), 2500);
    } catch (rejectError) {
      setError('Failed to reject leave request');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
        Loading pending requests...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Leave Approvals</h2>
        <p className="text-gray-600 mt-1">Review and process pending employee leave requests.</p>
      </div>

      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      {pendingLeaves.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No pending leave requests.
        </div>
      ) : (
        <div className="space-y-4">
          {pendingLeaves.map((leave) => (
            <div key={leave.id} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {leave.employee_name} ({leave.employee_id})
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{leave.leave_type}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {format(parseISO(leave.start_date), 'MMM dd, yyyy')} to {format(parseISO(leave.end_date), 'MMM dd, yyyy')} ({leave.number_of_days}{' '}
                    days)
                  </p>
                  <p className="text-sm text-gray-700 mt-2">{leave.reason}</p>
                  <p className="text-xs text-gray-500 mt-2">Applied on {format(parseISO(leave.created_at), 'MMM dd, yyyy HH:mm')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(leave.id)}
                    disabled={processingId === leave.id}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(leave.id)}
                    disabled={processingId === leave.id}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminLeaveApproval;

