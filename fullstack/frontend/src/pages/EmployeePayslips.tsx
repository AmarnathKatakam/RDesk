/**
 * Component: pages\EmployeePayslips.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useState } from 'react';
import DataTable, { type DataTableColumn } from '@/components/DataTable';
import { Download, Eye } from 'lucide-react';

interface PayslipRow {
  id: number;
  pay_period_month: string;
  pay_period_year: number;
  net_pay: number;
  preview_url?: string;
  download_url: string;
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

  const handleDownload = async (payslipId: number) => {
    try {
      const response = await fetch(`/api/payslips/${payslipId}/download/`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        const data = await response.json();
        alert(data.message || 'Failed to download payslip');
        return;
      }
      
      // Create blob from response and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${payslipId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Error downloading payslip');
    }
  };

  const handleView = (row: PayslipRow) => {
    const previewUrl = row.preview_url || `/api/payslips/${row.id}/preview/`;
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleView(row)}
            className="h-8 px-3 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
          >
            <Eye className="h-4 w-4" />
            View
          </button>
          <button
            onClick={() => handleDownload(row.id)}
            className="h-8 px-3 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 inline-flex items-center gap-1"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
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
