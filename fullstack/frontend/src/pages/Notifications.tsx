/**
 * Component: pages/Notifications.tsx
 * Employee notifications — shows the dashboard activity list.
 */
import React, { useEffect, useState } from 'react';
import { Bell, CalendarCheck, Clock, DollarSign, Megaphone, UserPlus } from 'lucide-react';
import { dashboardAPI } from '@/services/api';

interface NotificationRow {
  id: number;
  type?: string;
  title: string;
  message: string;
  created_at: string;
  time_label?: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  ANNOUNCEMENT: <Megaphone className="h-4 w-4 text-blue-600" />,
  attendance: <Clock className="h-4 w-4 text-amber-600" />,
  employee: <UserPlus className="h-4 w-4 text-blue-600" />,
  leave: <CalendarCheck className="h-4 w-4 text-purple-600" />,
  payroll: <DollarSign className="h-4 w-4 text-emerald-600" />,
};

const TYPE_BG: Record<string, string> = {
  ANNOUNCEMENT: 'bg-blue-100',
  attendance: 'bg-amber-100',
  employee: 'bg-blue-100',
  leave: 'bg-purple-100',
  payroll: 'bg-emerald-100',
};

const formatItemTime = (item: NotificationRow) => {
  return item.time_label || item.created_at;
};

const NotificationsPage: React.FC = () => {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void loadNotifications(); }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const activityResponse = await dashboardAPI.getDashboardActivity();
      const activities = Array.isArray(activityResponse.data) ? activityResponse.data : [];
      setItems(activities.map((item: any, index: number) => ({
        id: item.id || index,
        type: item.type,
        title: item.title || 'Activity',
        message: item.description || '',
        created_at: item.created_at || item.time || 'Recently',
        time_label: item.time,
      })));
    } catch { setItems([]); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">Recent activity details.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading && <p className="p-6 text-sm text-slate-400">Loading notifications…</p>}
        {!loading && items.length === 0 && (
          <div className="py-16 text-center">
            <Bell className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No notifications yet.</p>
          </div>
        )}
        {!loading && items.map(item => (
          <div
            key={item.id}
            className="w-full text-left px-6 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${TYPE_BG[item.type ?? ''] ?? 'bg-slate-100'}`}>
                {TYPE_ICON[item.type ?? ''] ?? <Bell className="h-4 w-4 text-slate-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-line">{item.message}</p>
                <p className="text-xs text-slate-400 mt-2">{formatItemTime(item)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationsPage;
