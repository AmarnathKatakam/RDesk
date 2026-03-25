/**
 * Component: components\NotificationCenter.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Bell, X, FileText, CheckCircle2, XCircle, Megaphone, MessageSquare } from 'lucide-react';
import { getJson, hrmsApi } from '@/services/hrmsApi';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationCenterProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen = false, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(isOpen);
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  useEffect(() => {
    void loadNotifications();
    const interval = setInterval(() => {
      void loadNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setIsDropdownOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (isDropdownOpen && unreadCount > 0) {
      void markAllAsRead();
    }
  }, [isDropdownOpen, unreadCount]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await hrmsApi.getNotifications();

      if (response.ok) {
        const data = await getJson<{ notifications?: Notification[] }>(response);
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: number) => {
    const target = notifications.find((notification) => notification.id === notificationId);
    if (!target || target.is_read) {
      return;
    }

    try {
      const response = await hrmsApi.markNotificationAsRead(notificationId);
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId ? { ...notification, is_read: true } : notification
          )
        );
      }
    } catch (error) {
      console.error('Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) {
      return;
    }

    try {
      const response = await hrmsApi.markNotificationAsRead();
      if (response.ok) {
        setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
      }
    } catch (error) {
      console.error('Failed to mark notifications as read');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'PAYSLIP_RELEASED':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'LEAVE_APPROVED':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'LEAVE_REJECTED':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'ANNOUNCEMENT':
        return <Megaphone className="w-5 h-5 text-amber-600" />;
      default:
        return <MessageSquare className="w-5 h-5 text-gray-600" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'PAYSLIP_RELEASED':
        return 'bg-blue-50 border-blue-200';
      case 'LEAVE_APPROVED':
        return 'bg-green-50 border-green-200';
      case 'LEAVE_REJECTED':
        return 'bg-red-50 border-red-200';
      case 'ANNOUNCEMENT':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="relative p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
        aria-label="Open notifications"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-900">Notifications</h3>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-sm text-blue-600 hover:text-blue-700">
                  Mark all as read
                </button>
              )}
              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  onClose?.();
                }}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close notifications"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No notifications</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition ${getNotificationColor(notification.type)} border-l-4`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      <span>{getNotificationIcon(notification.type)}</span>
                      <div className="flex-1">
                        <div className="flex justify-between items-start gap-3">
                          <h4 className="font-semibold text-gray-900 text-sm">{notification.title}</h4>
                          {!notification.is_read && (
                            <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mt-1 shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{notification.message}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {format(parseISO(notification.created_at), 'MMM dd, HH:mm')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;

