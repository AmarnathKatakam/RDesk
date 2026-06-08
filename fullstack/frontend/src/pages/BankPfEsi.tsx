import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Pencil, X, Check, Search, Plus, Trash2,
  User, ChevronDown, Info,
} from 'lucide-react';
import { employeeAPI, financeAPI } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeStub { id: number; employee_id: string; name: string; }
interface Bank { id: number; name: string; code?: string; }
interface Branch { id: number; bank: number; branch_name: string; ifsc_code: string; city?: string; state?: string; }
interface EmployeeDoc { id: number; document_name: string; document_type: string; }

interface BankDetail {
  id?: number; bank?: number | null; branch?: number | null;
  bank_account_no?: string; ifsc_code?: string; iban?: string;
  account_type?: string; payment_type?: string;
  dd_payable_at?: string; name_as_per_bank?: string;
  bank_name?: string; branch_name?: string;
}
interface ESIDetail  { id?: number; is_covered?: boolean; esi_number?: string; }
interface PFDetail   {
  id?: number; is_covered?: boolean; uan?: string; pf_number?: string;
  pf_join_date?: string; family_pf_no?: string;
  is_existing_eps_member?: boolean; allow_epf_excess?: boolean; allow_eps_excess?: boolean;
  verification_document?: number | null; verification_document_name?: string;
}
interface LWFDetail  { id?: number; is_covered?: boolean; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeList = <T,>(p: any): T[] => {
  if (Array.isArray(p)) return p;
  if (Array.isArray(p?.results)) return p.results;
  if (Array.isArray(p?.data)) return p.data;
  return [];
};

// ─── Employee selector ────────────────────────────────────────────────────────

const EmployeeSelector: React.FC<{
  selected: EmployeeStub | null;
  onSelect: (e: EmployeeStub) => void;
}> = ({ selected, onSelect }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [list, setList] = useState<EmployeeStub[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    employeeAPI.getAll().then((r) => setList(normalizeList<EmployeeStub>(r.data))).catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? list.filter((e) => e.name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q)) : list;
  }, [list, query]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 inline-flex items-center gap-2 hover:border-slate-300 min-w-[240px]"
      >
        <User className="h-4 w-4 text-slate-400 shrink-0" />
        <span className="truncate flex-1 text-left">{selected?.name || 'Select employee…'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-50 w-72 bg-white rounded-xl border border-slate-200 shadow-xl">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employee…"
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.slice(0, 50).map((e) => (
              <button key={e.id} onClick={() => { onSelect(e); setOpen(false); setQuery(''); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 ${selected?.id === e.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}>
                <span className="font-medium truncate">{e.name}</span>
                <span className="text-xs text-slate-400 ml-auto shrink-0">{e.employee_id}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-4 text-sm text-slate-400 text-center">No results</p>}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Bank Master Dialog ───────────────────────────────────────────────────────

const BankMasterDialog: React.FC<{
  banks: Bank[];
  onClose: () => void;
  onRefresh: () => void;
}> = ({ banks, onClose, onRefresh }) => {
  const [form, setForm] = useState({ name: '', code: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try { await financeAPI.createBank(form); setForm({ name: '', code: '' }); onRefresh(); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try { await financeAPI.deleteBank(id); onRefresh(); }
    finally { setDeleting(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Manage Banks</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-slate-400" /></button>
        </div>
        <div className="flex gap-2 mb-4">
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Bank name" className="flex-1 h-9 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400" />
          <input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
            placeholder="Code (opt)" className="w-24 h-9 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400" />
          <button onClick={handleCreate} disabled={saving || !form.name.trim()}
            className="h-9 px-3 rounded-xl bg-blue-900 text-white text-xs disabled:opacity-50 inline-flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        <div className="max-h-60 overflow-y-auto space-y-1">
          {banks.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50">
              <span className="text-sm text-slate-700">{b.name}</span>
              <button onClick={() => handleDelete(b.id)} disabled={deleting === b.id}
                className="h-6 w-6 rounded-lg text-rose-400 hover:bg-rose-50 flex items-center justify-center">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {banks.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No banks yet</p>}
        </div>
      </div>
    </div>
  );
};

// ─── Branch Master Dialog ─────────────────────────────────────────────────────

const BranchMasterDialog: React.FC<{
  banks: Bank[];
  onClose: () => void;
  onRefresh: () => void;
}> = ({ banks, onClose, onRefresh }) => {
  const [selectedBank, setSelectedBank] = useState<number | ''>('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState({ branch_name: '', ifsc_code: '', city: '', state: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedBank) {
      financeAPI.getBranches(selectedBank as number).then((r) => setBranches(normalizeList<Branch>(r.data))).catch(() => {});
    } else {
      setBranches([]);
    }
  }, [selectedBank]);

  const handleCreate = async () => {
    if (!selectedBank || !form.branch_name.trim() || !form.ifsc_code.trim()) return;
    setSaving(true);
    try {
      await financeAPI.createBranch({ ...form, bank: selectedBank });
      setForm({ branch_name: '', ifsc_code: '', city: '', state: '' });
      financeAPI.getBranches(selectedBank as number).then((r) => setBranches(normalizeList<Branch>(r.data)));
      onRefresh();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    await financeAPI.deleteBranch(id);
    setBranches((prev) => prev.filter((b) => b.id !== id));
    onRefresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Manage Bank Branches</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-slate-400" /></button>
        </div>
        <select value={selectedBank} onChange={(e) => setSelectedBank(e.target.value ? Number(e.target.value) : '')}
          className="w-full h-9 rounded-xl border border-slate-200 px-3 text-sm bg-white mb-3 outline-none focus:border-blue-400">
          <option value="">Select bank</option>
          {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {selectedBank && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { key: 'branch_name', placeholder: 'Branch name *' },
                { key: 'ifsc_code',   placeholder: 'IFSC code *' },
                { key: 'city',        placeholder: 'City' },
                { key: 'state',       placeholder: 'State' },
              ].map((f) => (
                <input key={f.key} value={(form as any)[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="h-9 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400" />
              ))}
            </div>
            <button onClick={handleCreate} disabled={saving || !form.branch_name.trim() || !form.ifsc_code.trim()}
              className="h-9 px-4 rounded-xl bg-blue-900 text-white text-xs mb-3 disabled:opacity-50 inline-flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Add Branch
            </button>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {branches.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50">
                  <div>
                    <p className="text-sm text-slate-700">{b.branch_name}</p>
                    <p className="text-xs text-slate-400">{b.ifsc_code}{b.city ? ` · ${b.city}` : ''}</p>
                  </div>
                  <button onClick={() => handleDelete(b.id)} className="h-6 w-6 rounded-lg text-rose-400 hover:bg-rose-50 flex items-center justify-center">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {branches.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No branches for this bank</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Section wrapper ──────────────────────────────────────────────────────────

const Section: React.FC<{
  title: string;
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}> = ({ title, editing, saving, onEdit, onSave, onCancel, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {!editing ? (
        <button onClick={onEdit} className="h-7 px-2.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 inline-flex items-center gap-1 text-xs">
          <Pencil className="h-3 w-3" /> Edit
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <button onClick={onCancel} className="h-7 px-2.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 inline-flex items-center gap-1 text-xs">
            <X className="h-3 w-3" /> Cancel
          </button>
          <button onClick={onSave} disabled={saving} className="h-7 px-2.5 rounded-lg bg-blue-900 text-white inline-flex items-center gap-1 text-xs disabled:opacity-60">
            <Check className="h-3 w-3" /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

// ─── Field grid helpers ───────────────────────────────────────────────────────

const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-xs text-slate-400 font-medium">{label}</label>
    {children}
  </div>
);

const ReadValue: React.FC<{ value?: string | null }> = ({ value }) => (
  <p className="text-sm text-slate-800">{value || <span className="text-slate-300">—</span>}</p>
);

const TextInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; type?: string }> = ({
  value, onChange, placeholder, type = 'text',
}) => (
  <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    className="w-full h-9 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
);

const SelectInput: React.FC<{ value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }> = ({
  value, onChange, options, placeholder,
}) => (
  <select value={value} onChange={(e) => onChange(e.target.value)}
    className="w-full h-9 rounded-xl border border-slate-200 px-3 text-sm bg-white outline-none focus:border-blue-400">
    {placeholder && <option value="">{placeholder}</option>}
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const CheckboxField: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({
  label, checked, onChange, disabled,
}) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled}
      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400" />
    <span className="text-sm text-slate-700">{label}</span>
  </label>
);

// ─── Main page ────────────────────────────────────────────────────────────────

const BankPfEsiPage: React.FC = () => {
  const navigate = useNavigate();

  // Employee
  const [employee, setEmployee] = useState<EmployeeStub | null>(null);

  // Master data
  const [banks, setBanks] = useState<Bank[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Finance data
  const [bankData, setBankData] = useState<BankDetail>({});
  const [esiData,  setEsiData]  = useState<ESIDetail>({});
  const [pfData,   setPfData]   = useState<PFDetail>({});
  const [lwfData,  setLwfData]  = useState<LWFDetail>({});
  const [docs,     setDocs]     = useState<EmployeeDoc[]>([]);

  // Edit forms
  const [bankForm, setBankForm] = useState<BankDetail>({});
  const [esiForm,  setEsiForm]  = useState<ESIDetail>({});
  const [pfForm,   setPfForm]   = useState<PFDetail>({});
  const [lwfForm,  setLwfForm]  = useState<LWFDetail>({});

  // Edit states
  const [editBank, setEditBank] = useState(false);
  const [editEsi,  setEditEsi]  = useState(false);
  const [editPf,   setEditPf]   = useState(false);
  const [editLwf,  setEditLwf]  = useState(false);

  // Saving states
  const [savingBank, setSavingBank] = useState(false);
  const [savingEsi,  setSavingEsi]  = useState(false);
  const [savingPf,   setSavingPf]   = useState(false);
  const [savingLwf,  setSavingLwf]  = useState(false);

  // Dialogs
  const [showBankMaster,   setShowBankMaster]   = useState(false);
  const [showBranchMaster, setShowBranchMaster] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // Load banks on mount
  useEffect(() => { void loadBanks(); }, []);

  const loadBanks = async () => {
    const r = await financeAPI.getBanks();
    setBanks(normalizeList<Bank>(r.data));
  };

  // Load branches when bank changes in form
  useEffect(() => {
    if (bankForm.bank) {
      financeAPI.getBranches(bankForm.bank as number)
        .then((r) => setBranches(normalizeList<Branch>(r.data)))
        .catch(() => setBranches([]));
    } else {
      setBranches([]);
    }
  }, [bankForm.bank]);

  // Auto-fill IFSC when branch changes
  useEffect(() => {
    if (bankForm.branch) {
      financeAPI.getBranchIFSC(bankForm.branch as number)
        .then((r) => setBankForm((p) => ({ ...p, ifsc_code: r.data.ifsc_code })))
        .catch(() => {});
    }
  }, [bankForm.branch]);

  // Load employee finance data
  const loadFinance = useCallback(async (emp: EmployeeStub) => {
    try {
      const r = await financeAPI.getEmployeeFinance(emp.id);
      const d = r.data;
      setBankData(d.bank || {});
      setEsiData(d.esi   || {});
      setPfData(d.pf     || {});
      setLwfData(d.lwf   || {});
      setDocs(d.documents || []);
    } catch { showToast('error', 'Failed to load employee finance data.'); }
  }, []);

  const handleSelectEmployee = (emp: EmployeeStub) => {
    setEmployee(emp);
    setEditBank(false); setEditEsi(false); setEditPf(false); setEditLwf(false);
    void loadFinance(emp);
  };

  // Bank section
  const startEditBank = () => {
    setBankForm({ ...bankData });
    if (bankData.bank) {
      financeAPI.getBranches(bankData.bank as number)
        .then((r) => setBranches(normalizeList<Branch>(r.data)));
    }
    setEditBank(true);
  };
  const saveBank = async () => {
    if (!employee) return;
    setSavingBank(true);
    try {
      const r = await financeAPI.upsertBank(employee.id, { ...bankForm, employee: employee.id });
      setBankData(r.data.bank);
      setEditBank(false);
      showToast('success', 'Bank details saved.');
    } catch (e: any) {
      showToast('error', e?.response?.data?.message || 'Save failed.');
    } finally { setSavingBank(false); }
  };

  // ESI section
  const saveEsi = async () => {
    if (!employee) return;
    setSavingEsi(true);
    try {
      const r = await financeAPI.upsertESI(employee.id, { ...esiForm, employee: employee.id });
      setEsiData(r.data.esi);
      setEditEsi(false);
      showToast('success', 'ESI details saved.');
    } catch { showToast('error', 'Save failed.'); }
    finally { setSavingEsi(false); }
  };

  // PF section
  const savePf = async () => {
    if (!employee) return;
    setSavingPf(true);
    try {
      const r = await financeAPI.upsertPF(employee.id, { ...pfForm, employee: employee.id });
      setPfData(r.data.pf);
      setEditPf(false);
      showToast('success', 'PF details saved.');
    } catch { showToast('error', 'Save failed.'); }
    finally { setSavingPf(false); }
  };

  // LWF section
  const saveLwf = async () => {
    if (!employee) return;
    setSavingLwf(true);
    try {
      const r = await financeAPI.upsertLWF(employee.id, { ...lwfForm, employee: employee.id });
      setLwfData(r.data.lwf);
      setEditLwf(false);
      showToast('success', 'LWF details saved.');
    } catch { showToast('error', 'Save failed.'); }
    finally { setSavingLwf(false); }
  };

  const ACCOUNT_TYPES = [
    { value: 'SAVING', label: 'Saving' },
    { value: 'CURRENT', label: 'Current' },
    { value: 'FIXED', label: 'Fixed' },
    { value: 'SALARIED', label: 'Salaried Account' },
  ];
  const PAYMENT_TYPES = [
    { value: 'NEFT', label: 'NEFT / Bank Transfer' },
    { value: 'CASH', label: 'Cash' },
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'DD', label: 'Demand Draft' },
  ];

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed right-4 top-4 z-[60] rounded-xl border px-4 py-3 text-sm shadow-lg ${
          toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
        }`}>{toast.msg}</div>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>Select an employee to view and manage their Bank Account, ESI, PF, and Labour Welfare Fund details.</p>
      </div>

      {/* Employee selector + master actions */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-xs text-slate-500 font-medium">Employee</span>
        <EmployeeSelector selected={employee} onSelect={handleSelectEmployee} />
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowBankMaster(true)}
            className="h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" /> Manage Banks
          </button>
          <button onClick={() => setShowBranchMaster(true)}
            className="h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" /> Manage Branches
          </button>
        </div>
      </div>

      {!employee ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          Please select an employee to view their financial details.
        </div>
      ) : (
        <>
          {/* ── Bank Account ── */}
          <Section title="Bank Account" editing={editBank} saving={savingBank}
            onEdit={startEditBank} onSave={saveBank} onCancel={() => setEditBank(false)}>
            {!editBank ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[
                  ['Bank Name',           bankData.bank_name],
                  ['Bank Branch',         bankData.branch_name],
                  ['Bank Account No',     bankData.bank_account_no],
                  ['IFSC Code',           bankData.ifsc_code],
                  ['IBAN',                bankData.iban],
                  ['Account Type',        ACCOUNT_TYPES.find((a) => a.value === bankData.account_type)?.label],
                  ['Payment Type',        PAYMENT_TYPES.find((p) => p.value === bankData.payment_type)?.label],
                  ['DD Payable At',       bankData.dd_payable_at],
                  ['Name As Per Bank',    bankData.name_as_per_bank],
                ].map(([label, value]) => (
                  <FieldRow key={label as string} label={label as string}>
                    <ReadValue value={value as string} />
                  </FieldRow>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <FieldRow label="Bank Name *">
                  <SelectInput value={String(bankForm.bank || '')}
                    onChange={(v) => setBankForm((p) => ({ ...p, bank: v ? Number(v) : null, branch: null, ifsc_code: '' }))}
                    options={banks.map((b) => ({ value: String(b.id), label: b.name }))}
                    placeholder="Select bank" />
                </FieldRow>
                <FieldRow label="Bank Branch">
                  <SelectInput value={String(bankForm.branch || '')}
                    onChange={(v) => setBankForm((p) => ({ ...p, branch: v ? Number(v) : null }))}
                    options={branches.map((b) => ({ value: String(b.id), label: b.branch_name }))}
                    placeholder={bankForm.bank ? 'Select branch' : 'Select bank first'} />
                </FieldRow>
                <FieldRow label="Bank Account No">
                  <TextInput value={bankForm.bank_account_no || ''} onChange={(v) => setBankForm((p) => ({ ...p, bank_account_no: v }))} />
                </FieldRow>
                <FieldRow label="IFSC Code">
                  <TextInput value={bankForm.ifsc_code || ''} onChange={(v) => setBankForm((p) => ({ ...p, ifsc_code: v }))} placeholder="Auto-filled from branch" />
                </FieldRow>
                <FieldRow label="IBAN">
                  <TextInput value={bankForm.iban || ''} onChange={(v) => setBankForm((p) => ({ ...p, iban: v }))} />
                </FieldRow>
                <FieldRow label="Account Type">
                  <SelectInput value={bankForm.account_type || ''} onChange={(v) => setBankForm((p) => ({ ...p, account_type: v }))}
                    options={ACCOUNT_TYPES} placeholder="Select type" />
                </FieldRow>
                <FieldRow label="Payment Type">
                  <SelectInput value={bankForm.payment_type || ''} onChange={(v) => setBankForm((p) => ({ ...p, payment_type: v }))}
                    options={PAYMENT_TYPES} placeholder="Select type" />
                </FieldRow>
                <FieldRow label="DD Payable At">
                  <TextInput value={bankForm.dd_payable_at || ''} onChange={(v) => setBankForm((p) => ({ ...p, dd_payable_at: v }))} />
                </FieldRow>
                <FieldRow label="Name As Per Bank Records">
                  <TextInput value={bankForm.name_as_per_bank || ''} onChange={(v) => setBankForm((p) => ({ ...p, name_as_per_bank: v }))} />
                </FieldRow>
              </div>
            )}
          </Section>

          {/* ── ESI Account ── */}
          <Section title="ESI Account" editing={editEsi} saving={savingEsi}
            onEdit={() => { setEsiForm({ ...esiData }); setEditEsi(true); }}
            onSave={saveEsi} onCancel={() => setEditEsi(false)}>
            {!editEsi ? (
              <div className="space-y-3">
                <CheckboxField label="Employee is covered under ESI" checked={!!esiData.is_covered} onChange={() => {}} disabled />
                {esiData.is_covered && (
                  <FieldRow label="ESI Number"><ReadValue value={esiData.esi_number} /></FieldRow>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <CheckboxField label="Employee is covered under ESI" checked={!!esiForm.is_covered}
                  onChange={(v) => setEsiForm((p) => ({ ...p, is_covered: v }))} />
                {esiForm.is_covered && (
                  <FieldRow label="ESI Number">
                    <TextInput value={esiForm.esi_number || ''} onChange={(v) => setEsiForm((p) => ({ ...p, esi_number: v }))} placeholder="ESI number" />
                  </FieldRow>
                )}
              </div>
            )}
          </Section>

          {/* ── PF Account ── */}
          <Section title="PF Account" editing={editPf} saving={savingPf}
            onEdit={() => { setPfForm({ ...pfData }); setEditPf(true); }}
            onSave={savePf} onCancel={() => setEditPf(false)}>
            {!editPf ? (
              <div className="space-y-3">
                <CheckboxField label="Employee is covered under PF" checked={!!pfData.is_covered} onChange={() => {}} disabled />
                {pfData.is_covered && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                    {[
                      ['UAN', pfData.uan],
                      ['PF Number', pfData.pf_number],
                      ['PF Join Date', pfData.pf_join_date],
                      ['Family PF No', pfData.family_pf_no],
                      ['Verification Document', pfData.verification_document_name],
                    ].map(([label, value]) => (
                      <FieldRow key={label as string} label={label as string}>
                        <ReadValue value={value as string} />
                      </FieldRow>
                    ))}
                    <div className="col-span-full flex flex-wrap gap-4 mt-1">
                      <CheckboxField label="Is existing member of EPS" checked={!!pfData.is_existing_eps_member} onChange={() => {}} disabled />
                      <CheckboxField label="Allow EPF excess contribution" checked={!!pfData.allow_epf_excess} onChange={() => {}} disabled />
                      <CheckboxField label="Allow EPS excess contribution" checked={!!pfData.allow_eps_excess} onChange={() => {}} disabled />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <CheckboxField label="Employee is covered under PF" checked={!!pfForm.is_covered}
                  onChange={(v) => setPfForm((p) => ({ ...p, is_covered: v }))} />
                {pfForm.is_covered && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <FieldRow label="UAN">
                        <TextInput value={pfForm.uan || ''} onChange={(v) => setPfForm((p) => ({ ...p, uan: v }))} />
                      </FieldRow>
                      <FieldRow label="PF Number">
                        <TextInput value={pfForm.pf_number || ''} onChange={(v) => setPfForm((p) => ({ ...p, pf_number: v }))} />
                      </FieldRow>
                      <FieldRow label="PF Join Date">
                        <TextInput type="date" value={pfForm.pf_join_date || ''} onChange={(v) => setPfForm((p) => ({ ...p, pf_join_date: v }))} />
                      </FieldRow>
                      <FieldRow label="Family PF No">
                        <TextInput value={pfForm.family_pf_no || ''} onChange={(v) => setPfForm((p) => ({ ...p, family_pf_no: v }))} />
                      </FieldRow>
                      <FieldRow label="Verification Document (PF Proof)">
                        <SelectInput
                          value={String(pfForm.verification_document || '')}
                          onChange={(v) => setPfForm((p) => ({ ...p, verification_document: v ? Number(v) : null }))}
                          options={docs.map((d) => ({ value: String(d.id), label: d.document_name }))}
                          placeholder="Select employee document" />
                      </FieldRow>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <CheckboxField label="Is existing member of EPS" checked={!!pfForm.is_existing_eps_member}
                        onChange={(v) => setPfForm((p) => ({ ...p, is_existing_eps_member: v }))} />
                      <CheckboxField label="Allow EPF excess contribution" checked={!!pfForm.allow_epf_excess}
                        onChange={(v) => setPfForm((p) => ({ ...p, allow_epf_excess: v }))} />
                      <CheckboxField label="Allow EPS excess contribution" checked={!!pfForm.allow_eps_excess}
                        onChange={(v) => setPfForm((p) => ({ ...p, allow_eps_excess: v }))} />
                    </div>
                  </>
                )}
              </div>
            )}
          </Section>

          {/* ── Labour Welfare Fund ── */}
          <Section title="Labour Welfare Fund" editing={editLwf} saving={savingLwf}
            onEdit={() => { setLwfForm({ ...lwfData }); setEditLwf(true); }}
            onSave={saveLwf} onCancel={() => setEditLwf(false)}>
            {!editLwf ? (
              <CheckboxField label="Employee is covered under Labour Welfare Fund" checked={!!lwfData.is_covered} onChange={() => {}} disabled />
            ) : (
              <CheckboxField label="Employee is covered under Labour Welfare Fund" checked={!!lwfForm.is_covered}
                onChange={(v) => setLwfForm((p) => ({ ...p, is_covered: v }))} />
            )}
          </Section>
        </>
      )}

      {/* Dialogs */}
      {showBankMaster && (
        <BankMasterDialog banks={banks} onClose={() => setShowBankMaster(false)} onRefresh={loadBanks} />
      )}
      {showBranchMaster && (
        <BranchMasterDialog banks={banks} onClose={() => setShowBranchMaster(false)} onRefresh={loadBanks} />
      )}
    </div>
  );
};

export default BankPfEsiPage;
