import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../../api/notifications';
import { NotificationItem } from '../../types';
import { Bell, CheckCheck, Clock, ExternalLink } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { lastEvent } = useWebSocket();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifs = async () => {
    try {
      setIsLoading(true);
      const res = await notificationsApi.getNotifications();
      setNotifications(res.notifications);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, [lastEvent]);

  const handleMarkAll = async () => {
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      await notificationsApi.markRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    }
    if (notif.link) {
      navigate(notif.link);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-brand-600" />
            <span>ศูนย์การแจ้งเตือน (Notifications)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            ประวัติการแจ้งเตือนสถานะข้อสอบและกิจกรรมสำคัญทั้งหมด
          </p>
        </div>

        <button
          onClick={handleMarkAll}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 text-slate-700 dark:text-slate-300 hover:text-brand-600 rounded-xl text-xs font-semibold transition-colors"
        >
          <CheckCheck className="w-4 h-4" />
          อ่านทั้งหมดแล้ว
        </button>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">กำลังโหลด...</div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">ไม่มีการแจ้งเตือน</div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleItemClick(n)}
              className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors flex items-start justify-between gap-4 ${
                !n.is_read ? 'bg-sky-50/50 dark:bg-sky-950/20' : ''
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {n.title}
                  </span>
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">{n.message}</p>
                <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-1">
                  <Clock className="w-3 h-3" />
                  {new Date(n.created_at).toLocaleString('th-TH')}
                </div>
              </div>

              {n.link && (
                <div className="text-slate-400 hover:text-brand-600 p-2 shrink-0">
                  <ExternalLink className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
