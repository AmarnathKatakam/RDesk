import React, { useEffect, useState } from 'react';
import { Pencil, Check, X, User, Briefcase, CreditCard, Phone } from 'lucide-react';
import api from '../services/api';

interface ProfileData {
  employee_id: string;
  name: string;
  email: string;
  personal_email: string;
  department: string | null;
  position: string | null;
  location: string | null;
  date_of_joining: string | null;
  phone: string | null;
  address: string | null;
  bank_account: string | null;
  ifsc_code: string | null;
  pan_number: string | null;
  pf_number: string | null;
  profile_photo: string | null;
}

const EDITABLE_FIELDS: { key: keyof ProfileData; label: string; type?: string }[] = [
  { key: 'personal_email', label: 'Personal Email', type: 'email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address' },
  { key: 'bank_account', label: 'Bank Account' },
  { key: 'ifsc_code', label: 'IFSC Code' },
  { key: 'pan_number', label: 'PAN Number' },
  { key: 'pf_number', label: 'PF Number' },
];

const userId = localStorage.getItem('userId');

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="py-3 border-b border-slate-50 last:border-0">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm text-slate-800">{value || '—'}</p>
    </div>
  );
}

function EditableRow({
  label, fieldKey, value, onSave,
}: {
  label: string; fieldKey: string; value?: string | null; onSave: (k: string, v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    setSaving(true);
    try { await onSave(fieldKey, draft); setEditing(false); }
    finally { setSaving(false); }
  };

  return (
    <div className="py-3 border-b border-slate-50 last:border-0 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="w-full text-sm border border-teal-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-teal-200"
          />
        ) : (
          <p className="text-sm text-slate-800">{value || '—'}</p>
        )}
      </div>
      <div className="flex items-center gap-1 mt-4 shrink-0">
        {editing ? (
          <>
            <button onClick={commit} disabled={saving}
              className="p-1 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { setEditing(false); setDraft(value || ''); }}
              className="p-1 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button onClick={() => setEditing(true)}
            className="p-1 rounded-lg text-slate-300 hover:text-teal-500 hover:bg-teal-50">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
        <span className="text-teal-500">{icon}</span>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="px-5 divide-y divide-slate-50">{children}</div>
    </div>
  );
}

const EmployeeSelfProfile: React.FC = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const params = userId ? { employee_id: userId } : {};
      const r = await api.get('/auth/employee/profile/', { params });
      setProfile(r.data?.profile || null);
    } catch (e: any) {
      showToast('error', 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (fieldKey: string, value: string) => {
    try {
      const params = userId ? { employee_id: userId } : {};
      await api.patch('/auth/employee/profile/update/', { [fieldKey]: value }, { params });
      setProfile(prev => prev ? { ...prev, [fieldKey]: value } : prev);
      showToast('success', 'Saved.');
    } catch {
      showToast('error', 'Save failed.');
      throw new Error('save failed');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="m-4 bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
        Profile not found.
      </div>
    );
  }

  const initials = profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-4 p-4 max-w-2xl mx-auto">
      {toast && (
        <div className={`fixed right-4 top-4 z-50 rounded-xl border px-4 py-3 text-sm shadow-lg ${
          toast.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-rose-200 bg-rose-50 text-rose-700'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Banner */}
      <div className="bg-white rounded-xl border border-slate-200 px-6 py-5 flex items-center gap-5">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-teal-500 to-purple-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xl font-bold">{initials}</span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">{profile.name}</h1>
          <p className="text-sm text-slate-500">{profile.employee_id} · {profile.position || 'Employee'}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {profile.department || '—'} · {profile.location || '—'}
          </p>
        </div>
      </div>

      {/* Work Info (read-only) */}
      <Section title="Work Information" icon={<Briefcase className="h-4 w-4" />}>
        <InfoRow label="Employee ID" value={profile.employee_id} />
        <InfoRow label="Department" value={profile.department} />
        <InfoRow label="Position" value={profile.position} />
        <InfoRow label="Location" value={profile.location} />
        <InfoRow label="Date of Joining" value={profile.date_of_joining} />
        <InfoRow label="Official Email" value={profile.email} />
      </Section>

      {/* Contact (editable) */}
      <Section title="Contact Details" icon={<Phone className="h-4 w-4" />}>
        <EditableRow label="Personal Email" fieldKey="personal_email" value={profile.personal_email} onSave={handleSave} />
        <EditableRow label="Phone" fieldKey="phone" value={profile.phone} onSave={handleSave} />
        <EditableRow label="Address" fieldKey="address" value={profile.address} onSave={handleSave} />
      </Section>

      {/* Financial (editable) */}
      <Section title="Financial Details" icon={<CreditCard className="h-4 w-4" />}>
        <EditableRow label="Bank Account" fieldKey="bank_account" value={profile.bank_account} onSave={handleSave} />
        <EditableRow label="IFSC Code" fieldKey="ifsc_code" value={profile.ifsc_code} onSave={handleSave} />
        <EditableRow label="PAN Number" fieldKey="pan_number" value={profile.pan_number} onSave={handleSave} />
        <EditableRow label="PF Number" fieldKey="pf_number" value={profile.pf_number} onSave={handleSave} />
      </Section>
    </div>
  );
};

export default EmployeeSelfProfile;
