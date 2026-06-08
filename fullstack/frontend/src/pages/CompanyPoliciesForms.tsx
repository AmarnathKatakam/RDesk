import React from 'react';
import { FileText, ShieldCheck, Upload } from 'lucide-react';

const policyRows = [
  { name: 'Employee Handbook', type: 'Policy', owner: 'HR', status: 'Published' },
  { name: 'Leave Policy', type: 'Policy', owner: 'HR', status: 'Published' },
  { name: 'Asset Request Form', type: 'Form', owner: 'Admin', status: 'Draft' },
];

const CompanyPoliciesFormsPage: React.FC = () => {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Company Policies & Forms</h1>
        <p className="text-sm text-slate-500">Maintain employee policies, forms, ownership, and publish status.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="saas-card saas-section space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Policy Library</h2>
            <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-900 px-3 text-sm font-medium text-white hover:bg-blue-800">
              <Upload className="h-4 w-4" />
              Upload
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {policyRows.map((row) => (
                  <tr key={row.name} className="bg-white">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-4 py-3 text-slate-600">{row.type}</td>
                    <td className="px-4 py-3 text-slate-600">{row.owner}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${row.status === 'Published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="saas-card saas-section space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Publish Controls</h2>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Document title</span>
            <input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder="Enter policy or form name" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Category</span>
            <select className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm">
              <option>Policy</option>
              <option>Form</option>
              <option>Declaration</option>
            </select>
          </label>
          <button type="button" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-medium text-white hover:bg-slate-800">
            <FileText className="h-4 w-4" />
            Save Entry
          </button>
        </section>
      </div>
    </div>
  );
};

export default CompanyPoliciesFormsPage;
