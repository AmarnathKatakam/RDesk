import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { payrollRunAPI } from '../services/api';
import PayrollNav from '../components/PayrollNav';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT:      'bg-gray-100 text-gray-700',
  CALCULATED: 'bg-blue-100 text-blue-700',
  REVIEWED:   'bg-yellow-100 text-yellow-700',
  APPROVED:   'bg-indigo-100 text-indigo-700',
  LOCKED:     'bg-orange-100 text-orange-700',
  RELEASED:   'bg-green-100 text-green-700',
  PAID:       'bg-emerald-100 text-emerald-700',
  REOPENED:   'bg-red-100 text-red-700',
};

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

export default function PayrollRunList() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ month: 'March', year: new Date().getFullYear(), salary_type: 'SALARY' });
  const [creating, setCreating] = useState(false);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const res = await payrollRunAPI.list();
      setRuns(res.data.runs || []);
    } catch {
      setError('Failed to load payroll runs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRuns(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await payrollRunAPI.create(form);
      setShowCreate(false);
      fetchRuns();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create run.');
    } finally {
      setCreating(false);
    }
  };

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-500 mt-1">Manage monthly payroll lifecycle</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          + New Run
        </button>
      </div>

      {/* Payroll sub-nav */}
      <PayrollNav />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button className="ml-2 underline" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Create Payroll Run</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.month}
                  onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                >
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Salary Type</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.salary_type}
                  onChange={e => setForm(f => ({ ...f, salary_type: e.target.value }))}
                >
                  <option value="SALARY">Salary</option>
                  <option value="STIPEND">Stipend</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No payroll runs yet. Create one to get started.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Period</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Employees</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total Net</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created By</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runs.map(run => (
                <tr key={run.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{run.month} {run.year}</td>
                  <td className="px-4 py-3 text-gray-600">{run.salary_type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[run.status] || 'bg-gray-100 text-gray-600'}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{run.total_employees}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(run.total_net)}</td>
                  <td className="px-4 py-3 text-gray-500">{run.created_by || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => navigate(`/admin/payroll/runs/${run.id}`)}
                      className="text-indigo-600 hover:underline text-xs font-medium"
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
