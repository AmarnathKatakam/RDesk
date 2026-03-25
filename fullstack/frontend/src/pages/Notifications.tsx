/**
 * Component: pages\Notifications.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useState } from 'react';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { getJson, hrmsApi } from '@/services/hrmsApi';

interface NotificationRow {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const NotificationsPage: React.FC = () => {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await hrmsApi.getNotifications();
      if (!response.ok) {
        setItems([]);
        return;
      }
      const data = await getJson<{ notifications?: NotificationRow[] }>(response);
      setItems(data.notifications || []);
    } catch (error) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id?: number) => {
    await hrmsApi.markNotificationAsRead(id);
    setItems((prev) => prev.map((item) => (id && item.id !== id ? item : { ...item, is_read: true })));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">Track payroll, leave, and document updates.</p>
        </div>
        <button
          onClick={() => void markRead()}
          className="h-10 px-4 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
        >
          Mark all as read
        </button>
      </div>

      <div className="saas-card overflow-hidden">
        {loading && <p className="p-5 text-sm text-slate-500">Loading notifications...</p>}
        {!loading && items.length === 0 && (
          <p className="p-5 text-sm text-slate-500">No notifications available.</p>
        )}
        {!loading &&
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (!item.is_read) {
                  void markRead(item.id);
                }
              }}
              className={`w-full text-left px-5 py-4 border-b border-slate-200 hover:bg-slate-50 ${
                item.is_read ? 'bg-white' : 'bg-blue-50/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-600 mt-1">{item.message}</p>
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {formatDistanceToNowStrict(parseISO(item.created_at), { addSuffix: true })}
                </span>
              </div>
            </button>
          ))}
      </div>
    </div>
  );
};

export default NotificationsPage;

