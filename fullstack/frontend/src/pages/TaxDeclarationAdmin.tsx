/**
 * TaxDeclarationAdmin.tsx — Admin Tax Declaration Review
 * Route: /admin/payroll/tax-declarations
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Decl {
  id: number;
  employee_id: string;
  employee_name: string;
  financial_year: string;
  status: string;
  total_80c: number;
  total_80d: number;
  total_declared_deductions: number;
  admin_remarks: string;
  submitted_at: string | null;
  proof_documents: string[];
  rent_paid_monthly: number;
  home_loan_interest: number;
  nps_additional: number;
  education_loan_interest: number;
  donations_80g: number;
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT:     'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED:  'bg-green-100 text-green-700',
  REJECTED:  'bg-red-100 text-red-700',
};

const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const TaxDeclarationAdminPage: React.FC = () => {
  const [decls, setDecls] = useState<Decl[]>([]);
  const [fy, setFy] = useState('2025-26');
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkRemarks, setBulkRemarks] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { void load(); }, [fy, statusFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/employees/tax-declarations/admin/?financial_year=${fy}&status=${statusFilter}`,
        { credentials: 'include' },
      );
      const data = await res.json();
      setDecls(data.declarations || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const approve = async (id: number) => {
    const res = await fetch(`/api/employees/tax-declarations/admin/${id}/approve/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ remarks: remarks[id] || '' }),
    });
    const data = await res.json();
    if (data.success) { setMsg(`Approved: ${data.declaration.employee_name}`); void load(); }
    else setMsg(data.message || 'Failed');
  };

  const reject = async (id: number) => {
    const r = (remarks[id] || '').trim();
    if (!r) { setMsg('Enter rejection remarks first.'); return; }
    const res = await fetch(`/api/employees/tax-declarations/admin/${id}/reject/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ remarks: r }),
    });
    const data = await res.json();
    if (data.success) { setMsg(`Rejected: ${data.declaration.employee_name}`); void load(); }
    else setMsg(data.message || 'Failed');
  };

  const bulkApprove = async () => {
    if (selected.size === 0) { setMsg('Select at least one declaration.'); return; }
    const res = await fetch('/api/employees/tax-declarations/admin/bulk-approve/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ids: Array.from(selected), remarks: bulkRemarks }),
    });
    const data = await res.json();
    if (data.success) {
      setMsg(`Bulk approved ${data.approved_count} declaration(s).`);
      setSelected(new Set());
      void load();
    } else setMsg(data.message || 'Failed');
  };

  const toggleSelect = (id: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const selectAll = () =>
    setSelected(new Set(decls.filter(d => d.status === 'SUBMITTED').map(d => d.id)));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tax Declarations</h1>
        <p className="text-sm text-slate-500">Review and approve employee investment declarations</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={fy}
          onChange={e => setFy(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        >
          {['2023-24','2024-25','2025-26','2026-27'].map(f => (
            <option key={f} value={f}>FY {f}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {msg && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700">{msg}</div>
      )}

      {/* Bulk approve bar */}
      {statusFilter === 'SUBMITTED' && decls.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <button onClick={selectAll} className="text-xs text-indigo-600 hover:underline">Select All</button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-slate-400 hover:underline">Clear</button>
          <span className="text-xs text-slate-500">{selected.size} selected</span>
          <input
            className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
            placeholder="Bulk approval remarks (optional)"
            value={bulkRemarks}
            onChange={e => setBulkRemarks(e.target.value)}
          />
          <button
            onClick={bulkApprove}
            disabled={selected.size === 0}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm disabled:opacity-40"
          >
            <CheckCircle className="h-4 w-4" /> Bulk Approve ({selected.size})
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : decls.length === 0 ? (
        <p className="text-slate-400 text-sm">No declarations found.</p>
      ) : (
        <div className="space-y-3">
          {decls.map(d => (
            <div key={d.id} className="rounded-xl border border-slate-200 overflow-hidden">
              {/* Row header */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50"
                onClick={() => setExpanded(expanded === d.id ? null : d.id)}
              >
                <div className="flex items-center gap-4">
                  {d.status === 'SUBMITTED' && (
                    <input type="checkbox" checked={selected.has(d.id)}
                      onChange={() => toggleSelect(d.id)}
                      onClick={e => e.stopPropagation()}
                      className="rounded" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-900">{d.employee_name}</p>
                    <p className="text-xs text-slate-400">{d.employee_id} · FY {d.financial_year}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[d.status]}`}>
                    {d.status}
                  </span>
                </div>
                <div className="flex items-center gap-6 text-sm text-slate-600">
                  <span>80C: {fmt(d.total_80c)}</span>
                  <span>80D: {fmt(d.total_80d)}</span>
                  <span className="font-semibold">Total: {fmt(d.total_declared_deductions)}</span>
                  {expanded === d.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === d.id && (
                <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <Detail label="Home Loan Interest" value={fmt(d.home_loan_interest)} />
                    <Detail label="NPS Additional" value={fmt(d.nps_additional)} />
                    <Detail label="Education Loan" value={fmt(d.education_loan_interest)} />
                    <Detail label="Donations 80G" value={fmt(d.donations_80g)} />
                    <Detail label="Rent / Month" value={fmt(d.rent_paid_monthly)} />
                    <Detail label="Submitted" value={d.submitted_at ? new Date(d.submitted_at).toLocaleDateString('en-IN') : '—'} />
                  </div>

                  {d.proof_documents.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Proof Documents</p>
                      <ul className="text-xs text-slate-600 space-y-0.5">
                        {d.proof_documents.map((p, i) => <li key={i}>📎 {p.split('/').pop()}</li>)}
                      </ul>
                    </div>
                  )}

                  {d.status === 'SUBMITTED' && (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        placeholder="Remarks (required for rejection)"
                        value={remarks[d.id] || ''}
                        onChange={e => setRemarks(prev => ({ ...prev, [d.id]: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => approve(d.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4" /> Approve
                        </button>
                        <button
                          onClick={() => reject(d.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700"
                        >
                          <XCircle className="h-4 w-4" /> Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {d.admin_remarks && (
                    <p className="text-xs text-slate-500 italic">Admin note: {d.admin_remarks}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs text-slate-400">{label}</p>
    <p className="text-sm font-medium text-slate-800">{value}</p>
  </div>
);

export default TaxDeclarationAdminPage;
