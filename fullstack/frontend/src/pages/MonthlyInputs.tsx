import { useState, useEffect, useCallback } from 'react';
import { payrollInputAPI } from '../services/api';
import PayrollNav from '../components/PayrollNav';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SalaryRow {
  id: number; employee: number; employee_name: string; employee_code: string;
  month: string; year: number; salary_type: string;
  basic: string; hra: string; da: string; conveyance: string; medical: string;
  special_allowance: string; pf_employee: string; professional_tax: string;
  pf_employer: string; other_deductions: string; salary_advance: string;
  work_days: number; days_in_month: number; lop_days: number; lop_override: number | null;
  bonus: string; incentive: string; arrears: string; reimbursement: string;
  other_earning_adjustment: string; other_deduction_adjustment: string;
  remarks: string; source: string; net_pay: string; adjustment_count: number;
}

interface Adjustment {
  id?: number; employee: number; month: string; year: number; salary_type: string;
  adjustment_type: string; label: string; amount: string; is_taxable: boolean; remarks: string;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const ADJ_TYPES = [
  { value: 'BONUS', label: 'Bonus' }, { value: 'INCENTIVE', label: 'Incentive' },
  { value: 'ARREAR', label: 'Arrear' }, { value: 'REIMBURSEMENT', label: 'Reimbursement' },
  { value: 'EARNING', label: 'Other Earning' }, { value: 'DEDUCTION', label: 'Deduction' },
  { value: 'LOAN', label: 'Loan EMI' }, { value: 'OTHER', label: 'Other' },
];
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i);
const fmt = (n: string | number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// ─── Anomaly detection ────────────────────────────────────────────────────────

function getRowFlags(row: SalaryRow): string[] {
  const flags: string[] = [];
  const net = Number(row.net_pay);
  const lop = row.lop_override ?? row.lop_days;
  if (net <= 0) flags.push('Zero or negative net pay');
  if (lop > 10) flags.push(`High LOP: ${lop} days`);
  if (Number(row.bonus) > 50000) flags.push('Large bonus — verify');
  if (row.source === 'MANUAL_ENTRY') flags.push('Manually entered');
  return flags;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MonthlyInputs() {
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [salaryType, setSalaryType] = useState('SALARY');
  const [search, setSearch] = useState('');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  const [rows, setRows] = useState<SalaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<SalaryRow>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Add salary modal
  const [showAddSalaryModal, setShowAddSalaryModal] = useState(false);
  const [addSalaryForm, setAddSalaryForm] = useState<Partial<SalaryRow>>({ salary_type: 'SALARY' });
  const [addingSalary, setAddingSalary] = useState(false);

  // Process payroll state
  const [processingPayroll, setProcessingPayroll] = useState(false);
  const [processMsg, setProcessMsg] = useState('');

  // Adjustment drawer
  const [adjRow, setAdjRow] = useState<SalaryRow | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [newAdj, setNewAdj] = useState<Partial<Adjustment>>({ adjustment_type: 'BONUS', label: '', amount: '', is_taxable: false, remarks: '' });
  const [adjSaving, setAdjSaving] = useState(false);

  // Preview
  const [previewData, setPreviewData] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await payrollInputAPI.listByPeriod({ month, year, salary_type: salaryType });
      setRows(res.data.data || []);
    } catch { setError('Failed to load salary data.'); }
    finally { setLoading(false); }
  }, [month, year, salaryType]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Inline edit ────────────────────────────────────────────────────────────

  const startEdit = (row: SalaryRow) => {
    setEditingId(row.id);
    setEditForm({ ...row });
    setSaveMsg('');
    setPreviewData(null);
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); setPreviewData(null); };

  const saveEdit = async () => {
    if (!editForm.employee) return;
    setSaving(true); setSaveMsg('');
    try {
      await payrollInputAPI.upsert({ ...editForm, month, year, salary_type: salaryType });
      setSaveMsg('Saved');
      await loadData();
      setTimeout(() => { setEditingId(null); setSaveMsg(''); }, 800);
    } catch (e: any) {
      setSaveMsg(e?.response?.data?.errors ? JSON.stringify(e.response.data.errors) : 'Save failed');
    } finally { setSaving(false); }
  };

  const loadPreview = async () => {
    if (!editForm.employee) return;
    try {
      const res = await payrollInputAPI.preview({ employee: editForm.employee as number, month, year, salary_type: salaryType });
      setPreviewData(res.data);
    } catch {}
  };

  // ── Process Payroll ────────────────────────────────────────────────────────

  const processPayroll = async () => {
    setProcessingPayroll(true);
    setProcessMsg('');
    try {
      const res = await payrollInputAPI.processMonthlyInputs({ month, year });
      setProcessMsg(`✓ ${res.data.created} created, ${res.data.carry_forward} carried forward`);
      await new Promise(r => setTimeout(r, 1000));
      await loadData();
    } catch (e: any) {
      setProcessMsg(`✗ ${e?.response?.data?.message || 'Process failed'}`);
    } finally {
      setProcessingPayroll(false);
      setTimeout(() => setProcessMsg(''), 4000);
    }
  };

  // ── Add Salary Record ──────────────────────────────────────────────────────

  const addSalaryRecord = async () => {
    if (!addSalaryForm.employee) return;
    setAddingSalary(true);
    try {
      const empId = rows.find(r => r.employee === addSalaryForm.employee)?.employee;
      await payrollInputAPI.upsert({
        employee: addSalaryForm.employee,
        month,
        year,
        salary_type: 'SALARY',
        basic: addSalaryForm.basic || 0,
        hra: addSalaryForm.hra || 0,
        da: addSalaryForm.da || 0,
        conveyance: addSalaryForm.conveyance || 0,
        medical: addSalaryForm.medical || 0,
        special_allowance: addSalaryForm.special_allowance || 0,
        pf_employee: addSalaryForm.pf_employee || 0,
        professional_tax: addSalaryForm.professional_tax || 0,
        pf_employer: addSalaryForm.pf_employer || 0,
        work_days: addSalaryForm.work_days || 26,
        days_in_month: addSalaryForm.days_in_month || 30,
      });
      setShowAddSalaryModal(false);
      setAddSalaryForm({ salary_type: 'SALARY' });
      await loadData();
    } catch (e: any) {
      alert(e?.response?.data?.errors ? JSON.stringify(e.response.data.errors) : 'Create failed');
    } finally {
      setAddingSalary(false);
    }
  };

  // ── Adjustments ────────────────────────────────────────────────────────────

  const openAdj = async (row: SalaryRow) => {
    setAdjRow(row);
    try {
      const res = await payrollInputAPI.listAdjustments({ employee: row.employee, month, year, salary_type: salaryType });
      setAdjustments(res.data.data || []);
    } catch { setAdjustments([]); }
  };

  const addAdj = async () => {
    if (!adjRow || !newAdj.label || !newAdj.amount) return;
    setAdjSaving(true);
    try {
      await payrollInputAPI.createAdjustment({ ...newAdj, employee: adjRow.employee, month, year, salary_type: salaryType });
      const res = await payrollInputAPI.listAdjustments({ employee: adjRow.employee, month, year, salary_type: salaryType });
      setAdjustments(res.data.data || []);
      setNewAdj({ adjustment_type: 'BONUS', label: '', amount: '', is_taxable: false, remarks: '' });
      await loadData();
    } catch {}
    finally { setAdjSaving(false); }
  };

  const deleteAdj = async (id: number) => {
    await payrollInputAPI.deleteAdjustment(id);
    setAdjustments(p => p.filter(a => a.id !== id));
    await loadData();
  };

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = rows.filter(r => {
    const matchSearch = !search || r.employee_name.toLowerCase().includes(search.toLowerCase()) || r.employee_code.toLowerCase().includes(search.toLowerCase());
    const flags = getRowFlags(r);
    const matchFlag = !showFlaggedOnly || flags.length > 0;
    return matchSearch && matchFlag;
  });

  const flaggedCount = rows.filter(r => getRowFlags(r).length > 0).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Monthly Payroll Inputs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review and edit salary data before running payroll</p>
        </div>
        {flaggedCount > 0 && (
          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
            ⚠ {flaggedCount} flagged
          </span>
        )}
      </div>

      <PayrollNav />

      {/* Filter bar + Actions */}
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
        <input placeholder="Search employee…" value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showFlaggedOnly} onChange={e => setShowFlaggedOnly(e.target.checked)} className="rounded" />
          Flagged only
        </label>
        <div className="flex-1"></div>
        <button onClick={loadData} className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-400">
          Refresh
        </button>
        <button onClick={() => setShowAddSalaryModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + Add Salary
        </button>
        <button onClick={processPayroll} disabled={processingPayroll} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
          {processingPayroll ? 'Processing…' : 'Process Payroll'}
        </button>
      </div>

      {(error || processMsg) && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
          {error || processMsg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-3xl mb-3">📋</div>
              <p className="text-sm">No salary data for {month} {year}.</p>
              <p className="text-xs mt-1 text-gray-400">Upload via Excel or add entries manually.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    {['Employee', 'LOP', 'Bonus', 'Incentive', 'Net Pay', 'Source', 'Adjustments', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((row, i) => {
                    const flags = getRowFlags(row);
                    const isFlagged = flags.length > 0;
                    const isEditing = editingId === row.id;
                    const lop = row.lop_override ?? row.lop_days;

                    return (
                      <tr key={row.id} className={`${isFlagged ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-indigo-50 transition-colors`}>
                        {/* Employee */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{row.employee_name}</div>
                          <div className="text-xs text-gray-400">{row.employee_code}</div>
                          {flags.map((f, fi) => (
                            <div key={fi} className="text-xs text-amber-700 mt-0.5 flex items-center gap-1">
                              <span>⚠</span> {f}
                            </div>
                          ))}
                        </td>

                        {/* LOP */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input type="number" value={editForm.lop_days ?? ''} onChange={e => setEditForm(p => ({ ...p, lop_days: Number(e.target.value) }))}
                              className="w-16 border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                          ) : (
                            <span className={lop > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>{lop}</span>
                          )}
                        </td>

                        {/* Bonus */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input type="number" value={editForm.bonus ?? ''} onChange={e => setEditForm(p => ({ ...p, bonus: e.target.value }))}
                              className="w-24 border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                          ) : (
                            <span className={Number(row.bonus) > 0 ? 'text-green-700 font-medium' : 'text-gray-500'}>
                              {Number(row.bonus) > 0 ? fmt(row.bonus) : '—'}
                            </span>
                          )}
                        </td>

                        {/* Incentive */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input type="number" value={editForm.incentive ?? ''} onChange={e => setEditForm(p => ({ ...p, incentive: e.target.value }))}
                              className="w-24 border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                          ) : (
                            <span className={Number(row.incentive) > 0 ? 'text-green-700 font-medium' : 'text-gray-500'}>
                              {Number(row.incentive) > 0 ? fmt(row.incentive) : '—'}
                            </span>
                          )}
                        </td>

                        {/* Net Pay */}
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${Number(row.net_pay) <= 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {fmt(row.net_pay)}
                          </span>
                          {isEditing && previewData && (
                            <div className="text-xs text-indigo-600 mt-0.5">
                              Preview: {fmt(previewData.preview_net)}
                            </div>
                          )}
                        </td>

                        {/* Source */}
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.source === 'MANUAL_ENTRY' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {row.source === 'MANUAL_ENTRY' ? 'Manual' : 'Excel'}
                          </span>
                        </td>

                        {/* Adjustments */}
                        <td className="px-4 py-3">
                          <button onClick={() => openAdj(row)}
                            className={`text-xs font-medium px-2 py-1 rounded-lg ${
                              row.adjustment_count > 0
                                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}>
                            {row.adjustment_count > 0 ? `${row.adjustment_count} adj` : '+ Add'}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex gap-1.5 items-center">
                              <button onClick={loadPreview} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-300 rounded">
                                Preview
                              </button>
                              <button onClick={saveEdit} disabled={saving}
                                className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50">
                                {saving ? '…' : saveMsg === 'Saved' ? '✓' : 'Save'}
                              </button>
                              <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-600 px-1">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(row)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50">
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Adjustment Drawer */}
      {adjRow && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="bg-white w-[440px] max-w-full h-full overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Adjustments</h3>
                <p className="text-xs text-gray-400 mt-0.5">{adjRow.employee_name} · {month} {year}</p>
              </div>
              <button onClick={() => setAdjRow(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Existing adjustments */}
              {adjustments.length > 0 ? (
                <div className="space-y-2">
                  {adjustments.map(adj => (
                    <div key={adj.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-700">{adj.label}</span>
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{adj.adjustment_type}</span>
                          {adj.is_taxable && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">Taxable</span>}
                        </div>
                        <div className="text-sm font-semibold text-gray-900 mt-0.5">{fmt(adj.amount)}</div>
                      </div>
                      <button onClick={() => adj.id && deleteAdj(adj.id)}
                        className="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded hover:bg-red-50">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No adjustments yet</p>
              )}

              {/* Add new */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Add Adjustment</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Type</label>
                      <select value={newAdj.adjustment_type} onChange={e => setNewAdj(p => ({ ...p, adjustment_type: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400">
                        {ADJ_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Amount (₹)</label>
                      <input type="number" value={newAdj.amount} onChange={e => setNewAdj(p => ({ ...p, amount: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Label</label>
                    <input value={newAdj.label} onChange={e => setNewAdj(p => ({ ...p, label: e.target.value }))}
                      placeholder="e.g. Diwali Bonus"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={newAdj.is_taxable} onChange={e => setNewAdj(p => ({ ...p, is_taxable: e.target.checked }))} className="rounded" />
                    Taxable under income tax
                  </label>
                  <button onClick={addAdj} disabled={adjSaving || !newAdj.label || !newAdj.amount}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                    {adjSaving ? 'Adding…' : 'Add Adjustment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Salary Modal */}
      {showAddSalaryModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Add Salary Record</h3>
              <button onClick={() => setShowAddSalaryModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Select Employee */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Employee *</label>
                <select value={addSalaryForm.employee} onChange={e => setAddSalaryForm(p => ({ ...p, employee: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">-- Choose employee --</option>
                  {rows.filter(r => !r.id).map(r => (
                    <option key={r.employee} value={r.employee}>
                      {r.employee_name} ({r.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Salary Components Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Basic</label>
                  <input type="number" value={addSalaryForm.basic || ''} onChange={e => setAddSalaryForm(p => ({ ...p, basic: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">HRA</label>
                  <input type="number" value={addSalaryForm.hra || ''} onChange={e => setAddSalaryForm(p => ({ ...p, hra: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">DA</label>
                  <input type="number" value={addSalaryForm.da || ''} onChange={e => setAddSalaryForm(p => ({ ...p, da: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Conveyance</label>
                  <input type="number" value={addSalaryForm.conveyance || ''} onChange={e => setAddSalaryForm(p => ({ ...p, conveyance: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Medical</label>
                  <input type="number" value={addSalaryForm.medical || ''} onChange={e => setAddSalaryForm(p => ({ ...p, medical: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Special Allowance</label>
                  <input type="number" value={addSalaryForm.special_allowance || ''} onChange={e => setAddSalaryForm(p => ({ ...p, special_allowance: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>

                {/* Deductions */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">PF (Employee)</label>
                  <input type="number" value={addSalaryForm.pf_employee || ''} onChange={e => setAddSalaryForm(p => ({ ...p, pf_employee: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Professional Tax</label>
                  <input type="number" value={addSalaryForm.professional_tax || ''} onChange={e => setAddSalaryForm(p => ({ ...p, professional_tax: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>

                {/* Work Days */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Work Days (default 26)</label>
                  <input type="number" value={addSalaryForm.work_days || 26} onChange={e => setAddSalaryForm(p => ({ ...p, work_days: Number(e.target.value) || 26 }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Days in Month (default 30)</label>
                  <input type="number" value={addSalaryForm.days_in_month || 30} onChange={e => setAddSalaryForm(p => ({ ...p, days_in_month: Number(e.target.value) || 30 }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button onClick={() => setShowAddSalaryModal(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={addSalaryRecord} disabled={addingSalary || !addSalaryForm.employee}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {addingSalary ? 'Creating…' : 'Create Record'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
