import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { payrollRunAPI } from '../services/api';
import PayrollNav from '../components/PayrollNav';
import PayrollIssuesPanel, { ValidationHealthBadge } from '../components/PayrollIssuesPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PayrollRun {
  id: number;
  month: string;
  year: number;
  salary_type: string;
  status: string;
  total_employees: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  created_by: string | null;
  created_at: string | null;
  released_at: string | null;
  valid_transitions: string[];
}

// ─── Workflow step definitions ────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  {
    key: 'DRAFT',
    label: 'Draft',
    description: 'Run created, not yet calculated',
    icon: '📋',
  },
  {
    key: 'CALCULATED',
    label: 'Calculated',
    description: 'Salaries computed for all employees',
    icon: '🔢',
  },
  {
    key: 'REVIEWED',
    label: 'Reviewed',
    description: 'HR has reviewed the numbers',
    icon: '👁',
  },
  {
    key: 'APPROVED',
    label: 'Approved',
    description: 'Management sign-off complete',
    icon: '✅',
  },
  {
    key: 'LOCKED',
    label: 'Locked',
    description: 'Payroll locked, no further edits',
    icon: '🔒',
  },
  {
    key: 'RELEASED',
    label: 'Released',
    description: 'Payslips visible to employees',
    icon: '📤',
  },
  {
    key: 'PAID',
    label: 'Paid',
    description: 'Salaries transferred to bank',
    icon: '💳',
  },
];

const STATUS_ORDER: Record<string, number> = {
  DRAFT: 0, CALCULATED: 1, REVIEWED: 2,
  APPROVED: 3, LOCKED: 4, RELEASED: 5, PAID: 6, REOPENED: -1,
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  DRAFT:      { bg: 'bg-gray-100',    text: 'text-gray-700',    border: 'border-gray-300' },
  CALCULATED: { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300' },
  REVIEWED:   { bg: 'bg-yellow-100',  text: 'text-yellow-700',  border: 'border-yellow-300' },
  APPROVED:   { bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-300' },
  LOCKED:     { bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-300' },
  RELEASED:   { bg: 'bg-green-100',   text: 'text-green-700',   border: 'border-green-300' },
  PAID:       { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  REOPENED:   { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300' },
};

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const fmt = (n: number) =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PayrollDashboard() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create run modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear(),
    salary_type: 'SALARY',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const res = await payrollRunAPI.list();
      setRuns(res.data.runs || []);
    } catch {
      setError('Failed to load payroll data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRuns(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const res = await payrollRunAPI.create(form);
      setShowCreate(false);
      navigate(`/admin/payroll/runs/${res.data.run.id}`);
    } catch (e: any) {
      setCreateError(e?.response?.data?.message || 'Failed to create run.');
    } finally {
      setCreating(false);
    }
  };

  // Most recent run (for the active workflow panel)
  const activeRun = runs[0] ?? null;
  const currentStepIndex = activeRun ? (STATUS_ORDER[activeRun.status] ?? 0) : -1;

  // Stats across all runs
  const totalReleased = runs.filter(r => r.status === 'RELEASED' || r.status === 'PAID').length;
  const totalDraft = runs.filter(r => r.status === 'DRAFT' || r.status === 'CALCULATED').length;
  const totalNet = runs.reduce((s, r) => s + r.total_net, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage monthly payroll from calculation to release</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
        >
          <span>+</span> New Payroll Run
        </button>
      </div>

      <PayrollNav />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading payroll data…</div>
      ) : (
        <div className="space-y-6">

          {/* ── Top stats row ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Runs" value={runs.length.toString()} sub="all time" />
            <StatCard label="In Progress" value={totalDraft.toString()} sub="draft or calculated" accent="blue" />
            <StatCard label="Released" value={totalReleased.toString()} sub="paid or released" accent="green" />
            <StatCard label="Total Payroll" value={fmt(totalNet)} sub="across all runs" accent="indigo" />
          </div>

          {/* ── Active run workflow panel ── */}
          {activeRun ? (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Run header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-gray-900">
                        {activeRun.month} {activeRun.year}
                      </h2>
                      <span className="text-xs text-gray-400">{activeRun.salary_type}</span>
                      <StatusBadge status={activeRun.status} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Most recent payroll run</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/admin/payroll/runs/${activeRun.id}`)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Open Run →
                </button>
              </div>

              {/* Workflow steps */}
              <div className="px-6 py-5">
                <div className="flex items-center gap-0 overflow-x-auto pb-2">
                  {WORKFLOW_STEPS.map((step, idx) => {
                    const stepOrder = STATUS_ORDER[step.key] ?? idx;
                    const isDone = currentStepIndex > stepOrder;
                    const isCurrent = currentStepIndex === stepOrder;
                    const isReopened = activeRun.status === 'REOPENED';

                    return (
                      <div key={step.key} className="flex items-center flex-shrink-0">
                        {/* Step node */}
                        <div className="flex flex-col items-center" style={{ minWidth: 90 }}>
                          <div className={[
                            'w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all',
                            isDone
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : isCurrent && !isReopened
                              ? 'bg-white border-indigo-500 text-indigo-600 shadow-md ring-2 ring-indigo-200'
                              : 'bg-gray-50 border-gray-200 text-gray-400',
                          ].join(' ')}>
                            {isDone ? '✓' : step.icon}
                          </div>
                          <div className={[
                            'text-xs font-medium mt-1.5 text-center',
                            isCurrent && !isReopened ? 'text-indigo-600' : isDone ? 'text-gray-700' : 'text-gray-400',
                          ].join(' ')}>
                            {step.label}
                          </div>
                          {isCurrent && !isReopened && (
                            <div className="text-xs text-gray-400 text-center mt-0.5 max-w-[80px] leading-tight">
                              {step.description}
                            </div>
                          )}
                        </div>
                        {/* Connector */}
                        {idx < WORKFLOW_STEPS.length - 1 && (
                          <div className={[
                            'h-0.5 w-8 flex-shrink-0 mx-1',
                            isDone ? 'bg-indigo-400' : 'bg-gray-200',
                          ].join(' ')} />
                        )}
                      </div>
                    );
                  })}

                  {/* Reopened special state */}
                  {activeRun.status === 'REOPENED' && (
                    <div className="ml-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <span className="text-red-500 text-sm">↩</span>
                      <span className="text-xs font-medium text-red-700">Reopened — needs recalculation</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Run summary numbers */}
              <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
                {[
                  { label: 'Employees', value: activeRun.total_employees.toString() },
                  { label: 'Gross Earnings', value: fmt(activeRun.total_gross) },
                  { label: 'Deductions', value: fmt(activeRun.total_deductions) },
                  { label: 'Net Pay', value: fmt(activeRun.total_net), highlight: true },
                ].map(card => (
                  <div key={card.label} className="px-6 py-4">
                    <div className="text-xs text-gray-500 mb-1">{card.label}</div>
                    <div className={`text-lg font-semibold ${card.highlight ? 'text-indigo-700' : 'text-gray-900'}`}>
                      {card.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Next action hint + issues */}
              <div className="border-t border-gray-100">
                {/* Issues panel */}
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payroll Health</span>
                    <ValidationHealthBadge errors={0} warnings={0} />
                  </div>
                  <PayrollIssuesPanel month={activeRun.month} year={activeRun.year} compact />
                </div>
                {activeRun.valid_transitions.length > 0 && (
                  <div className="px-6 py-3 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between">
                    <span className="text-xs text-indigo-700">
                      Next step: <strong>{activeRun.valid_transitions[0]}</strong>
                    </span>
                    <div className="flex gap-3">
                      <button
                        onClick={() => navigate(`/admin/payroll/preview`)}
                        className="text-xs text-indigo-600 font-medium hover:underline"
                      >
                        Preview →
                      </button>
                      <button
                        onClick={() => navigate(`/admin/payroll/runs/${activeRun.id}`)}
                        className="text-xs text-indigo-600 font-medium hover:underline"
                      >
                        Take action →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
              <div className="text-4xl mb-3">📋</div>
              <h3 className="text-base font-medium text-gray-700 mb-1">No payroll runs yet</h3>
              <p className="text-sm text-gray-400 mb-4">Create your first payroll run to get started</p>
              <button
                onClick={() => setShowCreate(true)}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                + Create Payroll Run
              </button>
            </div>
          )}

          {/* ── Recent runs table ── */}
          {runs.length > 1 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">All Runs</h3>
                <button
                  onClick={() => navigate('/admin/payroll/runs')}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  View all →
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Period</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Type</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Employees</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Net Pay</th>
                    <th className="px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {runs.slice(0, 8).map(run => (
                    <tr
                      key={run.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/admin/payroll/runs/${run.id}`)}
                    >
                      <td className="px-5 py-3 font-medium text-gray-900">{run.month} {run.year}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{run.salary_type}</td>
                      <td className="px-5 py-3"><StatusBadge status={run.status} /></td>
                      <td className="px-5 py-3 text-right text-gray-600">{run.total_employees}</td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">{fmt(run.total_net)}</td>
                      <td className="px-5 py-3 text-right text-indigo-500 text-xs">→</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Quick links ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Monthly Inputs', desc: 'Edit salary data per employee', href: '/admin/payroll/monthly-inputs', icon: '✏️' },
              { label: 'Preview', desc: 'Review all breakdowns before approving', href: '/admin/payroll/preview', icon: '🔍' },
              { label: 'Templates', desc: 'Configure component structures', href: '/admin/payroll/salary-templates', icon: '📐' },
              { label: 'Reports', desc: 'Register, bank transfer, variance', href: '/admin/payroll/reports', icon: '📊' },
            ].map(link => (
              <button
                key={link.href}
                onClick={() => navigate(link.href)}
                className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-indigo-300 hover:shadow-sm transition-all group"
              >
                <div className="text-2xl mb-2">{link.icon}</div>
                <div className="text-sm font-medium text-gray-800 group-hover:text-indigo-700">{link.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{link.desc}</div>
              </button>
            ))}
          </div>

        </div>
      )}

      {/* ── Create Run Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">New Payroll Run</h2>
            <p className="text-sm text-gray-500 mb-5">Select the period and type to begin payroll processing.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Month</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.month}
                  onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                >
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Year</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Payroll Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {['SALARY', 'STIPEND'].map(type => (
                    <button
                      key={type}
                      onClick={() => setForm(f => ({ ...f, salary_type: type }))}
                      className={[
                        'py-2.5 rounded-lg text-sm font-medium border-2 transition-all',
                        form.salary_type === type
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                      ].join(' ')}
                    >
                      {type === 'SALARY' ? '💼 Salary' : '🎓 Stipend'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {createError && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                {createError}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create & Open'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setCreateError(''); }}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {status}
    </span>
  );
}

function StatCard({
  label, value, sub, accent,
}: {
  label: string; value: string; sub: string; accent?: 'blue' | 'green' | 'indigo';
}) {
  const accentMap = {
    blue:   { num: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-100' },
    green:  { num: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-100' },
    indigo: { num: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100' },
  };
  const style = accent ? accentMap[accent] : { num: 'text-gray-900', bg: 'bg-white', border: 'border-gray-200' };

  return (
    <div className={`${style.bg} border ${style.border} rounded-xl p-4`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${style.num}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}
