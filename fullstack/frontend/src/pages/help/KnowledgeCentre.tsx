import React from 'react';
import HelpResourcePage from './HelpResourcePage';

const KnowledgeCentrePage: React.FC = () => (
  <HelpResourcePage
    title="Knowledge Centre"
    description="Guides and reference articles for day-to-day RothDesk usage."
    sections={[
      { heading: 'Employee Records', body: 'Learn how to maintain profiles, bank details, documents, family information, and employment data.' },
      { heading: 'Attendance & Leaves', body: 'Understand attendance summaries, leave balances, approval workflows, and exception handling.' },
      { heading: 'Payroll Operations', body: 'Follow payroll setup, monthly inputs, preview checks, payslip generation, and reporting flows.' },
      { heading: 'Administration', body: 'Manage user roles, settings, notifications, and communication preferences.' },
    ]}
  />
);

export default KnowledgeCentrePage;
