import React from 'react';
import HelpResourcePage from './HelpResourcePage';

const StatutoryCompliancesPage: React.FC = () => (
  <HelpResourcePage
    title="Statutory Compliances"
    description="Reference material for statutory payroll and HR compliance workflows."
    sections={[
      { heading: 'Compliance Calendar', body: 'Track recurring payroll, tax, PF, ESI, and professional tax compliance activities.' },
      { heading: 'Employer Obligations', body: 'Review high-level employer responsibilities for documentation, filings, and employee records.' },
      { heading: 'Payroll Checks', body: 'Validate payroll inputs, deductions, declarations, and month-end reports before final processing.' },
      { heading: 'Audit Readiness', body: 'Keep supporting documents, approvals, and reports organized for internal and external audits.' },
    ]}
  />
);

export default StatutoryCompliancesPage;
