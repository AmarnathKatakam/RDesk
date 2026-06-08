import React from 'react';
import HelpResourcePage from './HelpResourcePage';

const RothDeskCommunityPage: React.FC = () => (
  <HelpResourcePage
    title="RothDesk Community"
    description="Connect with HR teams, payroll administrators, and product users."
    sections={[
      { heading: 'Community Updates', body: 'Find product announcements, release notes, and operational updates for RothDesk users.' },
      { heading: 'Discussion Spaces', body: 'Use this area to share implementation questions, workflow ideas, and common HRMS practices.' },
      { heading: 'Best Practices', body: 'Browse practical guidance for employee management, payroll readiness, and internal communication.' },
      { heading: 'Getting Involved', body: 'Join upcoming sessions, contribute feedback, and help shape future improvements.' },
    ]}
  />
);

export default RothDeskCommunityPage;
