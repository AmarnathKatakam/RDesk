import { useEffect, useState } from 'react';
import { employeeAPI, payrollConfigAPI } from '../services/api';
import PayrollNav from '../components/PayrollNav';

interface Employee {
  id: number;
  name: string;
  employee_id: string;
  department_name?: string;
  designation?: string;
}

interface SalaryTemplate {
  id: number;
  code: string;
  name: string;
}

interface Assignment {
  id: number;
  employee: number;
  employee_name?: string;
  template: number;
  template_code?: string;
  template_name?: string;
  annual_ctc: string;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  notes: string;
  created_at: string;
}

export default function SalaryAssignment() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<SalaryTemplate[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [empHistory, setEmpHistory] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [isRevision, setIsRevision] = useState(false);
  const [form, setForm] = useState({
    template: '',
    annual_ctc: '',
    effective_from: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    setLoading(true);
    try {
      const [empRes, tplRes, asnRes] = await Promise.all([
        employeeAPI.getAll(),
        payrollConfigAPI.getTemplates({ active_only: true }),
        payrollConfigAPI.getAssignments({ active_only: true }),
      ]);
      setEmployees(empRes.data.results || empRes.data);
      setTemplates(tplRes.data);
      setAssignments(asnRes.data);
    } catch {
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  async function selectEmployee(emp: Employee) {
    setSelectedEmp(emp);
    setShowForm(false);
    setHistoryLoading(true);
    try {
      const res = await payrollConfigAPI.getEmployeeSalaryHistory(emp.id);
      setEmpHistory(res.data);
    } catch {
      setEmpHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function submitForm() {
    if (!selectedEmp || !form.template || !form.annual_ctc || !form.effective_from) {
      setError('Please fill all required fields.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        template: parseInt(form.template),
        annual_ctc: form.annual_ctc,
        effective_from: form.effective_from,
        notes: form.notes,
      };
      if (isRevision) {
        await payrollConfigAPI.reviseSalary(selectedEmp.id, payload);
        setSuccess(`Salary revised for ${selectedEmp.name}.`);
      } else {
        await payrollConfigAPI.assignSalary(selectedEmp.id, payload);
        setSuccess(`Salary assigned to ${selectedEmp.name}.`);
      }
      setShowForm(false);
      setForm({ template: '', annual_ctc: '', effective_from: new Date().toISOString().split('T')[0], notes: '' });
      await Promise.all([loadInitial(), selectEmployee(selectedEmp)]);
    } catch (e: any) {
      setError(e.response?.data?.error || e.response?.data?.non_field_errors?.[0] || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  const activeAssignment = empHistory.find(a => a.is_active);
  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id?.toLowerCase().includes(search.toLowerCase())
  );

  const assignedEmpIds = new Set(assignments.map(a => a.employee));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
        <p className="text-sm text-gray-500 mt-1">Assign salary templates and manage CTC for employees</p>
      </div>

      {/* Payroll sub-nav */}
      <PayrollNav />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex justify-between">
          {success}
          <button onClick={() => setSuccess('')} className="text-green-400 hover:text-green-600">✕</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="flex gap-6">
          {/* Employee list */}
          <div className="w-72 flex-shrink-0">
            <div className="mb-2">
              <input
                type="text"
                placeholder="Search employees..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden max-h-[calc(100vh-280px)] overflow-y-auto">
              {filteredEmployees.length === 0 ? (
                <div className="p-4 text-sm text-gray-400 text-center">No employees found</div>
              ) : (
                filteredEmployees.map(emp => {
                  const hasAssignment = assignedEmpIds.has(emp.id);
                  return (
                    <button
                      key={emp.id}
                      onClick={() => selectEmployee(emp)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${selectedEmp?.id === emp.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm text-gray-900">{emp.name}</div>
                        <span className={`w-2 h-2 rounded-full ${hasAssignment ? 'bg-green-400' : 'bg-gray-300'}`} title={hasAssignment ? 'Has active assignment' : 'No assignment'} />
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{emp.employee_id} · {emp.department_name || 'No dept'}</div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="mt-2 text-xs text-gray-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Assigned
              <span className="w-2 h-2 rounded-full bg-gray-300 inline-block ml-2" /> Not assigned
            </div>
          </div>

          {/* Employee detail */}
          {selectedEmp ? (
            <div className="flex-1 space-y-4">
              {/* Employee header */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedEmp.name}</h2>
                    <p className="text-sm text-gray-500">{selectedEmp.employee_id} · {selectedEmp.designation || 'No designation'} · {selectedEmp.department_name || 'No department'}</p>
                  </div>
                  <div className="flex gap-2">
                    {activeAssignment ? (
                      <button
                        onClick={() => { setIsRevision(true); setShowForm(true); setForm(f => ({ ...f, template: String(activeAssignment.template), annual_ctc: activeAssignment.annual_ctc })); }}
                        className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600"
                      >
                        Revise Salary
                      </button>
                    ) : (
                      <button
                        onClick={() => { setIsRevision(false); setShowForm(true); }}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
                      >
                        Assign Salary
                      </button>
                    )}
                  </div>
                </div>

                {activeAssignment && (
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div className="bg-indigo-50 rounded-lg p-3">
                      <div className="text-xs text-indigo-600 font-medium">Current Template</div>
                      <div className="text-sm font-semibold text-indigo-900 mt-0.5">{activeAssignment.template_name || `Template #${activeAssignment.template}`}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-xs text-green-600 font-medium">Annual CTC</div>
                      <div className="text-sm font-semibold text-green-900 mt-0.5">₹{parseFloat(activeAssignment.annual_ctc).toLocaleString('en-IN')}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 font-medium">Effective From</div>
                      <div className="text-sm font-semibold text-gray-800 mt-0.5">{activeAssignment.effective_from}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Assign / Revise form */}
              {showForm && (
                <div className="bg-white border border-indigo-200 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">
                    {isRevision ? 'Revise Salary' : 'Assign Salary'} — {selectedEmp.name}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Salary Template *</label>
                      <select
                        value={form.template}
                        onChange={e => setForm(p => ({ ...p, template: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Select template...</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Annual CTC (₹) *</label>
                      <input
                        type="number"
                        placeholder="e.g. 600000"
                        value={form.annual_ctc}
                        onChange={e => setForm(p => ({ ...p, annual_ctc: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Effective From *</label>
                      <input
                        type="date"
                        value={form.effective_from}
                        onChange={e => setForm(p => ({ ...p, effective_from: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Notes</label>
                      <input
                        type="text"
                        placeholder={isRevision ? 'e.g. Annual increment FY 2025-26' : 'Optional notes'}
                        value={form.notes}
                        onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={submitForm} disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                      {saving ? 'Saving...' : isRevision ? 'Revise Salary' : 'Assign Salary'}
                    </button>
                    <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Salary history */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800 text-sm">Salary History</h3>
                </div>
                {historyLoading ? (
                  <div className="p-4 text-center text-gray-400 text-sm">Loading history...</div>
                ) : empHistory.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">No salary assignments yet</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Template</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Annual CTC</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Effective From</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Effective To</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {empHistory.map(a => (
                        <tr key={a.id} className={a.is_active ? 'bg-green-50' : ''}>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-gray-900">{a.template_name || `Template #${a.template}`}</div>
                            <div className="text-xs text-gray-400">{a.template_code}</div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-800">
                            ₹{parseFloat(a.annual_ctc).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">{a.effective_from}</td>
                          <td className="px-4 py-2.5 text-gray-600">{a.effective_to || '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {a.is_active ? 'Active' : 'Closed'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs max-w-xs truncate">{a.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-3">👤</div>
                <p className="text-sm">Select an employee to manage their salary assignment</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
