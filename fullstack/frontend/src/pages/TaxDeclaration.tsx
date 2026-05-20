/**
 * TaxDeclaration.tsx — Employee Tax Declaration Form (Full Compliance)
 * Route: /employee/tax-declaration
 */
import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, Clock, XCircle, Upload, Send, Save, TrendingDown, Info } from 'lucide-react';

interface Declaration {
  id?: number;
  financial_year: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  lic_premium: number; elss_investment: number; ppf_investment: number;
  nsc_investment: number; home_loan_principal: number; tuition_fees: number; other_80c: number;
  total_80c: number;
  medical_insurance_self: number; medical_insurance_parents: number;
  parents_senior_citizen: boolean; total_80d: number;
  rent_paid_monthly: number; landlord_name: string; landlord_pan: string;
  city_type: 'METRO' | 'NON_METRO';
  education_loan_interest: number; donations_80g: number; donation_type: string;
  nps_additional: number; home_loan_interest: number;
  total_declared_deductions: number;
  admin_remarks: string; submitted_at: string | null; proof_documents: string[];
}

interface TDSPreview {
  projected_net_taxable: number;
  projected_annual_tax: number;
  projected_total_tax: number;
  monthly_tds: number;
  ytd_tds_deducted: number;
  declaration_deductions: number;
  hra_exemption: number;
  projected_80c: number;
  warnings: string[];
}

const EMPTY_FORM = {
  financial_year: '', status: 'DRAFT' as const,
  lic_premium: 0, elss_investment: 0, ppf_investment: 0, nsc_investment: 0,
  home_loan_principal: 0, tuition_fees: 0, other_80c: 0,
  medical_insurance_self: 0, medical_insurance_parents: 0, parents_senior_citizen: false,
  rent_paid_monthly: 0, landlord_name: '', landlord_pan: '', city_type: 'NON_METRO' as const,
  education_loan_interest: 0, donations_80g: 0, donation_type: '50_PCT',
  nps_additional: 0, home_loan_interest: 0,
};

const STATUS_BADGE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT:     { label: 'Draft',     color: 'bg-slate-100 text-slate-600',  icon: <Clock className="h-3.5 w-3.5" /> },
  SUBMITTED: { label: 'Submitted', color: 'bg-blue-100 text-blue-700',    icon: <Clock className="h-3.5 w-3.5" /> },
  APPROVED:  { label: 'Approved',  color: 'bg-green-100 text-green-700',  icon: <CheckCircle className="h-3.5 w-3.5" /> },
  REJECTED:  { label: 'Rejected',  color: 'bg-red-100 text-red-700',      icon: <XCircle className="h-3.5 w-3.5" /> },
};

const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const TaxDeclarationPage: React.FC = () => {
  const [decl, setDecl] = useState<Declaration | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [fy, setFy] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [tdsPreview, setTdsPreview] = useState<TDSPreview | null>(null);

  const userId = localStorage.getItem('userId') || '';

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employees/tax-declarations/?employee_id=${userId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.declaration) {
        setDecl(data.declaration);
        setForm({ ...EMPTY_FORM, ...data.declaration });
        setFy(data.declaration.financial_year);
      } else {
        setFy(data.financial_year || '');
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadTdsPreview = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/employees/tax-declarations/tds-preview/?employee_id=${userId}&financial_year=${fy}`,
        { credentials: 'include' },
      );
      const data = await res.json();
      if (data.success) setTdsPreview(data);
    } catch { /* ignore */ }
  }, [userId, fy]);

  useEffect(() => { if (fy) void loadTdsPreview(); }, [fy, loadTdsPreview]);

  const set = (field: string, value: string | number | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true); setMsg(''); setErrors([]);
    try {
      const body = { ...form, financial_year: fy, employee_id: userId };
      const method = decl ? 'PUT' : 'POST';
      const url = decl
        ? `/api/employees/tax-declarations/${fy}/update/?employee_id=${userId}`
        : `/api/employees/tax-declarations/?employee_id=${userId}`;
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setDecl(data.declaration);
        setMsg('Saved successfully.');
        void loadTdsPreview();
      } else if (data.errors) {
        setErrors(data.errors);
      } else {
        setMsg(data.message || 'Save failed.');
      }
    } catch { setMsg('Network error.'); }
    setSaving(false);
  };

  const handleSubmit = async () => {
    if (!decl) { setMsg('Save first before submitting.'); return; }
    setSaving(true); setMsg('');
    try {
      const res = await fetch(
        `/api/employees/tax-declarations/${fy}/submit/?employee_id=${userId}`,
        { method: 'POST', credentials: 'include' },
      );
      const data = await res.json();
      if (data.success) { setDecl(data.declaration); setMsg('Submitted for review.'); }
      else setMsg(data.message || 'Submit failed.');
    } catch { setMsg('Network error.'); }
    setSaving(false);
  };

  const handleUpload = async () => {
    if (!proofFile || !decl) return;
    const fd = new FormData();
    fd.append('file', proofFile);
    fd.append('employee_id', userId);
    const res = await fetch(
      `/api/employees/tax-declarations/${fy}/upload-proof/?employee_id=${userId}`,
      { method: 'POST', credentials: 'include', body: fd },
    );
    const data = await res.json();
    if (data.success) { setDecl(data.declaration); setMsg('Proof uploaded.'); setProofFile(null); }
    else setMsg(data.message || 'Upload failed.');
  };

  const editable = !decl || decl.status === 'DRAFT' || decl.status === 'REJECTED';
  const badge = STATUS_BADGE[decl?.status || 'DRAFT'];

  if (loading) return <div className="p-6 text-slate-500">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tax Declaration</h1>
          <p className="text-sm text-slate-500">FY {fy} — declare your tax-saving investments</p>
        </div>
        {decl && (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
            {badge.icon}{badge.label}
          </span>
        )}
      </div>

      {/* TDS Savings Summary */}
      {tdsPreview && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-indigo-500 font-medium mb-1 flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5" /> Projected Tax Savings
            </p>
            <p className="text-xl font-bold text-indigo-700">
              {fmt(tdsPreview.declaration_deductions + tdsPreview.hra_exemption + tdsPreview.projected_80c)}
            </p>
            <p className="text-xs text-indigo-400 mt-0.5">Total deductions applied</p>
          </div>
          <div>
            <p className="text-xs text-indigo-500 font-medium mb-1">Monthly TDS</p>
            <p className="text-xl font-bold text-indigo-700">{fmt(tdsPreview.monthly_tds)}</p>
            <p className="text-xs text-indigo-400 mt-0.5">
              Net taxable: {fmt(tdsPreview.projected_net_taxable)} · Annual tax: {fmt(tdsPreview.projected_total_tax)}
            </p>
          </div>
          {tdsPreview.warnings.length > 0 && (
            <div className="col-span-2">
              {tdsPreview.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
                  <Info className="h-3 w-3" />{w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {msg && <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700">{msg}</div>}
      {errors.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 space-y-1">
          {errors.map((e, i) => <p key={i} className="text-sm text-red-700">• {e}</p>)}
        </div>
      )}
      {decl?.status === 'REJECTED' && decl.admin_remarks && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <strong>Rejected:</strong> {decl.admin_remarks}
        </div>
      )}

      {/* Section 80C */}
      <Section title="Section 80C — Tax Saving Investments" cap="₹1,50,000">
        <Row label="LIC Premium" field="lic_premium" value={form.lic_premium} onChange={set} disabled={!editable} />
        <Row label="ELSS / Mutual Funds" field="elss_investment" value={form.elss_investment} onChange={set} disabled={!editable} />
        <Row label="PPF" field="ppf_investment" value={form.ppf_investment} onChange={set} disabled={!editable} hint="Max ₹1,50,000/year" />
        <Row label="NSC" field="nsc_investment" value={form.nsc_investment} onChange={set} disabled={!editable} />
        <Row label="Home Loan Principal" field="home_loan_principal" value={form.home_loan_principal} onChange={set} disabled={!editable} />
        <Row label="Tuition Fees" field="tuition_fees" value={form.tuition_fees} onChange={set} disabled={!editable} />
        <Row label="Other 80C" field="other_80c" value={form.other_80c} onChange={set} disabled={!editable} />
        {decl && <Total label="Total 80C (declared)" value={decl.total_80c} cap={150000} />}
      </Section>

      {/* Section 80D */}
      <Section title="Section 80D — Medical Insurance" cap="₹25,000 self + ₹25,000/₹50,000 parents">
        <Row label="Self / Family Insurance" field="medical_insurance_self" value={form.medical_insurance_self} onChange={set} disabled={!editable} hint="Max ₹25,000" />
        <Row label="Parents Insurance" field="medical_insurance_parents" value={form.medical_insurance_parents} onChange={set} disabled={!editable}
          hint={form.parents_senior_citizen ? 'Max ₹50,000 (senior citizen)' : 'Max ₹25,000'} />
        <div className="flex items-center gap-2 mt-1">
          <input
            type="checkbox"
            id="parents_senior"
            checked={form.parents_senior_citizen}
            onChange={e => set('parents_senior_citizen', e.target.checked)}
            disabled={!editable}
            className="rounded"
          />
          <label htmlFor="parents_senior" className="text-sm text-slate-600">
            Parents are senior citizens (60+) — cap increases to ₹50,000
          </label>
        </div>
        {decl && <Total label="Total 80D (after caps)" value={Number(decl.total_80d)} />}
      </Section>

      {/* HRA */}
      <Section title="HRA — House Rent Allowance">
        <Row label="Monthly Rent Paid (₹)" field="rent_paid_monthly" value={form.rent_paid_monthly} onChange={set} disabled={!editable}
          hint="Landlord PAN required if annual rent > ₹1,00,000" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Landlord Name</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={form.landlord_name} onChange={e => set('landlord_name', e.target.value)} disabled={!editable} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              Landlord PAN {form.rent_paid_monthly * 12 > 100000 && <span className="text-red-500">*</span>}
            </label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm uppercase"
              value={form.landlord_pan} onChange={e => set('landlord_pan', e.target.value.toUpperCase())}
              disabled={!editable} maxLength={10} placeholder="ABCDE1234F" />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-xs text-slate-500 mb-1">City Type</label>
          <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={form.city_type} onChange={e => set('city_type', e.target.value)} disabled={!editable}>
            <option value="METRO">Metro — 50% of Basic (Mumbai, Delhi, Kolkata, Chennai)</option>
            <option value="NON_METRO">Non-Metro — 40% of Basic</option>
          </select>
        </div>
      </Section>

      {/* Other deductions */}
      <Section title="Other Deductions">
        <Row label="Home Loan Interest — Sec 24(b)" field="home_loan_interest" value={form.home_loan_interest} onChange={set} disabled={!editable} hint="Max ₹2,00,000" />
        <Row label="Education Loan Interest — Sec 80E" field="education_loan_interest" value={form.education_loan_interest} onChange={set} disabled={!editable} hint="No cap" />
        <Row label="NPS Additional — Sec 80CCD(1B)" field="nps_additional" value={form.nps_additional} onChange={set} disabled={!editable} hint="Max ₹50,000" />
        <div className="space-y-2">
          <Row label="Donations — Sec 80G" field="donations_80g" value={form.donations_80g} onChange={set} disabled={!editable} />
          <div>
            <label className="block text-xs text-slate-500 mb-1">Donation Category</label>
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={form.donation_type} onChange={e => set('donation_type', e.target.value)} disabled={!editable}>
              <option value="100_PCT">100% deduction — no limit (PM Relief Fund, etc.)</option>
              <option value="50_PCT">50% deduction — no limit (most charities)</option>
              <option value="100_PCT_WITH_LIMIT">100% deduction — with 10% of income limit</option>
              <option value="50_PCT_WITH_LIMIT">50% deduction — with 10% of income limit</option>
            </select>
          </div>
        </div>
      </Section>

      {/* Summary */}
      {decl && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Total Declared Deductions</p>
          <p className="text-2xl font-bold text-indigo-700">{fmt(decl.total_declared_deductions)}</p>
          <p className="text-xs text-slate-500 mt-1">Applied to TDS computation after admin approval</p>
        </div>
      )}

      {/* Proof upload */}
      {decl && (
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Upload Proof Documents</p>
          {decl.proof_documents.length > 0 && (
            <ul className="text-xs text-slate-500 space-y-1">
              {decl.proof_documents.map((p, i) => <li key={i}>📎 {p.split('/').pop()}</li>)}
            </ul>
          )}
          <div className="flex items-center gap-3">
            <input type="file" onChange={e => setProofFile(e.target.files?.[0] || null)} className="text-sm" />
            <button onClick={handleUpload} disabled={!proofFile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-white text-sm disabled:opacity-40">
              <Upload className="h-4 w-4" /> Upload
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {editable && (
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
        )}
        {decl && (decl.status === 'DRAFT' || decl.status === 'REJECTED') && (
          <button onClick={handleSubmit} disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            <Send className="h-4 w-4" />
            Submit for Review
          </button>
        )}
      </div>
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; cap?: string; children: React.ReactNode }> = ({ title, cap, children }) => (
  <div className="rounded-xl border border-slate-200 overflow-hidden">
    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
      <span className="text-sm font-semibold text-slate-800">{title}</span>
      {cap && <span className="text-xs text-slate-400">Cap: {cap}</span>}
    </div>
    <div className="p-4 space-y-3">{children}</div>
  </div>
);

const Row: React.FC<{
  label: string; field: string; value: number;
  onChange: (f: string, v: number) => void; disabled: boolean; hint?: string;
}> = ({ label, field, value, onChange, disabled, hint }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex-1">
      <label className="block text-sm text-slate-700">{label}</label>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </div>
    <input type="number" min={0} value={value || ''}
      onChange={e => onChange(field, parseFloat(e.target.value) || 0)}
      disabled={disabled}
      className="w-36 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-right disabled:bg-slate-50 disabled:text-slate-400"
      placeholder="0" />
  </div>
);

const Total: React.FC<{ label: string; value: number; cap?: number }> = ({ label, value, cap }) => (
  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <span className={`text-sm font-semibold ${cap && value > cap ? 'text-amber-600' : 'text-slate-900'}`}>
      ₹{Number(value || 0).toLocaleString('en-IN')}
      {cap && value > cap && <span className="text-xs ml-1">(capped at ₹{cap.toLocaleString('en-IN')})</span>}
    </span>
  </div>
);

export default TaxDeclarationPage;
