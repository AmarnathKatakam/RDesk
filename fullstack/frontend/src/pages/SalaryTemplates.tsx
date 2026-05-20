import { useEffect, useState } from 'react';
import { payrollConfigAPI } from '../services/api';
import PayrollNav from '../components/PayrollNav';

interface SalaryComponent {
  id: number;
  code: string;
  name: string;
  component_type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION';
  calculation_type: string;
  default_value: string;
  is_statutory: boolean;
  is_active: boolean;
  display_order: number;
}

interface TemplateComponent {
  id: number;
  component: number;  // FK id
  component_code: string;
  component_name: string;
  component_type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION';
  calculation_type_override: string | null;
  value: string;
  display_order: number;
  effective_calculation_type: string;
  effective_value: string;
  is_statutory?: boolean;
}

interface SalaryTemplate {
  id: number;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  components: TemplateComponent[];
}

const CALC_TYPE_LABELS: Record<string, string> = {
  FIXED_AMOUNT: 'Fixed ₹',
  PERCENTAGE_OF_BASIC: '% of Basic',
  PERCENTAGE_OF_GROSS: '% of Gross',
  PERCENTAGE_OF_CTC: '% of CTC',
  STATUTORY: 'Statutory',
  FORMULA: 'Formula',
};

const TYPE_COLORS: Record<string, string> = {
  EARNING: 'bg-green-100 text-green-800',
  DEDUCTION: 'bg-red-100 text-red-800',
  EMPLOYER_CONTRIBUTION: 'bg-blue-100 text-blue-800',
};

export default function SalaryTemplates() {
  const [templates, setTemplates] = useState<SalaryTemplate[]>([]);
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [selected, setSelected] = useState<SalaryTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Preview state
  const [previewCTC, setPreviewCTC] = useState('');
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // New template form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ code: '', name: '', description: '' });
  const [saving, setSaving] = useState(false);

  // Add component to template
  const [showAddComp, setShowAddComp] = useState(false);
  const [addCompData, setAddCompData] = useState({ component: '', value: '', calculation_type_override: '' });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [tRes, cRes] = await Promise.all([
        payrollConfigAPI.getTemplates(),
        payrollConfigAPI.getComponents({ active_only: true }),
      ]);
      setTemplates(tRes.data);
      setComponents(cRes.data);
      if (tRes.data.length > 0 && !selected) setSelected(tRes.data[0]);
    } catch {
      setError('Failed to load salary templates.');
    } finally {
      setLoading(false);
    }
  }

  async function createTemplate() {
    if (!newTemplate.code || !newTemplate.name) return;
    setSaving(true);
    try {
      await payrollConfigAPI.createTemplate(newTemplate);
      setNewTemplate({ code: '', name: '', description: '' });
      setShowNewForm(false);
      await loadAll();
    } catch (e: any) {
      setError(e.response?.data?.code?.[0] || 'Failed to create template.');
    } finally {
      setSaving(false);
    }
  }

  async function addComponent() {
    if (!selected || !addCompData.component) return;
    setSaving(true);
    try {
      await payrollConfigAPI.addTemplateComponent(selected.id, {
        component: parseInt(addCompData.component),
        value: addCompData.value || '0',
        calculation_type_override: addCompData.calculation_type_override || null,
      });
      setAddCompData({ component: '', value: '', calculation_type_override: '' });
      setShowAddComp(false);
      await loadAll();
    } catch (e: any) {
      setError(e.response?.data?.non_field_errors?.[0] || 'Failed to add component.');
    } finally {
      setSaving(false);
    }
  }

  async function removeComponent(compId: number, isStatutory: boolean) {
    if (!selected) return;
    if (isStatutory) { setError('Statutory components cannot be removed.'); return; }
    if (!confirm('Remove this component from the template?')) return;
    try {
      await payrollConfigAPI.removeTemplateComponent(selected.id, compId);
      await loadAll();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to remove component.');
    }
  }

  async function runPreview() {
    if (!selected || !previewCTC) return;
    setPreviewLoading(true);
    setPreviewResult(null);
    try {
      const annualCTC = parseFloat(previewCTC);
      const monthlyCTC = annualCTC / 12;
      const lines: any[] = [];
      let basic = 0;
      let gross = 0;

      // Pass 1: FIXED + % of CTC earnings
      for (const tc of selected.components) {
        if (tc.component_type !== 'EARNING') continue;
        const ct = tc.effective_calculation_type;
        const val = parseFloat(tc.effective_value);
        if (ct === 'FIXED_AMOUNT') lines.push({ ...tc, computed: val });
        else if (ct === 'PERCENTAGE_OF_CTC') lines.push({ ...tc, computed: (monthlyCTC * val) / 100 });
      }
      basic = lines.find(l => l.component_code === 'BASIC')?.computed || 0;

      // Pass 2: % of Basic
      for (const tc of selected.components) {
        if (tc.component_type !== 'EARNING' || lines.find(l => l.id === tc.id)) continue;
        const ct = tc.effective_calculation_type;
        const val = parseFloat(tc.effective_value);
        if (ct === 'PERCENTAGE_OF_BASIC') lines.push({ ...tc, computed: (basic * val) / 100 });
      }
      gross = lines.reduce((s, l) => s + (l.computed || 0), 0);

      // Pass 3: % of Gross
      for (const tc of selected.components) {
        if (tc.component_type !== 'EARNING' || lines.find(l => l.id === tc.id)) continue;
        const ct = tc.effective_calculation_type;
        const val = parseFloat(tc.effective_value);
        if (ct === 'PERCENTAGE_OF_GROSS') lines.push({ ...tc, computed: (gross * val) / 100 });
      }
      gross = lines.reduce((s, l) => s + (l.computed || 0), 0);

      const statRes = await payrollConfigAPI.statutoryPreview({
        pf_wage: basic,
        gross_wage: gross,
        state: 'KA',
        payroll_date: new Date().toISOString().split('T')[0],
        month_number: new Date().getMonth() + 1,
      });

      setPreviewResult({ lines, gross, statutory: statRes.data.statutory, monthlyCTC });
    } catch {
      setError('Preview failed.');
    } finally {
      setPreviewLoading(false);
    }
  }

  const selectedTemplate = selected ? templates.find(t => t.id === selected.id) || selected : null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-500 mt-1">Configure salary structures for different employee grades</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          + New Template
        </button>
      </div>

      {/* Payroll sub-nav */}
      <PayrollNav />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {showNewForm && (
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">New Salary Template</h3>
          <div className="grid grid-cols-3 gap-3">
            <input
              placeholder="Code (e.g. SWE_L1)"
              value={newTemplate.code}
              onChange={e => setNewTemplate(p => ({ ...p, code: e.target.value.toUpperCase() }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="Name (e.g. Software Engineer L1)"
              value={newTemplate.name}
              onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm col-span-2"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={createTemplate} disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => setShowNewForm(false)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading templates...</div>
      ) : (
        <div className="flex gap-6">
          {/* Template list */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {templates.length === 0 ? (
                <div className="p-4 text-sm text-gray-400 text-center">No templates yet</div>
              ) : (
                templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setSelected(t); setPreviewResult(null); }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${selected?.id === t.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}
                  >
                    <div className="font-medium text-sm text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{t.code} · {t.components.length} components</div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Template detail */}
          {selectedTemplate && (
            <div className="flex-1 space-y-4">
              {/* Header */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedTemplate.name}</h2>
                    <p className="text-sm text-gray-500">{selectedTemplate.code}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${selectedTemplate.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {selectedTemplate.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Components table */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800 text-sm">Components</h3>
                  <button
                    onClick={() => setShowAddComp(true)}
                    className="text-indigo-600 text-sm font-medium hover:text-indigo-800"
                  >
                    + Add Component
                  </button>
                </div>

                {showAddComp && (
                  <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-gray-600 mb-1 block">Component</label>
                        <select
                          value={addCompData.component}
                          onChange={e => setAddCompData(p => ({ ...p, component: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">Select component...</option>
                          {components
                            .filter(c => !selectedTemplate.components.find(tc => tc.component === c.id))
                            .map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                            ))}
                        </select>
                      </div>
                      <div className="w-40">
                        <label className="text-xs text-gray-600 mb-1 block">Calc Type Override</label>
                        <select
                          value={addCompData.calculation_type_override}
                          onChange={e => setAddCompData(p => ({ ...p, calculation_type_override: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">Use default</option>
                          {Object.entries(CALC_TYPE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-28">
                        <label className="text-xs text-gray-600 mb-1 block">Value</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={addCompData.value}
                          onChange={e => setAddCompData(p => ({ ...p, value: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <button onClick={addComponent} disabled={saving} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                        Add
                      </button>
                      <button onClick={() => setShowAddComp(false)} className="text-gray-400 hover:text-gray-600 px-2 py-2 text-sm">
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Component</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Type</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Calculation</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Value</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedTemplate.components.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-6 text-gray-400 text-sm">No components added yet</td></tr>
                    ) : (
                      selectedTemplate.components.map(tc => (
                        <tr key={tc.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-gray-900">{tc.component_name}</div>
                            <div className="text-xs text-gray-400">{tc.component_code}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[tc.component_type]}`}>
                              {tc.component_type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">
                            {CALC_TYPE_LABELS[tc.effective_calculation_type] || tc.effective_calculation_type}
                            {tc.calculation_type_override && (
                              <span className="ml-1 text-indigo-500">(override)</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-800">
                            {tc.is_statutory ? (
                              <span className="text-gray-400 text-xs">auto</span>
                            ) : tc.effective_calculation_type === 'FIXED_AMOUNT' ? (
                              `₹${parseFloat(tc.effective_value).toLocaleString('en-IN')}`
                            ) : (
                              `${parseFloat(tc.effective_value)}%`
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {!tc.is_statutory && (
                              <button
                                onClick={() => removeComponent(tc.id, tc.is_statutory || false)}
                                className="text-red-400 hover:text-red-600 text-xs"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* CTC Preview */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 text-sm mb-3">Calculation Preview</h3>
                <div className="flex gap-3 items-end">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Annual CTC (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 600000"
                      value={previewCTC}
                      onChange={e => setPreviewCTC(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48"
                    />
                  </div>
                  <button
                    onClick={runPreview}
                    disabled={previewLoading || !previewCTC}
                    className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
                  >
                    {previewLoading ? 'Calculating...' : 'Preview'}
                  </button>
                </div>

                {previewResult && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-2">EARNINGS</div>
                      <div className="space-y-1">
                        {previewResult.lines.map((l: any, i: number) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-700">{l.component_name}</span>
                            <span className="font-mono text-gray-900">₹{Math.round(l.computed).toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-1 mt-1">
                          <span>Gross Earnings</span>
                          <span className="font-mono text-green-700">₹{Math.round(previewResult.gross).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-2">STATUTORY DEDUCTIONS (KA)</div>
                      <div className="space-y-1">
                        {[
                          { label: 'PF Employee', key: 'pf_employee' },
                          { label: 'ESI Employee', key: 'esi_employee' },
                          { label: 'Professional Tax', key: 'pt_amount' },
                          { label: 'LWF Employee', key: 'lwf_employee' },
                        ].map(({ label, key }) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-gray-700">{label}</span>
                            <span className="font-mono text-gray-900">₹{parseFloat(previewResult.statutory[key] || '0').toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-1 mt-1">
                          <span>Est. Net Pay</span>
                          <span className="font-mono text-indigo-700">
                            ₹{Math.round(
                              previewResult.gross -
                              parseFloat(previewResult.statutory.pf_employee || '0') -
                              parseFloat(previewResult.statutory.esi_employee || '0') -
                              parseFloat(previewResult.statutory.pt_amount || '0') -
                              parseFloat(previewResult.statutory.lwf_employee || '0')
                            ).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
