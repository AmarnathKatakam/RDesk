import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { payrollRunAPI, payrollReportsAPI } from '../services/api';
import PayrollNav from '../components/PayrollNav';
import { ValidationHealthBadge } from '../components/PayrollIssuesPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegisterRow {
  employee_id: string;
  employee_name: string;
  department: string;
  lop_days: number;
  payable_days: number;
  days_in_month: number;
  gross_earnings: number;
  total_deductions: number;
  employer_contributions: number;
  net_pay: number;
  pf_employee: number;
  esi_employee: number;
  professional_tax: number;
  pf_employer: number;
  calculation_source: string;
  earnings_breakdown: Record<string, number>;
  deductions_breakdown: Record<string, number>;
}

interface VarianceRow {
  employee_id: string;
  employee_name: string;
  current_net: number;
  previous_net: number | null;
  change_pct: number | null;
  flagged: boolean;
  is_new: boolean;
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

const fmt = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ─── Anomaly detection ────────────────────────────────────────────────────────

function detectAnomalies(rows: RegisterRow[], varianceMap: Record<string, VarianceRow>): Record<string, string[]> {
  const flags: Record<string, string[]> = {};
  for (const row of rows) {
    const f: string[] = [];
    if (row.net_pay <= 0) f.push('Negative or zero net pay');
    if (row.lop_days > 10) f.push(`High LOP: ${row.lop_days} days`);
    if (row.gross_earnings > 0 && row.total_deductions / row.gross_earnings > 0.5) f.push('Deductions >50% of gross');
    const v = varianceMap[row.employee_id];
    if (v?.flagged) f.push(`Net pay changed ${v.change_pct?.toFixed(1)}% vs last month`);
    if (v?.is_new) f.push('New employee this month');
    if (f.length) flags[row.employee_id] = f;
  }
  return flags;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PayrollPreview() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [year, setYear] = useState(currentYear);
  const [salaryType, setSalaryType] = useState('SALARY');

  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [varianceMap, setVarianceMap] = useState<Record<string, VarianceRow>>({});
  const [summary, setSummary] = useState<any>(null);
  const [earningCodes, setEarningCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);

  // Validation state
  const [validationErrors, setValidationErrors] = useState(0);
  const [validationWarnings, setValidationWarnings] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [regResp, varResp, issuesResp] = await Promise.all([
        payrollReportsAPI.getRegister({ month, year, salary_type: salaryType }),
        payrollReportsAPI.getVariance({ month, year, salary_type: salaryType, threshold: 15 }),
        payrollRunAPI.getValidationIssues({ month, year, resolved: false }),
      ]);

      const regRows: RegisterRow[] = regResp.data.rows || [];
      setRows(regRows);
      setSummary(regResp.data.summary);
      setEarningCodes(regResp.data.columns?.earning_codes || []);

      const vMap: Record<string, VarianceRow> = {};
      for (const v of (varResp.data.rows || [])) vMap[v.employee_id] = v;
      setVarianceMap(vMap);

      const issues = issuesResp.data.issues || [];
      setValidationErrors(issues.filter((i: any) => i.severity === 'ERROR').length);
      setValidationWarnings(issues.filter((i: any) => i.severity === 'WARNING').length);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load preview.');
    } finally {
      setLoading(false);
    }
  }, [month, year, salaryType]);

  const anomalies = detectAnomalies(rows, varianceMap);

  const filtered = rows.filter(r => {
    const matchSearch = !search ||
      r.employee_name.toLowerCase().includes(search.toLowerCase()) ||
      r.employee_id.toLowerCase().includes(search.toLowerCase());
    const matchFlag = !showOnlyFlagged || !!anomalies[r.employee_id];
    return matchSearch && matchFlag;
  });

  const flaggedCount = Object.keys(anomalies).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Payroll Preview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review all employee breakdowns before approving</p>
        </div>
        {rows.length > 0 && (
          <ValidationHealthBadge errors={validationErrors} warnings={validationWarnings} />
        )}
      </div>

      <PayrollNav />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400">
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400">
          {YEARS.map(y => <option key={y}>{y}</option>)}
        </select>
        <select value={salaryType} onChange={e => setSalaryType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400">
          <option value="SALARY">Salary</option>
          <option value="STIPEND">Stipend</option>
        </select>
        <button onClick={load} disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Loading…' : 'Load Preview'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Employees', value: rows.length.toString() },
            { label: 'Total Gross', value: fmt(summary.total_gross) },
            { label: 'Total Deductions', value: fmt(summary.total_deductions) },
            { label: 'Total Net Pay', value: fmt(summary.total_net), highlight: true },
            { label: 'Flagged', value: flaggedCount.toString(), warn: flaggedCount > 0 },
          ].map(c => (
            <div key={c.label} className={`rounded-xl p-3 border ${
              c.highlight ? 'bg-indigo-50 border-indigo-100'
              : c.warn && flaggedCount > 0 ? 'bg-amber-50 border-amber-200'
              : 'bg-white border-gray-200'
            }`}>
              <div className="text-xs text-gray-500 mb-0.5">{c.label}</div>
              <div className={`text-lg font-bold ${
                c.highlight ? 'text-indigo-700'
                : c.warn && flaggedCount > 0 ? 'text-amber-700'
                : 'text-gray-900'
              }`}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Validation issues banner */}
      {(validationErrors > 0 || validationWarnings > 0) && (
        <div className={`mb-4 p-3 rounded-xl border flex items-center justify-between ${
          validationErrors > 0 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${validationErrors > 0 ? 'text-red-800' : 'text-yellow-800'}`}>
              {validationErrors > 0
                ? `⛔ ${validationErrors} error${validationErrors > 1 ? 's' : ''} must be resolved before approving`
                : `⚠ ${validationWarnings} warning${validationWarnings > 1 ? 's' : ''} — review before proceeding`}
            </span>
          </div>
          <button onClick={() => navigate('/admin/payroll')}
            className="text-xs font-medium text-indigo-600 hover:underline">
            View Issues →
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Search + filter bar */}
          <div className="flex gap-3 mb-3 items-center">
            <input type="text" placeholder="Search employee…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={showOnlyFlagged}
                onChange={e => setShowOnlyFlagged(e.target.checked)}
                className="rounded" />
              Show flagged only
              {flaggedCount > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">{flaggedCount}</span>
              )}
            </label>
          </div>

          {/* Employee breakdown table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium">Employee</th>
                    <th className="text-left px-4 py-3 text-xs font-medium">Dept</th>
                    <th className="text-right px-4 py-3 text-xs font-medium">Days</th>
                    {earningCodes.slice(0, 4).map(c => (
                      <th key={c} className="text-right px-3 py-3 text-xs font-medium">{c}</th>
                    ))}
                    <th className="text-right px-4 py-3 text-xs font-medium">Gross</th>
                    <th className="text-right px-4 py-3 text-xs font-medium">Deductions</th>
                    <th className="text-right px-4 py-3 text-xs font-medium font-bold">Net Pay</th>
                    <th className="text-right px-4 py-3 text-xs font-medium">vs Last Month</th>
                    <th className="px-4 py-3 text-xs font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10 + earningCodes.slice(0, 4).length}
                        className="text-center py-10 text-gray-400 text-sm">
                        {rows.length === 0 ? 'No data. Click Load Preview.' : 'No employees match the filter.'}
                      </td>
                    </tr>
                  ) : filtered.map((row, i) => {
                    const flags = anomalies[row.employee_id] || [];
                    const variance = varianceMap[row.employee_id];
                    const isFlagged = flags.length > 0;
                    const changePct = variance?.change_pct;

                    return (
                      <tr key={row.employee_id}
                        className={`${isFlagged ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-indigo-50 transition-colors`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 text-sm">{row.employee_name}</div>
                          <div className="text-xs text-gray-400">{row.employee_id}</div>
                          {flags.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {flags.map((f, fi) => (
                                <div key={fi} className="text-xs text-amber-700 flex items-center gap-1">
                                  <span>⚠</span> {f}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{row.department}</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-600">
                          {row.payable_days}/{row.days_in_month}
                          {row.lop_days > 0 && (
                            <span className="text-red-500 ml-1">-{row.lop_days}</span>
                          )}
                        </td>
                        {earningCodes.slice(0, 4).map(c => (
                          <td key={c} className="px-3 py-3 text-right text-xs text-gray-600">
                            {fmt(row.earnings_breakdown[c] ?? 0)}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right text-sm text-gray-700">{fmt(row.gross_earnings)}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">{fmt(row.total_deductions)}</td>
                        <td className={`px-4 py-3 text-right text-sm font-bold ${row.net_pay <= 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {fmt(row.net_pay)}
                        </td>
                        <td className="px-4 py-3 text-right text-xs">
                          {variance?.is_new ? (
                            <span className="text-blue-600 font-medium">New</span>
                          ) : changePct != null ? (
                            <span className={`font-medium ${Math.abs(changePct) > 15 ? 'text-amber-600' : changePct > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {changePct > 0 ? '+' : ''}{changePct.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isFlagged ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              ⚠ Review
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              ✓ OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer action */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Showing {filtered.length} of {rows.length} employees
              {flaggedCount > 0 && ` · ${flaggedCount} flagged`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => navigate('/admin/payroll/monthly-inputs')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Edit Inputs
              </button>
              <button
                onClick={() => navigate('/admin/payroll/runs')}
                disabled={validationErrors > 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                title={validationErrors > 0 ? 'Resolve errors before approving' : ''}
              >
                Go to Approve →
              </button>
            </div>
          </div>
        </>
      )}

      {!loading && rows.length === 0 && !error && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-3xl mb-3">🔍</div>
          <p className="text-sm">Select a period and click Load Preview to see the full breakdown.</p>
        </div>
      )}
    </div>
  );
}
