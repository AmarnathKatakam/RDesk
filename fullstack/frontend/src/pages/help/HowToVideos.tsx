import React from 'react';
import HelpResourcePage from './HelpResourcePage';

const HowToVideosPage: React.FC = () => (
  <HelpResourcePage
    title="How-to Videos"
    description="Video learning paths for common RothDesk workflows."
    sections={[
      { heading: 'Getting Started', body: 'Watch quick walkthroughs for navigating the dashboard and using core modules.' },
      { heading: 'Employee Management', body: 'Learn how to create employee records, update details, and manage documents.' },
      { heading: 'Payroll Processing', body: 'Follow the payroll run from setup and inputs through preview, approval, and payslip release.' },
      { heading: 'Admin Workflows', body: 'Review settings, notifications, directory usage, and communication tools.' },
    ]}
  />
);

export default HowToVideosPage;
