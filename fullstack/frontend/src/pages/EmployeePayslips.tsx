/**
 * Component: pages\EmployeePayslips.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useState } from 'react';
import DataTable, { type DataTableColumn } from '@/components/DataTable';
import { Download } from 'lucide-react';

interface PayslipRow {
  id: number;
  pay_period_month: string;
  pay_period_year: number;
  net_pay: number;
  pdf_path: string;
}

const EmployeePayslipsPage: React.FC = () => {
  const [rows, setRows] = useState<PayslipRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPayslips = async () => {
      try {
        setLoading(true);
        const userId = localStorage.getItem('userId');
        if (!userId) return;
        const response = await fetch(`/api/auth/employee/payslips/?employee_id=${userId}`, {
          credentials: 'include',
        });
        const data = await response.json();
        setRows(Array.isArray(data.payslips) ? data.payslips : []);
      } catch (error) {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    void loadPayslips();
  }, []);

  const columns: DataTableColumn<PayslipRow>[] = [
    { key: 'month', header: 'Month', render: (row) => row.pay_period_month },
    { key: 'year', header: 'Year', render: (row) => row.pay_period_year },
    {
      key: 'net',
      header: 'Net Pay',
      render: (row) => `Rs ${Number(row.net_pay || 0).toLocaleString('en-IN')}`,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <button
          onClick={() => window.open(`/media/${row.pdf_path}`, '_blank')}
          className="h-8 px-3 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 inline-flex items-center gap-1"
        >
          <Download className="h-4 w-4" />
          Download
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My Payslips</h1>
        <p className="text-sm text-slate-500">Access all released payslips.</p>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyText="No payslips available yet."
      />
    </div>
  );
};

export default EmployeePayslipsPage;

