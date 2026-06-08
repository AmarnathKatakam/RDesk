import React from 'react';
import HelpResourcePage from './HelpResourcePage';

const ResourceCentrePage: React.FC = () => (
  <HelpResourcePage
    title="Resource Centre"
    description="Templates, checklists, and operational resources for HR teams."
    sections={[
      { heading: 'Templates', body: 'Access sample templates for employee communication, onboarding, payroll checks, and HR operations.' },
      { heading: 'Checklists', body: 'Use repeatable checklists for employee onboarding, payroll closure, audits, and exit processes.' },
      { heading: 'Reports', body: 'Find guidance for reading employee, attendance, payroll, and compliance reports.' },
      { heading: 'Process Notes', body: 'Document organization-specific practices so teams can follow the same operating rhythm.' },
    ]}
  />
);

export default ResourceCentrePage;
