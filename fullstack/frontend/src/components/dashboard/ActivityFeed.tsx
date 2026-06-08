/**
* Component: components\dashboard\ActivityFeed.tsx
* Purpose: Defines UI structure and behavior for this view/component.
*/
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, UserPlus, CalendarCheck, Clock, MoreHorizontal, Loader2, AlertCircle } from 'lucide-react';
import { dashboardAPI } from '@/services/api';

interface Activity {
  id: number;
  type: string;
  title: string;
  description: string;
  time: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

const ActivityFeed: React.FC = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getActivityPath = (type: string) => {
    const routes: Record<string, string> = {
      payroll: '/admin/payroll',
      employee: '/admin/employees',
      leave: '/admin/leaves',
      attendance: '/admin/attendance',
    };

    return routes[type] || '/admin/notifications';
  };

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await dashboardAPI.getDashboardActivity();

        if (response.data && Array.isArray(response.data)) {
          // Transform API response to activity format
          const transformedActivities: Activity[] = response.data.map((item: any, index: number) => {
            const activityTypes: Record<string, { icon: React.ElementType; iconBg: string; iconColor: string }> = {
              payroll: { icon: DollarSign, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
              employee: { icon: UserPlus, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
              leave: { icon: CalendarCheck, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
              attendance: { icon: Clock, iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
            };

            const typeInfo = activityTypes[item.type] || activityTypes.employee;

            return {
              id: item.id || index,
              type: item.type,
              title: item.title || 'Activity',
              description: item.description || '',
              time: item.time || item.created_at || 'Recently',
              ...typeInfo,
            };
          });

          setActivities(transformedActivities);
        } else {
          // Fallback to empty if no data
          setActivities([]);
        }
      } catch (err) {
        console.error('Failed to fetch activities:', err);
        setError('Failed to load activities');
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-roth-accent" />
            <h3 className="font-semibold text-gray-900">Recent Activities</h3>
          </div>
        </div>
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-roth-accent" />
        </div>
      </div>
    );
  }

  if (error || activities.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-roth-accent" />
            <h3 className="font-semibold text-gray-900">Recent Activities</h3>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/notifications')}
            className="text-sm text-roth-accent hover:text-roth-secondary font-medium transition-colors"
          >
            View All
          </button>
        </div>
        <div className="p-6">
          {error ? (
            <div className="flex items-center justify-center py-4 text-amber-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-4">
              No recent activities
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-roth-accent" />
          <h3 className="font-semibold text-gray-900">Recent Activities</h3>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin/notifications')}
          className="text-sm text-roth-accent hover:text-roth-secondary font-medium transition-colors"
        >
          View All
        </button>
      </div>
      <div className="divide-y divide-gray-100">
        {activities.map((activity) => (
          <div key={activity.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start gap-4">
              <div className={`h-10 w-10 rounded-full ${activity.iconBg} flex items-center justify-center flex-shrink-0`}>
                <activity.icon className={`h-5 w-5 ${activity.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(getActivityPath(activity.type))}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Open activity"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">{activity.time}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityFeed;


 