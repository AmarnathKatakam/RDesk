import React from 'react';
import HelpResourcePage from './HelpResourcePage';

const PayrollCompliancePage: React.FC = () => (
  <HelpResourcePage
    title="Payroll Compliance"
    description="Payroll compliance references for tax, statutory deductions, and reporting."
    sections={[
      { heading: 'Tax Declarations', body: 'Review declaration collection, proof checks, regime comparison, and year-end validation flows.' },
      { heading: 'Statutory Deductions', body: 'Track PF, ESI, professional tax, and other recurring deduction checks.' },
      { heading: 'Payroll Reports', body: 'Use payroll summaries, run details, and payslip records for reconciliation and compliance review.' },
      { heading: 'Monthly Closure', body: 'Confirm inputs, deductions, approvals, and employee communications before payroll finalization.' },
    ]}
  />
);

export default PayrollCompliancePage;
