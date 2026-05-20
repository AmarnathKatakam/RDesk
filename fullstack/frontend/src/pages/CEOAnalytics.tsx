import React from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * Page: CEO Analytics
 * Detailed analytics and reporting for CEO
 */
const CEOAnalyticsPage: React.FC = () => {
  // Sample data - would be replaced with real data from API
  const departmentData = [
    { name: 'Engineering', value: 250000 },
    { name: 'HR', value: 100000 },
    { name: 'Sales', value: 200000 },
    { name: 'Finance', value: 150000 },
  ];

  const growthData = [
    { month: 'Jan', revenue: 4000, expenses: 2400 },
    { month: 'Feb', revenue: 3000, expenses: 1398 },
    { month: 'Mar', revenue: 2000, expenses: 9800 },
    { month: 'Apr', revenue: 2780, expenses: 3908 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics & Reporting</h1>
        <p className="text-gray-600 mt-1">In-depth analysis of company performance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Payroll */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Payroll</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={departmentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue vs Expenses */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue" />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" name="Expenses" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Coming Soon Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">📊 Advanced Analytics (Coming Soon)</h3>
        <p className="text-blue-700">
          Future features include:
        </p>
        <ul className="list-disc list-inside text-blue-700 mt-2 space-y-1">
          <li>Year-over-Year comparison</li>
          <li>Forecasting & trend analysis</li>
          <li>Custom report generation</li>
          <li>Export to PDF/Excel</li>
          <li>Real-time alerts & notifications</li>
        </ul>
      </div>
    </div>
  );
};

export default CEOAnalyticsPage;
