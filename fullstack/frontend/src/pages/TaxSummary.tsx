/**
 * TaxSummary.tsx — Admin Tax Summary Dashboard
 * Route: /admin/payroll/tax-summary
 */
import React, { useEffect, useState } from 'react';
import { AlertTriangle, TrendingDown, Users, IndianRupee } from 'lucide-react';

interface Summary {
  financial_year: string;
  total_employees_with_tds: number;
  total_tds_deducted: number;
  total_taxable_income: number;
  declarations: {
    total: number; draft: number; submitted: number; approved: number; rejected: number;
  };
  alerts: {
    high_income_zero_tds: { employee_id: string; name: string; ytd_taxable: number }[];
    pending_declarations: number;
  };
}

const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const TaxSummaryPage: React.FC = () => {
  const [data, setData] = useState<Summary | null>(null);
  const [fy, setFy] = useState('2025-26');
  const [loading, setLoading] = useState(false);

  useEffect(() => { void load(); }, [fy]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tax/summary/?financial_year=${fy}`, { credentials: 'include' });
      const d = await res.json();
      if (d.success) setData(d);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tax Summary</h1>
          <p className="text-sm text-slate-500">TDS overview and declaration status</p>
        </div>
        <select value={fy} onChange={e => setFy(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          {['2023-24','2024-25','2025-26','2026-27'].map(f => (
            <option key={f} value={f}>FY {f}</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-slate-400 text-sm">Loading…</p>}

      {data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-4">
            <KPI icon={<Users className="h-5 w-5 text-indigo-500" />}
              label="Employees with TDS" value={String(data.total_employees_with_tds)} />
            <KPI icon={<IndianRupee className="h-5 w-5 text-green-500" />}
              label="Total TDS Deducted" value={fmt(data.total_tds_deducted)} />
            <KPI icon={<TrendingDown className="h-5 w-5 text-blue-500" />}
              label="Total Taxable Income" value={fmt(data.total_taxable_income)} />
            <KPI icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
              label="Pending Declarations" value={String(data.alerts.pending_declarations)} highlight />
          </div>

          {/* Declaration status */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Declaration Status</p>
            <div className="grid grid-cols-5 gap-3 text-center">
              {[
                { label: 'Total', val: data.declarations.total, color: 'text-slate-700' },
                { label: 'Draft', val: data.declarations.draft, color: 'text-slate-500' },
                { label: 'Submitted', val: data.declarations.submitted, color: 'text-blue-600' },
                { label: 'Approved', val: data.declarations.approved, color: 'text-green-600' },
                { label: 'Rejected', val: data.declarations.rejected, color: 'text-red-600' },
              ].map(s => (
                <div key={s.label} className="rounded-lg bg-slate-50 p-3">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Anomaly alerts */}
          {data.alerts.high_income_zero_tds.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4" />
                High Income — Zero TDS ({data.alerts.high_income_zero_tds.length} employees)
              </p>
              <div className="space-y-2">
                {data.alerts.high_income_zero_tds.map(e => (
                  <div key={e.employee_id} className="flex items-center justify-between text-sm">
                    <span className="text-amber-900">{e.name} ({e.employee_id})</span>
                    <span className="font-medium text-amber-700">YTD taxable: {fmt(e.ytd_taxable)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const KPI: React.FC<{ icon: React.ReactNode; label: string; value: string; highlight?: boolean }> = ({
  icon, label, value, highlight,
}) => (
  <div className={`rounded-xl border p-4 ${highlight ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
    <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-slate-500">{label}</span></div>
    <p className={`text-xl font-bold ${highlight ? 'text-amber-700' : 'text-slate-900'}`}>{value}</p>
  </div>
);

export default TaxSummaryPage;
