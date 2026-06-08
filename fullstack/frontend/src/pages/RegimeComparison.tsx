/**
 * RegimeComparison.tsx — Employee Regime Comparison
 * Embedded in TaxDeclaration page or standalone at /employee/tax-regime
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle, TrendingDown } from 'lucide-react';

interface RegimeResult {
  regime: string;
  projected_gross: number;
  standard_deduction: number;
  total_deductions: number;
  taxable_income: number;
  annual_tax: number;
  surcharge: number;
  cess: number;
  total_annual_tax: number;
  monthly_tds: number;
  error?: string;
}

interface CompareData {
  financial_year: string;
  old_regime: RegimeResult;
  new_regime: RegimeResult;
  recommended_regime: 'OLD' | 'NEW' | null;
  tax_saving: number;
  saving_note: string;
}

const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const RegimeComparisonPage: React.FC = () => {
  const [data, setData] = useState<CompareData | null>(null);
  const [fy, setFy] = useState('2025-26');
  const [loading, setLoading] = useState(false);
  const userId = localStorage.getItem('userId') || '';

  useEffect(() => { void load(); }, [fy]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tax/compare-regimes/?employee_id=${userId}&financial_year=${fy}`,
        { credentials: 'include' },
      );
      const d = await res.json();
      if (d.success) setData(d);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Regime Comparison</h1>
          <p className="text-sm text-slate-500">Compare OLD vs NEW tax regime for your income</p>
        </div>
        <select value={fy} onChange={e => setFy(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          {['2024-25','2025-26','2026-27'].map(f => (
            <option key={f} value={f}>FY {f}</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-slate-400 text-sm">Calculating…</p>}

      {data && (
        <>
          {/* Recommendation banner */}
          {data.recommended_regime && (
            <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">
                  {data.recommended_regime} Regime Recommended
                </p>
                <p className="text-xs text-green-600 mt-0.5">{data.saving_note}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-green-500">Annual saving</p>
                <p className="text-lg font-bold text-green-700">{fmt(data.tax_saving)}</p>
              </div>
            </div>
          )}

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-2 gap-4">
           {[
  { key: 'old-regime', value: data.old_regime },
  { key: 'new-regime', value: data.new_regime },
].map(({ key, value: r }) => (
  <div key={key}
                className={`rounded-xl border p-4 space-y-3 ${
                  data.recommended_regime === r.regime
                    ? 'border-green-300 bg-green-50'
                    : 'border-slate-200 bg-white'
                }`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-800">{r.regime} Regime</p>
                  {data.recommended_regime === r.regime && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Recommended
                    </span>
                  )}
                </div>
                <Row label="Projected Gross" value={fmt(r.projected_gross)} />
                <Row label="Standard Deduction" value={`− ${fmt(r.standard_deduction)}`} muted />
                {r.total_deductions > 0 && (
                  <Row label="Other Deductions" value={`− ${fmt(r.total_deductions)}`} muted />
                )}
                <Row label="Taxable Income" value={fmt(r.taxable_income)} bold />
                <div className="border-t border-slate-100 pt-2 space-y-1">
                  <Row label="Income Tax" value={fmt(r.annual_tax)} />
                  {r.surcharge > 0 && <Row label="Surcharge" value={fmt(r.surcharge)} />}
                  <Row label="Cess (4%)" value={fmt(r.cess)} />
                  <Row label="Total Annual Tax" value={fmt(r.total_annual_tax)} bold />
                  <Row label="Monthly TDS" value={fmt(r.monthly_tds)} bold highlight />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400 text-center">
            * Based on projected annual income from YTD actuals. Actual tax may vary.
          </p>
        </>
      )}
    </div>
  );
};

const Row: React.FC<{
  label: string; value: string; bold?: boolean; muted?: boolean; highlight?: boolean;
}> = ({ label, value, bold, muted, highlight }) => (
  <div className="flex items-center justify-between text-sm">
    <span className={muted ? 'text-slate-400' : 'text-slate-600'}>{label}</span>
    <span className={`${bold ? 'font-semibold' : ''} ${highlight ? 'text-indigo-700' : muted ? 'text-slate-400' : 'text-slate-900'}`}>
      {value}
    </span>
  </div>
);

export default RegimeComparisonPage;
