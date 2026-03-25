/**
 * Component: pages\Directory.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React from 'react';
import EmployeeDirectory from '@/components/EmployeeDirectory';

const DirectoryPage: React.FC = () => {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Employee Directory</h1>
        <p className="text-sm text-slate-500">Search employees by name, department, and location.</p>
      </div>
      <div className="saas-card saas-section">
        <EmployeeDirectory />
      </div>
    </div>
  );
};

export default DirectoryPage;

