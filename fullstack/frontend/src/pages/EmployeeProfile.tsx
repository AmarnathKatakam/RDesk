import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Pencil, X, Check, Search, User, ChevronDown } from 'lucide-react';
import { employeeAPI, departmentAPI, attendanceAPI } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: number;
  employee_id: string;
  name: string;
  email?: string;
  personal_email?: string;
  position?: string;
  location?: string;
  doj?: string;
  dob?: string;
  pan?: string;
  pf_number?: string;
  bank_account?: string;
  bank_ifsc?: string;
  pay_mode?: string;
  lpa?: string;
  health_card_no?: string;
  is_active: boolean;
  account_activated?: boolean;
  onboarding_completed?: boolean;
  department?: { id: number; department_name: string } | null;
  shift?: { id: number; name: string } | null;
  shift_name?: string;
  department_id?: number;
  shift_id?: number;
}

interface EmployeeStub { id: number; employee_id: string; name: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeList = <T,>(p: any): T[] => {
  if (Array.isArray(p)) return p;
  if (Array.isArray(p?.results)) return p.results;
  if (Array.isArray(p?.data)) return p.data;
  return [];
};

const fmt = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const val = (v?: string | null) => v || '-';

// ─── Employee search selector ─────────────────────────────────────────────────

const EmployeeSelector: React.FC<{
  current: Employee | null;
  onSelect: (id: number) => void;
}> = ({ current, onSelect }) => {
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
        className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 inline-flex items-center gap-2 hover:border-slate-300 min-w-[220px]"
      >
        <User className="h-4 w-4 text-slate-400 shrink-0" />
        <span className="truncate flex-1 text-left">{current?.name || 'Select employee'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-50 w-72 bg-white rounded-xl border border-slate-200 shadow-xl">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employee…"
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.slice(0, 50).map((e) => (
              <button
                key={e.id}
                onClick={() => { onSelect(e.id); setOpen(false); setQuery(''); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 ${current?.id === e.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
              >
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

// ─── Profile section card ─────────────────────────────────────────────────────

interface FieldDef { label: string; key: string; type?: 'date' | 'select' | 'text'; options?: string[]; }

const ProfileSection: React.FC<{
  title: string;
  fields: FieldDef[];
  data: Record<string, any>;
  onSave: (updates: Record<string, any>) => Promise<void>;
  departments?: { id: number; department_name: string }[];
  shifts?: { id: number; name: string }[];
}> = ({ title, fields, data, onSave, departments = [], shifts = [] }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    const initial: Record<string, any> = {};
    fields.forEach((f) => { initial[f.key] = data[f.key] ?? ''; });
    setForm(initial);
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(form);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (f: FieldDef) => {
    if (!editing) {
      let display = data[f.key];
      if (f.type === 'date' && display) display = fmt(display);
      if (f.key === 'department') display = data.department?.department_name;
      if (f.key === 'shift') display = data.shift?.name || data.shift_name;
      if (f.key === 'is_active') display = data.is_active ? 'Active' : 'Inactive';
      return <span className="text-sm text-slate-800">{display || <span className="text-slate-300">—</span>}</span>;
    }

    if (f.key === 'department_id') {
      return (
        <select value={form[f.key] || ''} onChange={(e) => setForm((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
          className="h-8 rounded-lg border border-slate-200 px-2 text-sm bg-white w-full max-w-xs">
          <option value="">Select</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}
        </select>
      );
    }
    if (f.key === 'shift_id') {
      return (
        <select value={form[f.key] || ''} onChange={(e) => setForm((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
          className="h-8 rounded-lg border border-slate-200 px-2 text-sm bg-white w-full max-w-xs">
          <option value="">Select</option>
          {shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      );
    }
    if (f.options) {
      return (
        <select value={form[f.key] || ''} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
          className="h-8 rounded-lg border border-slate-200 px-2 text-sm bg-white w-full max-w-xs">
          <option value="">Select</option>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input
        type={f.type === 'date' ? 'date' : 'text'}
        value={form[f.key] || ''}
        onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
        className="h-8 rounded-lg border border-slate-200 px-2 text-sm w-full max-w-xs outline-none focus:border-blue-400"
      />
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {!editing ? (
          <button onClick={startEdit} className="h-7 px-2.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 inline-flex items-center gap-1 text-xs">
            <Pencil className="h-3 w-3" /> Edit
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button onClick={() => setEditing(false)} className="h-7 px-2.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 inline-flex items-center gap-1 text-xs">
              <X className="h-3 w-3" /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="h-7 px-2.5 rounded-lg bg-blue-900 text-white inline-flex items-center gap-1 text-xs disabled:opacity-60">
              <Check className="h-3 w-3" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y divide-slate-50 sm:divide-y-0">
        {fields.map((f) => (
          <div key={f.key} className="px-5 py-3 border-b border-slate-50">
            <p className="text-xs text-slate-400 mb-1">{f.label}</p>
            {renderField(f)}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const EmployeeProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [departments, setDepartments] = useState<{ id: number; department_name: string }[]>([]);
  const [shifts, setShifts] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    departmentAPI.getAll().then((r) => setDepartments(normalizeList(r.data))).catch(() => {});
    attendanceAPI.getShifts().then((r) => setShifts(Array.isArray(r.data?.shifts) ? r.data.shifts : [])).catch(() => {});
  }, []);

  useEffect(() => { if (id) void loadEmployee(id); }, [id]);

  const loadEmployee = async (empId: string) => {
    try {
      setLoading(true);
      const r = await employeeAPI.getById(empId);
      setEmployee(r.data?.employee || r.data);
    } catch { setEmployee(null); }
    finally { setLoading(false); }
  };

  const handleSelect = (newId: number) => navigate(`/admin/employees/${newId}/profile`);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (updates: Record<string, any>) => {
    if (!employee) return;
    try {
      const r = await employeeAPI.update(String(employee.id), updates);
      setEmployee(r.data?.employee || r.data);
      showToast('success', 'Saved successfully.');
    } catch (e: any) {
      showToast('error', e?.response?.data?.message || 'Save failed.');
      throw e;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-4 bg-slate-100 rounded w-48 animate-pulse" />
        <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
        Employee not found.
      </div>
    );
  }

  const initials = employee.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  // Section field definitions
  const employeeInfoFields: FieldDef[] = [
    { label: 'Employee ID',  key: 'employee_id' },
    { label: 'Full Name',    key: 'name' },
    { label: 'Position',     key: 'position' },
    { label: 'Official Email', key: 'email' },
    { label: 'Personal Email', key: 'personal_email' },
    { label: 'Pay Mode',     key: 'pay_mode', options: ['NEFT', 'Bank Transfer', 'Cheque', 'Cash'] },
    { label: 'LPA',          key: 'lpa' },
    { label: 'Status',       key: 'is_active', options: ['true', 'false'] },
  ];

  const personalInfoFields: FieldDef[] = [
    { label: 'Date of Birth',  key: 'dob',  type: 'date' },
    { label: 'Health Card No', key: 'health_card_no' },
    { label: 'PAN',            key: 'pan' },
    { label: 'PF Number',      key: 'pf_number' },
  ];

  const joiningFields: FieldDef[] = [
    { label: 'Date of Joining', key: 'doj', type: 'date' },
    { label: 'Location',        key: 'location' },
    { label: 'Department',      key: 'department_id', type: 'select' },
    { label: 'Shift',           key: 'shift_id',      type: 'select' },
  ];

  const bankFields: FieldDef[] = [
    { label: 'Bank Account', key: 'bank_account' },
    { label: 'IFSC Code',    key: 'bank_ifsc' },
  ];

  // Merge department_id / shift_id into employee data for editing
  const empData = {
    ...employee,
    department_id: employee.department?.id,
    shift_id: employee.shift?.id,
  };

  return (
    <div className="space-y-4">

      {/* Toast */}
      {toast && (
        <div className={`fixed right-4 top-4 z-[60] rounded-xl border px-4 py-3 text-sm shadow-lg ${
          toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Top selector bar */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-500 font-medium">Employee</span>
        <EmployeeSelector current={employee} onSelect={handleSelect} />
      </div>

      {/* Profile summary banner */}
      <div className="bg-white rounded-xl border border-slate-200 px-6 py-5 flex items-center gap-5">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-teal-500 to-purple-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xl font-bold">{initials}</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-900">{employee.name}</h1>
          <p className="text-sm text-slate-500">{employee.employee_id} · {employee.position || 'Employee'}</p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-slate-400">{employee.department?.department_name || '—'}</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">{employee.location || '—'}</span>
            <span className="text-xs text-slate-300">·</span>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              employee.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}>
              {employee.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Sections */}
      <ProfileSection
        title="Employee Information"
        fields={employeeInfoFields}
        data={empData}
        onSave={handleSave}
        departments={departments}
        shifts={shifts}
      />

      <ProfileSection
        title="Personal Information"
        fields={personalInfoFields}
        data={empData}
        onSave={handleSave}
      />

      <ProfileSection
        title="Joining & Position Details"
        fields={joiningFields}
        data={empData}
        onSave={handleSave}
        departments={departments}
        shifts={shifts}
      />

      <ProfileSection
        title="Bank & Financial Details"
        fields={bankFields}
        data={empData}
        onSave={handleSave}
      />

      {/* Read-only account status section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Account Status</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
          {[
            ['Account Activated', employee.account_activated ? 'Yes' : 'No'],
            ['Onboarding Completed', employee.onboarding_completed ? 'Yes' : 'No'],
            ['Official Email', val(employee.email)],
          ].map(([label, value]) => (
            <div key={label} className="px-5 py-3 border-b border-slate-50">
              <p className="text-xs text-slate-400 mb-1">{label}</p>
              <p className="text-sm text-slate-800">{value}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default EmployeeProfilePage;
