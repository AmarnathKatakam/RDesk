import React from 'react';
import HelpResourcePage from './HelpResourcePage';

const DocumentationPage: React.FC = () => (
  <HelpResourcePage
    title="Documentation"
    description="Structured product documentation for RothDesk features."
    sections={[
      { heading: 'Product Overview', body: 'Understand the main modules, navigation structure, roles, and available dashboards.' },
      { heading: 'Feature Guides', body: 'Use step-by-step notes for employee management, payroll, attendance, leaves, and documents.' },
      { heading: 'Data Requirements', body: 'Review the fields and documents needed for clean HR and payroll operations.' },
      { heading: 'Troubleshooting', body: 'Find common issues, validation checks, and recommended next steps.' },
    ]}
  />
);

export default DocumentationPage;
