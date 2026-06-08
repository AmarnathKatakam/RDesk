import React from 'react';
import HelpResourcePage from './HelpResourcePage';

const PrivacyPolicyPage: React.FC = () => (
  <HelpResourcePage
    title="Privacy Policy"
    description="How RothDesk handles employee and company information."
    sections={[
      { heading: 'Information We Use', body: 'RothDesk stores employee, payroll, attendance, leave, document, and account information needed to operate HRMS workflows.' },
      { heading: 'Purpose of Processing', body: 'Data is used for authentication, employee administration, payroll processing, compliance reporting, and internal communication.' },
      { heading: 'Access Control', body: 'Access should be limited by role so admins, HR users, and employees only see information relevant to their responsibilities.' },
      { heading: 'Data Care', body: 'Organizations should keep records accurate, review access regularly, and remove stale information according to their retention practices.' },
    ]}
  />
);

export default PrivacyPolicyPage;
