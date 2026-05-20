import React from 'react';
import CEODashboard from '@/components/CEODashboard';

/**
 * Page: CEO Dashboard
 * Shows company-wide analytics and key performance indicators
 */
const CEODashboardPage: React.FC = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Executive Dashboard</h1>
      <CEODashboard />
    </div>
  );
};

export default CEODashboardPage;
