import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Info, Search, User, ChevronDown,
  Plus, Pencil, Trash2, X, Check, Users,
} from 'lucide-react';
import { employeeAPI, familyAPI } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeStub { id: number; employee_id: string; name: string; }

interface FamilyMember {
  id: number;
  name: string;
  relation: string;
  relation_display: string;
  dob?: string;
  age?: number;
  gender?: string;
  gender_display?: string;
  blood_group?: string;
  blood_group_display?: string;
  nationality?: string;
  profession?: string;
  remarks?: string;
  address_same_as_employee?: boolean;
  copy_address_from?: string;
}

interface Choices {
  relations:       { value: string; label: string }[];
  genders:         { value: string; label: string }[];
  blood_groups:    { value: string; label: string }[];
  address_sources: { value: string; label: string }[];
}

const EMPTY_FORM = {
  name: '', relation: '', dob: '', gender: '', blood_group: '',
  nationality: '', profession: '', remarks: '',
  address_same_as_employee: false, copy_address_from: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeList = <T,>(p: any): T[] => {
  if (Array.isArray(p)) return p;
  if (Array.isArray(p?.results)) return p.results;
  if (Array.isArray(p?.data)) return p.data;
  return [];
};

// ─── Employee selector (reused pattern) ──────────────────────────────────────

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
      <button onClick={() => setOpen((v) => !v)}
        className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 inline-flex items-center gap-2 hover:border-slate-300 min-w-[240px]">
        <User className="h-4 w-4 text-slate-400 shrink-0" />
        <span className="truncate flex-1 text-left">{selected?.name || 'Select employee…'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-50 w-72 bg-white rounded-xl border border-slate-200 shadow-xl">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee…"
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

// ─── Reusable form primitives (must be module-level to prevent remount) ───────

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div className="space-y-1">
    <label className="text-xs text-slate-500 font-medium">
      {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = 'w-full h-9 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
const selectCls = 'w-full h-9 rounded-xl border border-slate-200 px-3 text-sm bg-white outline-none focus:border-blue-400';

// ─── Family member form ───────────────────────────────────────────────────────

const FamilyMemberForm: React.FC<{
  initial: typeof EMPTY_FORM;
  choices: Choices;
  saving: boolean;
  onSave: (data: typeof EMPTY_FORM) => void;
  onCancel: () => void;
  title: string;
}> = ({ initial, choices, saving, onSave, onCancel, title }) => {
  const [form, setForm] = useState(initial);
  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <button onClick={onCancel}><X className="h-4 w-4 text-slate-400" /></button>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          <FormField label="Name" required>
            <input className={inputCls} value={form.name} placeholder="Full name"
              onChange={(e) => set('name', e.target.value)} />
          </FormField>

          <FormField label="Relation" required>
            <select className={selectCls} value={form.relation} onChange={(e) => set('relation', e.target.value)}>
              <option value="">Select relation</option>
              {choices.relations.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>

          <FormField label="Date of Birth">
            <input className={inputCls} type="date" value={form.dob}
              onChange={(e) => set('dob', e.target.value)} />
          </FormField>

          <FormField label="Gender">
            <select className={selectCls} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">Select gender</option>
              {choices.genders.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>

          <FormField label="Blood Group">
            <select className={selectCls} value={form.blood_group} onChange={(e) => set('blood_group', e.target.value)}>
              <option value="">Select blood group</option>
              {choices.blood_groups.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>

          <FormField label="Nationality">
            <input className={inputCls} value={form.nationality} placeholder="e.g. Indian"
              onChange={(e) => set('nationality', e.target.value)} />
          </FormField>

          <FormField label="Profession">
            <input className={inputCls} value={form.profession} placeholder="Occupation"
              onChange={(e) => set('profession', e.target.value)} />
          </FormField>

          <FormField label="Remarks">
            <input className={inputCls} value={form.remarks} placeholder="Optional remarks"
              onChange={(e) => set('remarks', e.target.value)} />
          </FormField>

        </div>

        {/* Address copy */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.address_same_as_employee}
              onChange={(e) => set('address_same_as_employee', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600" />
            <span className="text-sm text-slate-700">Address same as employee</span>
          </label>
          {form.address_same_as_employee && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Copy from:</span>
              <select className={selectCls + ' w-48'} value={form.copy_address_from}
                onChange={(e) => set('copy_address_from', e.target.value)}>
                <option value="">Select source</option>
                {choices.address_sources.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
          <button onClick={onCancel} className="h-9 px-4 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={() => onSave(form)} disabled={saving || !form.name.trim() || !form.relation}
            className="h-9 px-4 rounded-xl bg-blue-900 text-white text-sm disabled:opacity-60 inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />{saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const FamilyDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<EmployeeStub | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [choices, setChoices] = useState<Choices>({ relations: [], genders: [], blood_groups: [], address_sources: [] });
  const [loading, setLoading] = useState(false);
  const [formMode, setFormMode] = useState<'none' | 'add' | 'edit'>('none');
  const [editTarget, setEditTarget] = useState<FamilyMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    familyAPI.getChoices().then((r) => setChoices(r.data)).catch(() => {});
  }, []);

  const loadMembers = async (emp: EmployeeStub) => {
    setLoading(true);
    try {
      const r = await familyAPI.list(emp.id);
      setMembers(r.data?.family_members || []);
    } catch { showToast('error', 'Failed to load family details.'); }
    finally { setLoading(false); }
  };

  const handleSelectEmployee = (emp: EmployeeStub) => {
    setEmployee(emp);
    setFormMode('none');
    setEditTarget(null);
    void loadMembers(emp);
  };

  const handleCreate = async (data: typeof EMPTY_FORM) => {
    if (!employee) return;
    setSaving(true);
    try {
      await familyAPI.create(employee.id, data);
      await loadMembers(employee);
      setFormMode('none');
      showToast('success', 'Family member added.');
    } catch (e: any) {
      showToast('error', e?.response?.data?.name?.[0] || e?.response?.data?.relation?.[0] || 'Save failed.');
    } finally { setSaving(false); }
  };

  const handleUpdate = async (data: typeof EMPTY_FORM) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await familyAPI.update(editTarget.id, data);
      await loadMembers(employee!);
      setFormMode('none');
      setEditTarget(null);
      showToast('success', 'Family member updated.');
    } catch { showToast('error', 'Update failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this family member?')) return;
    try {
      await familyAPI.delete(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
      showToast('success', 'Family member deleted.');
    } catch { showToast('error', 'Delete failed.'); }
  };

  const openEdit = (m: FamilyMember) => {
    setEditTarget(m);
    setFormMode('edit');
  };

  const formInitial = editTarget
    ? {
        name: editTarget.name, relation: editTarget.relation,
        dob: editTarget.dob || '', gender: editTarget.gender || '',
        blood_group: editTarget.blood_group || '', nationality: editTarget.nationality || '',
        profession: editTarget.profession || '', remarks: editTarget.remarks || '',
        address_same_as_employee: editTarget.address_same_as_employee || false,
        copy_address_from: editTarget.copy_address_from || '',
      }
    : EMPTY_FORM;

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
        <p>Select an employee to view and manage their family member details.</p>
      </div>

      {/* Employee selector */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-xs text-slate-500 font-medium">Employee</span>
        <EmployeeSelector selected={employee} onSelect={handleSelectEmployee} />
        {employee && formMode === 'none' && (
          <button onClick={() => setFormMode('add')}
            className="ml-auto h-9 px-3 rounded-xl bg-blue-900 text-white text-xs font-medium inline-flex items-center gap-1.5 hover:bg-blue-800">
            <Plus className="h-3.5 w-3.5" /> New Family Member
          </button>
        )}
      </div>

      {/* Add / Edit form */}
      {formMode !== 'none' && (
        <FamilyMemberForm
          key={editTarget?.id ?? 'new'}
          initial={formInitial}
          choices={choices}
          saving={saving}
          title={formMode === 'add' ? 'Add Family Member' : 'Edit Family Member'}
          onSave={formMode === 'add' ? handleCreate : handleUpdate}
          onCancel={() => { setFormMode('none'); setEditTarget(null); }}
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Table header */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">
            {employee ? `Family Members — ${employee.name}` : 'Family Members'}
          </h3>
          {employee && (
            <span className="text-xs text-slate-400">{members.length} record{members.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Relation</th>
                <th className="px-4 py-2.5">DOB</th>
                <th className="px-4 py-2.5">Age</th>
                <th className="px-4 py-2.5">Blood Group</th>
                <th className="px-4 py-2.5">Gender</th>
                <th className="px-4 py-2.5">Nationality</th>
                <th className="px-4 py-2.5">Profession</th>
                <th className="px-4 py-2.5">Remarks</th>
                <th className="px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!employee ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <Users className="h-10 w-10 text-slate-200" />
                      <p className="text-sm">Select an employee to view family details</p>
                    </div>
                  </td>
                </tr>
              ) : loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    {Array.from({ length: 10 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" /></td>
                    ))}
                  </tr>
                ))
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-400 text-sm">
                    No family members found. Click "New Family Member" to add one.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{m.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{m.relation_display}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">
                      {m.dob ? new Date(m.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{m.age ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{m.blood_group || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{m.gender_display || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{m.nationality || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{m.profession || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[120px] truncate">{m.remarks || '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openEdit(m)}
                          className="h-7 w-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 flex items-center justify-center" title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(m.id)}
                          className="h-7 w-7 rounded-lg border border-rose-200 text-rose-400 hover:bg-rose-50 flex items-center justify-center" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FamilyDetailsPage;
