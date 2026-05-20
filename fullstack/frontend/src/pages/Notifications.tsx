/**
 * Component: pages/Notifications.tsx
 * Employee notifications — includes announcements from Mass Communication.
 */
import React, { useEffect, useState } from 'react';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Bell, Megaphone } from 'lucide-react';
import { getJson, hrmsApi } from '@/services/hrmsApi';

interface NotificationRow {
  id: number;
  type?: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  ANNOUNCEMENT: <Megaphone className="h-4 w-4 text-blue-600" />,
};

const NotificationsPage: React.FC = () => {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void loadNotifications(); }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await hrmsApi.getNotifications();
      if (!response.ok) { setItems([]); return; }
      const data = await getJson<{ notifications?: NotificationRow[] }>(response);
      setItems(data.notifications || []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  };

  const markRead = async (id?: number) => {
    await hrmsApi.markNotificationAsRead(id);
    setItems(prev => prev.map(item => (id && item.id !== id ? item : { ...item, is_read: true })));
  };

  const unread = items.filter(i => !i.is_read).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">
            {unread > 0 ? `${unread} unread notification${unread > 1 ? 's' : ''}` : 'All caught up.'}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={() => void markRead()}
            className="h-9 px-4 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading && <p className="p-6 text-sm text-slate-400">Loading notifications…</p>}
        {!loading && items.length === 0 && (
          <div className="py-16 text-center">
            <Bell className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No notifications yet.</p>
          </div>
        )}
        {!loading && items.map(item => (
          <button
            key={item.id}
            onClick={() => { if (!item.is_read) void markRead(item.id); }}
            className={`w-full text-left px-5 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${item.is_read ? '' : 'bg-blue-50/40'}`}
          >
            <div className="flex items-start gap-3">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${item.type === 'ANNOUNCEMENT' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                {TYPE_ICON[item.type ?? ''] ?? <Bell className="h-4 w-4 text-slate-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-semibold ${item.is_read ? 'text-slate-700' : 'text-slate-900'}`}>{item.title}</p>
                  <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                    {formatDistanceToNowStrict(parseISO(item.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-line">{item.message}</p>
              </div>
              {!item.is_read && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-2" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default NotificationsPage;
