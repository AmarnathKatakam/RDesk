/**
 * Component: pages\Leaves.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useState } from 'react';
import DataTable, { type DataTableColumn } from '@/components/DataTable';
import { getJson, hrmsApi } from '@/services/hrmsApi';

interface LeaveRequest {
  id: number;
  employee_name: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
}

const LeavesPage: React.FC = () => {
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadLeaves();
  }, []);

  const loadLeaves = async () => {
    try {
      setLoading(true);
      const response = await hrmsApi.getPendingLeaves();
      if (!response.ok) {
        setRows([]);
        return;
      }
      const data = await getJson<{ pending_leaves?: LeaveRequest[] }>(response);
      setRows(data.pending_leaves || []);
    } catch (error) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const approve = async (id: number) => {
    await hrmsApi.approveLeave(id);
    await loadLeaves();
  };

  const reject = async (id: number) => {
    const reason = window.prompt('Rejection reason:', 'Not approved at this time');
    if (reason === null) return;
    await hrmsApi.rejectLeave(id, reason);
    await loadLeaves();
  };

  const columns: DataTableColumn<LeaveRequest>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => `${row.employee_name} (${row.employee_id})`,
    },
    { key: 'type', header: 'Leave Type', render: (row) => row.leave_type },
    {
      key: 'start',
      header: 'Start Date',
      render: (row) => new Date(row.start_date).toLocaleDateString(),
    },
    {
      key: 'end',
      header: 'End Date',
      render: (row) => new Date(row.end_date).toLocaleDateString(),
    },
    { key: 'reason', header: 'Reason', render: (row) => row.reason },
    {
      key: 'status',
      header: 'Status',
      render: () => (
        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
          Pending
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => void approve(row.id)}
            className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium"
          >
            Approve
          </button>
          <button
            onClick={() => void reject(row.id)}
            className="h-8 px-3 rounded-lg bg-rose-600 text-white text-xs font-medium"
          >
            Reject
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Leave Management</h1>
        <p className="text-sm text-slate-500">Review pending leave requests and take action.</p>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyText="No pending leave requests."
      />
    </div>
  );
};

export default LeavesPage;

