/**
 * Component: components\NotificationBell.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { getJson, hrmsApi } from '@/services/hrmsApi';

interface AppNotification {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const POLL_INTERVAL_MS = 30000;

const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.is_read).length,
    [items]
  );

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) {
      void loadNotifications();
    }
  }, [open]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await hrmsApi.getNotifications();
      if (!response.ok) {
        setItems([]);
        return;
      }
      const data = await getJson<{ notifications?: AppNotification[] }>(response);
      setItems(data.notifications || []);
    } catch (error) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id?: number) => {
    try {
      const response = await hrmsApi.markNotificationAsRead(id);
      if (!response.ok) {
        return;
      }
      setItems((prev) =>
        prev.map((item) => (id && item.id !== id ? item : { ...item, is_read: true }))
      );
    } catch (error) {
      // ignore
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((current) => !current)}
        className="relative h-10 w-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 inline-flex items-center justify-center"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold inline-flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close notifications" />
          <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-1rem)] saas-card z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <p className="font-semibold text-slate-900">Notifications</p>
              {unreadCount > 0 && (
                <button onClick={() => markRead()} className="text-xs text-blue-700 font-medium">
                  Mark all as read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-auto">
              {loading && <p className="p-4 text-sm text-slate-500">Loading...</p>}
              {!loading && items.length === 0 && (
                <p className="p-4 text-sm text-slate-500">No notifications</p>
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
                    className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 ${
                      item.is_read ? 'bg-white' : 'bg-blue-50/40'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-600 mt-1">{item.message}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      {formatDistanceToNowStrict(parseISO(item.created_at), { addSuffix: true })}
                    </p>
                  </button>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;

