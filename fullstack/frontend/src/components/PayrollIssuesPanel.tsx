import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { payrollRunAPI } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ValidationIssue {
  id: number;
  employee_name: string;
  employee_id: string;
  issue_type: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  resolved: boolean;
  pay_period_month: string;
  pay_period_year: number;
}

interface IssueGroup {
  type: string;
  label: string;
  severity: 'ERROR' | 'WARNING';
  count: number;
  employees: string[];
  action: { label: string; href: string };
}

// ─── Issue type metadata ──────────────────────────────────────────────────────

const ISSUE_META: Record<string, { label: string; action: (href?: string) => { label: string; href: string } }> = {
  MISSING_BANK_DETAILS:    { label: 'Missing Bank Details',     action: () => ({ label: 'Fix in Employees', href: '/admin/employees' }) },
  MISSING_SALARY_DATA:     { label: 'Missing Salary Data',      action: () => ({ label: 'Add Monthly Inputs', href: '/admin/payroll/monthly-inputs' }) },
  MISSING_SALARY_STRUCTURE:{ label: 'No Salary Assignment',     action: () => ({ label: 'Assign Now', href: '/admin/payroll/salary-assignments' }) },
  MISSING_PF_DETAILS:      { label: 'Missing PF Number',        action: () => ({ label: 'Fix in Employees', href: '/admin/employees' }) },
  NEGATIVE_NET_PAY:        { label: 'Negative Net Pay',         action: () => ({ label: 'Review Inputs', href: '/admin/payroll/monthly-inputs' }) },
  DUPLICATE_PAYSLIP:       { label: 'Duplicate Payslip',        action: () => ({ label: 'Review Run', href: '/admin/payroll/runs' }) },
  INACTIVE_EMPLOYEE:       { label: 'Inactive Employee in Run', action: () => ({ label: 'Review', href: '/admin/payroll/runs' }) },
  OTHER:                   { label: 'Other Issue',              action: () => ({ label: 'Review', href: '/admin/payroll/runs' }) },
};

// ─── Health indicator ─────────────────────────────────────────────────────────

export function ValidationHealthBadge({ errors, warnings }: { errors: number; warnings: number }) {
  if (errors > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
        {errors} error{errors > 1 ? 's' : ''}
      </span>
    );
  }
  if (warnings > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
        {warnings} warning{warnings > 1 ? 's' : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
      All clear
    </span>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface Props {
  month: string;
  year: number;
  compact?: boolean; // compact mode for dashboard
}

export default function PayrollIssuesPanel({ month, year, compact = false }: Props) {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!month || !year) return;
    setLoading(true);
    payrollRunAPI.getValidationIssues({ month, year, resolved: false })
      .then(res => setIssues(res.data.issues || []))
      .catch(() => setIssues([]))
      .finally(() => setLoading(false));
  }, [month, year]);

  if (loading) {
    return <div className="text-xs text-gray-400 py-2">Checking for issues…</div>;
  }

  const errors = issues.filter(i => i.severity === 'ERROR');
  const warnings = issues.filter(i => i.severity === 'WARNING');

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
        <span className="text-sm text-green-700 font-medium">No issues found — payroll is ready to proceed</span>
      </div>
    );
  }

  // Group by issue_type
  const groups: IssueGroup[] = [];
  const typeMap: Record<string, ValidationIssue[]> = {};
  for (const issue of issues) {
    if (!typeMap[issue.issue_type]) typeMap[issue.issue_type] = [];
    typeMap[issue.issue_type].push(issue);
  }
  for (const [type, list] of Object.entries(typeMap)) {
    const meta = ISSUE_META[type] || ISSUE_META.OTHER;
    const severity = list.some(i => i.severity === 'ERROR') ? 'ERROR' : 'WARNING';
    groups.push({
      type,
      label: meta.label,
      severity,
      count: list.length,
      employees: list.map(i => i.employee_name).slice(0, 5),
      action: meta.action(),
    });
  }
  // Sort: errors first
  groups.sort((a, b) => (a.severity === 'ERROR' ? -1 : 1) - (b.severity === 'ERROR' ? -1 : 1));

  if (compact) {
    // Compact mode: just the summary row for dashboard
    return (
      <div className="space-y-2">
        {groups.map(g => (
          <div key={g.type}
            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${
              g.severity === 'ERROR'
                ? 'bg-red-50 border-red-200'
                : 'bg-yellow-50 border-yellow-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${g.severity === 'ERROR' ? 'bg-red-500' : 'bg-yellow-500'}`} />
              <span className={`font-medium text-xs ${g.severity === 'ERROR' ? 'text-red-800' : 'text-yellow-800'}`}>
                {g.label}
              </span>
              <span className={`text-xs ${g.severity === 'ERROR' ? 'text-red-600' : 'text-yellow-600'}`}>
                ({g.count} employee{g.count > 1 ? 's' : ''})
              </span>
            </div>
            <button
              onClick={() => navigate(g.action.href)}
              className={`text-xs font-medium px-2 py-1 rounded ${
                g.severity === 'ERROR'
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              }`}
            >
              {g.action.label} →
            </button>
          </div>
        ))}
      </div>
    );
  }

  // Full mode: expandable groups with employee list
  return (
    <div className="space-y-2">
      {/* Summary bar */}
      <div className="flex items-center gap-3 mb-3">
        {errors.length > 0 && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-red-700">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {errors.length} error{errors.length > 1 ? 's' : ''} — blocks workflow
          </span>
        )}
        {warnings.length > 0 && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-yellow-700">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            {warnings.length} warning{warnings.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {groups.map(g => {
        const isOpen = expanded === g.type;
        const allEmployees = typeMap[g.type].map(i => ({ name: i.employee_name, id: i.employee_id, msg: i.message }));
        return (
          <div key={g.type}
            className={`rounded-xl border overflow-hidden ${
              g.severity === 'ERROR' ? 'border-red-200' : 'border-yellow-200'
            }`}
          >
            {/* Header row */}
            <div
              className={`flex items-center justify-between px-4 py-3 cursor-pointer ${
                g.severity === 'ERROR' ? 'bg-red-50 hover:bg-red-100' : 'bg-yellow-50 hover:bg-yellow-100'
              }`}
              onClick={() => setExpanded(isOpen ? null : g.type)}
            >
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${g.severity === 'ERROR' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                <div>
                  <span className={`text-sm font-semibold ${g.severity === 'ERROR' ? 'text-red-800' : 'text-yellow-800'}`}>
                    {g.label}
                  </span>
                  <span className={`ml-2 text-xs ${g.severity === 'ERROR' ? 'text-red-600' : 'text-yellow-600'}`}>
                    {g.count} employee{g.count > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={e => { e.stopPropagation(); navigate(g.action.href); }}
                  className={`text-xs font-medium px-3 py-1 rounded-lg ${
                    g.severity === 'ERROR'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-yellow-500 text-white hover:bg-yellow-600'
                  }`}
                >
                  {g.action.label}
                </button>
                <span className={`text-xs ${g.severity === 'ERROR' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </div>
            </div>

            {/* Expanded employee list */}
            {isOpen && (
              <div className="bg-white divide-y divide-gray-100">
                {allEmployees.map((emp, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-start justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{emp.name}</span>
                      <span className="ml-2 text-xs text-gray-400">{emp.id}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{emp.msg}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
