import React from 'react';
import { Filter, Plus, UsersRound } from 'lucide-react';

const segments = [
  { name: 'Full Time Employees', criteria: 'Employment type is Full Time', employees: 42 },
  { name: 'Probation Employees', criteria: 'Status is Probation', employees: 6 },
  { name: 'Payroll Eligible', criteria: 'Active and salary assigned', employees: 39 },
];

const EmployeeSegmentPage: React.FC = () => {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Employee Segment</h1>
        <p className="text-sm text-slate-500">Create employee groups for policies, communication, payroll, and reports.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <section className="saas-card saas-section space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Segments</h2>
            <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-900 px-3 text-sm font-medium text-white hover:bg-blue-800">
              <Plus className="h-4 w-4" />
              New Segment
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {segments.map((segment) => (
              <article key={segment.name} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                  <UsersRound className="h-5 w-5 text-emerald-700" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{segment.name}</h3>
                <p className="mt-2 min-h-10 text-sm text-slate-500">{segment.criteria}</p>
                <p className="mt-4 text-2xl font-semibold text-slate-900">{segment.employees}</p>
                <p className="text-xs text-slate-500">employees</p>
              </article>
            ))}
          </div>
        </section>

        <section className="saas-card saas-section space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-blue-700" />
            <h2 className="text-lg font-semibold text-slate-900">Segment Rules</h2>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Segment name</span>
            <input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder="Enter segment name" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Rule</span>
            <select className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm">
              <option>Department</option>
              <option>Employment type</option>
              <option>Location</option>
              <option>Salary assigned</option>
            </select>
          </label>
          <input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder="Rule value" />
          <button type="button" className="h-10 w-full rounded-xl bg-slate-900 text-sm font-medium text-white hover:bg-slate-800">
            Save Segment
          </button>
        </section>
      </div>
    </div>
  );
};

export default EmployeeSegmentPage;
