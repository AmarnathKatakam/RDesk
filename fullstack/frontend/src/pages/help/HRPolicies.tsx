import React from 'react';
import HelpResourcePage from './HelpResourcePage';

const HRPoliciesPage: React.FC = () => (
  <HelpResourcePage
    title="HR Policies"
    description="Company policy references and employee guideline material."
    sections={[
      { heading: 'Leave Policy', body: 'Maintain leave types, approval expectations, balance rules, and holiday-related guidance.' },
      { heading: 'Attendance Policy', body: 'Document attendance expectations, regularization rules, shift notes, and exception handling.' },
      { heading: 'Employee Conduct', body: 'Share workplace expectations, communication standards, and code of conduct information.' },
      { heading: 'Document Policy', body: 'Clarify required employee documents, privacy expectations, retention, and update procedures.' },
    ]}
  />
);

export default HRPoliciesPage;
