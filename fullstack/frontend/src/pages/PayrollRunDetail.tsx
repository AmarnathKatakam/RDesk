import { Fragment, useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { payrollRunAPI, payrollReportsAPI } from '../services/api';
import PayrollNav from '../components/PayrollNav';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunSummary {
  id: number; month: string; year: number; salary_type: string; status: string;
  total_employees: number; total_gross: number; total_deductions: number; total_net: number;
  item_status_counts: Record<string, number>;
  department_breakdown: { department: string; count: number; total_net: number }[];
  created_by: string | null; approved_by: string | null; released_by: string | null;
  created_at: string | null; approved_at: string | null; locked_at: string | null; released_at: string | null;
  notes: string; reopen_reason: string; valid_transitions: string[];
}

interface RunItem {
  id: number; employee_pk: number; employee_id: string; employee_name: string;
  department: string | null; status: string;
  gross_earnings: number; total_deductions: number; employer_contributions: number; net_pay: number;
  lop_days: number; work_days: number; payable_days: number; days_in_month: number;
  proration_factor: number; calculation_source: string;
  hold_reason: string; error_message: string; payslip_id: number | null; calculated_at: string | null;
}

interface ValidationIssue {
  id: number; employee_name: string; employee_id: string; issue_type: string;
  severity: 'ERROR' | 'WARNING'; message: string; resolved: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  { key: 'DRAFT', label: 'Draft', icon: '📋' },
  { key: 'CALCULATED', label: 'Calculated', icon: '🔢' },
  { key: 'REVIEWED', label: 'Reviewed', icon: '👁' },
  { key: 'APPROVED', label: 'Approved', icon: '✅' },
  { key: 'LOCKED', label: 'Locked', icon: '🔒' },
  { key: 'RELEASED', label: 'Released', icon: '📤' },
  { key: 'PAID', label: 'Paid', icon: '💳' },
];

const STATUS_ORDER: Record<string, number> = {
  DRAFT: 0, CALCULATED: 1, REVIEWED: 2, APPROVED: 3, LOCKED: 4, RELEASED: 5, PAID: 6, REOPENED: -1,
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700', CALCULATED: 'bg-blue-100 text-blue-700',
  REVIEWED: 'bg-yellow-100 text-yellow-700', APPROVED: 'bg-indigo-100 text-indigo-700',
  LOCKED: 'bg-orange-100 text-orange-700', RELEASED: 'bg-green-100 text-green-700',
  PAID: 'bg-emerald-100 text-emerald-700', REOPENED: 'bg-red-100 text-red-700',
};

const ITEM_STATUS_COLORS: Record<string, string> = {
  INCLUDED: 'bg-green-100 text-green-700', ON_HOLD: 'bg-yellow-100 text-yellow-700',
  REPROCESSING: 'bg-blue-100 text-blue-700', ERROR: 'bg-red-100 text-red-700',
};

const TRANSITION_LABELS: Record<string, string> = {
  CALCULATED: 'Calculate', REVIEWED: 'Mark Reviewed', APPROVED: 'Approve',
  LOCKED: 'Lock', RELEASED: 'Release Payslips', PAID: 'Mark Paid', REOPENED: 'Reopen', DRAFT: 'Reset to Draft',
};

const TRANSITION_COLORS: Record<string, string> = {
  CALCULATED: 'bg-blue-600 hover:bg-blue-700', REVIEWED: 'bg-yellow-500 hover:bg-yellow-600',
  APPROVED: 'bg-indigo-600 hover:bg-indigo-700', LOCKED: 'bg-orange-500 hover:bg-orange-600',
  RELEASED: 'bg-green-600 hover:bg-green-700', PAID: 'bg-emerald-600 hover:bg-emerald-700',
  REOPENED: 'bg-red-500 hover:bg-red-600', DRAFT: 'bg-gray-500 hover:bg-gray-600',
};

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PayrollRunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [items, setItems] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  // B2 — variance vs last month
  const [variancePct, setVariancePct] = useState<number | null>(null);
  // B3 — payroll health / validation issues
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [healthOpen, setHealthOpen] = useState(true);
  // B4 — expanded row for attendance snapshot
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  // C3 — release progress polling
  const [releaseProgress, setReleaseProgress] = useState<{ total: number; released: number; done: boolean } | null>(null);
  const progressInnerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!progressInnerRef.current || !releaseProgress) return;
    const pct = releaseProgress.total > 0 ? Math.round((releaseProgress.released / releaseProgress.total) * 100) : 0;
    // update DOM width to avoid inline JSX styles (move styling out of JSX)
    progressInnerRef.current.style.width = `${pct}%`;
  }, [releaseProgress]);

  // Modals
  const [transitionTarget, setTransitionTarget] = useState('');
  const [transitionReason, setTransitionReason] = useState('');
  const [holdTarget, setHoldTarget] = useState<RunItem | null>(null);
  const [holdReason, setHoldReason] = useState('');

  const fetchAll = async () => {
    if (!runId) return;
    try {
      setLoading(true);
      const [sumRes, itemsRes] = await Promise.all([
        payrollRunAPI.getSummary(runId),
        payrollRunAPI.getItems(runId),
      ]);
      setSummary(sumRes.data.summary);
      setItems(itemsRes.data.items || []);
    } catch {
      setError('Failed to load run details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [runId]);

  // B2 — fetch variance once summary is loaded
  useEffect(() => {
    if (!summary) return;
    payrollReportsAPI.getVariance({ month: summary.month, year: summary.year, salary_type: summary.salary_type })
      .then(r => {
        const rows: any[] = r.data.rows || [];
        const totalPrev = rows.reduce((s, row) => s + (row.prev_net ?? 0), 0);
        const totalCurr = rows.reduce((s, row) => s + (row.current_net ?? 0), 0);
        if (totalPrev > 0) setVariancePct(((totalCurr - totalPrev) / totalPrev) * 100);
      })
      .catch(() => {});
  }, [summary?.id]);

  // B3 — fetch validation issues when DRAFT or CALCULATED
  useEffect(() => {
    if (!summary || !['DRAFT', 'CALCULATED'].includes(summary.status)) return;
    payrollRunAPI.getValidationIssues({ month: summary.month, year: summary.year })
      .then(r => setValidationIssues(r.data.issues || []))
      .catch(() => {});
  }, [summary?.id, summary?.status]);

  // C3 — poll release progress when RELEASED and not yet done
  useEffect(() => {
    if (!summary || summary.status !== 'RELEASED') { setReleaseProgress(null); return; }
    let intervalId: ReturnType<typeof setInterval>;
    const poll = () => {
      payrollRunAPI.releaseProgress(runId!)
        .then(r => {
          const d = r.data;
          setReleaseProgress({ total: d.total, released: d.released, done: d.done });
          if (d.done) clearInterval(intervalId);
        })
        .catch(() => {});
    };
    poll();
    intervalId = setInterval(poll, 2000);
    return () => clearInterval(intervalId);
  }, [summary?.id, summary?.status]);

  const act = async (fn: () => Promise<any>, msg: string) => {
    setActionLoading(true); setError('');
    try { await fn(); setSuccess(msg); fetchAll(); }
    catch (e: any) { setError(e?.response?.data?.message || 'Action failed.'); }
    finally { setActionLoading(false); }
  };

  const handleCalculate = () => act(() => payrollRunAPI.calculate(runId!), 'Calculation complete.');
  const handleTransition = () => act(async () => {
    await payrollRunAPI.transition(runId!, transitionTarget, transitionReason);
    setTransitionTarget(''); setTransitionReason('');
  }, `Status updated to ${transitionTarget}.`);
  const handleHold = () => act(async () => {
    await payrollRunAPI.holdEmployee(runId!, holdTarget!.employee_pk, holdReason);
    setHoldTarget(null); setHoldReason('');
  }, `${holdTarget?.employee_name} put on hold.`);
  const handleReleaseHold = (item: RunItem) =>
    act(() => payrollRunAPI.releaseHold(runId!, item.employee_pk), `Hold released for ${item.employee_name}.`);
  const handleReprocess = (item: RunItem) =>
    act(() => payrollRunAPI.reprocess(runId!, item.employee_pk), `${item.employee_name} reprocessed.`);
  // B1 — per-employee release
  const handleReleaseEmployee = (item: RunItem) =>
    act(() => payrollRunAPI.releaseEmployee(runId!, item.employee_pk), `Payslip released for ${item.employee_name}.`);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  if (!summary) return <div className="p-8 text-center text-red-500">Run not found.</div>;

  const currentStepIndex = STATUS_ORDER[summary.status] ?? 0;
  const isReopened = summary.status === 'REOPENED';
  const canEdit = ['DRAFT', 'CALCULATED', 'REVIEWED', 'REOPENED'].includes(summary.status);
  const canReleaseIndividual = ['LOCKED', 'RELEASED'].includes(summary.status);

  const filteredItems = items.filter(i =>
    !search ||
    i.employee_name.toLowerCase().includes(search.toLowerCase()) ||
    i.employee_id.toLowerCase().includes(search.toLowerCase())
  );

  const errorItems = items.filter(i => i.status === 'ERROR');
  const holdItems = items.filter(i => i.status === 'ON_HOLD');
  const validationErrors = validationIssues.filter(i => i.severity === 'ERROR');
  const validationWarnings = validationIssues.filter(i => i.severity === 'WARNING');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <button onClick={() => navigate('/admin/payroll')} className="text-xs text-indigo-600 hover:underline mb-2 block">← Payroll Dashboard</button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {summary.month} {summary.year}
              <span className="ml-2 text-sm font-normal text-gray-400">{summary.salary_type}</span>
            </h1>
            <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[summary.status]}`}>{summary.status}</span>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {summary.status === 'DRAFT' && (
              <button onClick={handleCalculate} disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                🔢 Calculate
              </button>
            )}
            {summary.valid_transitions.filter(t => t !== 'CALCULATED').map(t => (
              <button key={t} onClick={() => setTransitionTarget(t)} disabled={actionLoading}
                className={`px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${TRANSITION_COLORS[t] || 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {TRANSITION_LABELS[t] || t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <PayrollNav />

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between">
          {error} <button onClick={() => setError('')} className="underline text-xs">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex justify-between">
          {success} <button onClick={() => setSuccess('')} className="underline text-xs">Dismiss</button>
        </div>
      )}

      {/* C3 — Release progress bar */}
      {releaseProgress && !releaseProgress.done && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-indigo-800">
              📤 Generating payslips… {releaseProgress.released} / {releaseProgress.total}
            </span>
            <span className="text-xs text-indigo-500">
              {releaseProgress.total > 0 ? Math.round(releaseProgress.released / releaseProgress.total * 100) : 0}%
            </span>
          </div>
          <div className="w-full bg-indigo-100 rounded-full h-2">
            <div
              ref={progressInnerRef}
              className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
            />
          </div>
        </div>
      )}
      {releaseProgress?.done && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          ✅ All {releaseProgress.total} payslips generated and released.
        </div>
      )}

      {/* Workflow step bar */}
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-4">
        <div className="flex items-center gap-0 overflow-x-auto">
          {WORKFLOW_STEPS.map((step, idx) => {
            const stepOrder = STATUS_ORDER[step.key] ?? idx;
            const isDone = currentStepIndex > stepOrder;
            const isCurrent = currentStepIndex === stepOrder && !isReopened;
            return (
              <div key={step.key} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className={['w-9 h-9 rounded-full flex items-center justify-center text-base border-2',
                    isDone ? 'bg-indigo-600 border-indigo-600 text-white'
                      : isCurrent ? 'bg-white border-indigo-500 text-indigo-600 shadow ring-2 ring-indigo-100'
                      : 'bg-gray-50 border-gray-200 text-gray-400'].join(' ')}>
                    {isDone ? '✓' : step.icon}
                  </div>
                  <div className={`text-xs font-medium mt-1 ${isCurrent ? 'text-indigo-600' : isDone ? 'text-gray-700' : 'text-gray-400'}`}>{step.label}</div>
                </div>
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div className={`h-0.5 w-6 mx-1 flex-shrink-0 ${isDone ? 'bg-indigo-400' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
          {isReopened && <div className="ml-4 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs font-medium text-red-700">↩ Reopened</div>}
        </div>
      </div>

      {/* B2 — Summary cards with variance badge */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Employees', value: summary.total_employees.toString() },
          { label: 'Gross Earnings', value: fmt(summary.total_gross) },
          { label: 'Deductions', value: fmt(summary.total_deductions) },
          { label: 'Net Pay', value: fmt(summary.total_net), highlight: true },
        ].map(c => (
          <div key={c.label} className={`rounded-xl p-4 border ${c.highlight ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-gray-200'}`}>
            <div className="text-xs text-gray-500 mb-1">{c.label}</div>
            <div className={`text-xl font-semibold ${c.highlight ? 'text-indigo-700' : 'text-gray-900'}`}>{c.value}</div>
            {c.highlight && variancePct !== null && (
              <div className={`mt-1 text-xs font-medium ${variancePct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {variancePct >= 0 ? '▲' : '▼'} {Math.abs(variancePct).toFixed(1)}% vs last month
              </div>
            )}
          </div>
        ))}
      </div>

      {/* B3 — Payroll health panel */}
      {validationIssues.length > 0 && (
        <div className={`border rounded-xl overflow-hidden ${validationErrors.length > 0 ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}`}>
          <button onClick={() => setHealthOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left">
            <span className={validationErrors.length > 0 ? 'text-red-800' : 'text-yellow-800'}>
              {validationErrors.length > 0 ? '🚫' : '⚠'} Payroll Health —{' '}
              {validationErrors.length > 0 && `${validationErrors.length} error${validationErrors.length > 1 ? 's' : ''}`}
              {validationErrors.length > 0 && validationWarnings.length > 0 && ', '}
              {validationWarnings.length > 0 && `${validationWarnings.length} warning${validationWarnings.length > 1 ? 's' : ''}`}
            </span>
            <span className="text-gray-400 text-xs">{healthOpen ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {healthOpen && (
            <div className="border-t border-inherit overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-white/60">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Employee</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Issue</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Message</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40">
                  {validationIssues.map(issue => (
                    <tr key={issue.id}>
                      <td className="px-4 py-2 text-gray-800 font-medium">{issue.employee_name} <span className="text-gray-400">({issue.employee_id})</span></td>
                      <td className="px-4 py-2 text-gray-700">{issue.issue_type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2 text-gray-600 max-w-xs">{issue.message}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full font-medium ${issue.severity === 'ERROR' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{issue.severity}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Run-level issues */}
      {(errorItems.length > 0 || holdItems.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-sm font-medium text-amber-800 mb-2">⚠ Attention needed</div>
          <div className="flex gap-4 text-xs text-amber-700">
            {errorItems.length > 0 && <span>{errorItems.length} employee(s) with errors</span>}
            {holdItems.length > 0 && <span>{holdItems.length} employee(s) on hold</span>}
          </div>
        </div>
      )}

      {/* Department breakdown */}
      {summary.department_breakdown.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm font-medium text-gray-700">By Department</div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-gray-100">
            {summary.department_breakdown.map(d => (
              <div key={d.department} className="px-4 py-3">
                <div className="text-xs text-gray-500 truncate">{d.department}</div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5">{fmt(d.total_net)}</div>
                <div className="text-xs text-gray-400">{d.count} employees</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employee table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Employees <span className="ml-2 text-xs text-gray-400">({items.length})</span></h3>
          <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        </div>
        {items.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No employees yet. Click <strong>Calculate</strong> to populate.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Employee</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Dept</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Days</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Gross</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Deductions</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Net Pay</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredItems.map(item => (
                  <Fragment key={item.id}>
                    <tr className={`hover:bg-gray-50 ${item.status === 'ERROR' ? 'bg-red-50' : item.status === 'ON_HOLD' ? 'bg-yellow-50' : ''}`}>
                      <td className="px-4 py-3">
                        {/* B4 — click to expand attendance snapshot */}
                        <button onClick={() => setExpandedRow(expandedRow === item.id ? null : item.id)} className="text-left w-full">
                          <div className="font-medium text-gray-900 text-sm flex items-center gap-1">
                            <span className="text-gray-400 text-xs">{expandedRow === item.id ? '▼' : '▶'}</span>
                            {item.employee_name}
                          </div>
                          <div className="text-xs text-gray-400">{item.employee_id}</div>
                          {item.hold_reason && <div className="text-xs text-yellow-600 mt-0.5">Hold: {item.hold_reason}</div>}
                          {item.error_message && <div className="text-xs text-red-600 mt-0.5 max-w-xs truncate">{item.error_message}</div>}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{item.department || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ITEM_STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-600'}`}>{item.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">
                        {item.payable_days}/{item.days_in_month}
                        {item.lop_days > 0 && <span className="text-red-500 ml-1">(-{item.lop_days})</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 text-sm">{fmt(item.gross_earnings)}</td>
                      <td className="px-4 py-3 text-right text-gray-700 text-sm">{fmt(item.total_deductions)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 text-sm">{fmt(item.net_pay)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end flex-wrap">
                          {item.status === 'INCLUDED' && canEdit && (
                            <button onClick={() => setHoldTarget(item)} className="text-xs text-yellow-600 hover:text-yellow-800 font-medium">Hold</button>
                          )}
                          {item.status === 'ON_HOLD' && (
                            <button onClick={() => handleReleaseHold(item)} disabled={actionLoading} className="text-xs text-green-600 hover:text-green-800 font-medium">Release</button>
                          )}
                          {canEdit && item.status !== 'ON_HOLD' && (
                            <button onClick={() => handleReprocess(item)} disabled={actionLoading} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Recalc</button>
                          )}
                          {/* B1 — per-employee release */}
                          {canReleaseIndividual && item.payslip_id && (
                            <button onClick={() => handleReleaseEmployee(item)} disabled={actionLoading} className="text-xs text-green-600 hover:text-green-800 font-medium">✓ Release</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* B4 — attendance snapshot expanded row */}
                    {expandedRow === item.id && (
                      <tr>
                        <td colSpan={8} className="px-6 py-3 bg-gray-50 text-xs text-gray-600 space-y-1">
                          <div><strong>Source:</strong> {item.calculation_source}</div>
                          <div><strong>Payable Days:</strong> {item.payable_days} / {item.days_in_month} &nbsp;|&nbsp; <strong>LOP:</strong> {item.lop_days} &nbsp;|&nbsp; <strong>Work Days:</strong> {item.work_days}</div>
                          <div><strong>Proration:</strong> {(item.proration_factor * 100).toFixed(2)}%</div>
                          {item.payslip_id && <div><strong>Payslip ID:</strong> {item.payslip_id}</div>}
                          {item.calculated_at && <div><strong>Calculated:</strong> {new Date(item.calculated_at).toLocaleString()}</div>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transition modal */}
      {transitionTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-1">{TRANSITION_LABELS[transitionTarget] || transitionTarget}</h2>
            <p className="text-sm text-gray-500 mb-4">
              Move this run from <strong>{summary.status}</strong> → <strong>{transitionTarget}</strong>.
              {transitionTarget === 'REOPENED' && ' A reason is required.'}
            </p>
            {transitionTarget === 'REOPENED' && (
              <textarea className="w-full border rounded-lg px-3 py-2 text-sm mb-4" rows={3}
                placeholder="Reason for reopening…" value={transitionReason} onChange={e => setTransitionReason(e.target.value)} />
            )}
            <div className="flex gap-3">
              <button onClick={handleTransition}
                disabled={actionLoading || (transitionTarget === 'REOPENED' && !transitionReason.trim())}
                className={`flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${TRANSITION_COLORS[transitionTarget] || 'bg-indigo-600'}`}>
                {actionLoading ? 'Processing…' : 'Confirm'}
              </button>
              <button onClick={() => { setTransitionTarget(''); setTransitionReason(''); }}
                className="flex-1 py-2.5 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Hold modal */}
      {holdTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-1">Hold {holdTarget.employee_name}</h2>
            <p className="text-sm text-gray-500 mb-4">This employee will be excluded from payslip generation in this run.</p>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm mb-4" rows={3}
              placeholder="Reason for hold…" value={holdReason} onChange={e => setHoldReason(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={handleHold} disabled={actionLoading || !holdReason.trim()}
                className="flex-1 py-2.5 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50">
                {actionLoading ? 'Processing…' : 'Hold Employee'}
              </button>
              <button onClick={() => { setHoldTarget(null); setHoldReason(''); }}
                className="flex-1 py-2.5 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
