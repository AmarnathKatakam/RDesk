import React from 'react';
import HelpResourcePage from './HelpResourcePage';

const TermsOfServicePage: React.FC = () => (
  <HelpResourcePage
    title="Terms of Service"
    description="General usage terms for RothDesk users and administrators."
    sections={[
      { heading: 'Authorized Use', body: 'Use RothDesk only for legitimate company HR, payroll, attendance, leave, and employee self-service activities.' },
      { heading: 'User Responsibilities', body: 'Users are responsible for keeping credentials secure, entering accurate information, and following company policies.' },
      { heading: 'Administrative Control', body: 'Admins should maintain correct role assignments, review changes, and verify payroll or compliance outputs before use.' },
      { heading: 'Service Changes', body: 'Features and content may evolve as the platform is improved and organization workflows change.' },
    ]}
  />
);

export default TermsOfServicePage;
