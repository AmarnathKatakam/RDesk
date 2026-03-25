/**
 * Component: pages\Settings.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React from 'react';

const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Company, email, payroll, roles, and security preferences.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="saas-card saas-section space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Company Settings</h2>
          <input className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm" placeholder="Company name" defaultValue="BlackRoth" />
          <input className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm" placeholder="Support email" defaultValue="support@blackroth.in" />
          <button className="h-10 px-4 rounded-xl bg-blue-900 text-white text-sm">Save Company Settings</button>
        </section>

        <section className="saas-card saas-section space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Email Settings</h2>
          <input className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm" placeholder="SMTP Host" />
          <input className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm" placeholder="SMTP Port" />
          <button className="h-10 px-4 rounded-xl bg-blue-900 text-white text-sm">Save Email Settings</button>
        </section>

        <section className="saas-card saas-section space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Payroll Settings</h2>
          <input className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm" placeholder="Payroll cycle day" defaultValue="30" />
          <input className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm" placeholder="Default currency" defaultValue="INR" />
          <button className="h-10 px-4 rounded-xl bg-blue-900 text-white text-sm">Save Payroll Settings</button>
        </section>

        <section className="saas-card saas-section space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">User Roles & Security</h2>
          <div className="space-y-2 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked />
              Enforce strong passwords
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked />
              Enable session timeout
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" />
              Enable 2FA requirement
            </label>
          </div>
          <button className="h-10 px-4 rounded-xl bg-blue-900 text-white text-sm">Save Security Settings</button>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;

