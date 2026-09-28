import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { RoleBadge } from '../common/RoleBadge';
import { notificationsApi } from '../../api/notifications';
import { NotificationItem } from '../../types';
import {
  Printer,
  Bell,
  LogOut,
  ChevronDown,
  Wifi,
  WifiOff,
  CheckCheck,
  User as UserIcon,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { isConnected, lastEvent } = useWebSocket();
  const navigate = useNavigate();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    try {
      const res = await notificationsApi.getNotifications();
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      // Ignore
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user, lastEvent]);

  // Handle outside clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      await notificationsApi.markRead(notif.id);
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    }
    setIsNotifOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight flex items-center gap-1.5">
                <span>PrintExam</span>
                <span className="text-[10px] uppercase font-bold bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300 px-1.5 py-0.2 rounded">
                  Online
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                ระบบจัดการพิมพ์ข้อสอบมหาวิทยาลัย
              </div>
            </div>
          </Link>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* WebSocket Status indicator */}
          <div
            title={isConnected ? 'เชื่อมต่อ Real-time WebSocket แล้ว' : 'กำลังเชื่อมต่อ Real-time...'}
            className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700"
          >
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline text-[11px] text-emerald-600 font-medium">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                <span className="hidden sm:inline text-[11px] text-amber-600 font-medium">Offline</span>
              </>
            )}
          </div>

          {/* Notifications Popover */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-bounce">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span>การแจ้งเตือน</span>
                    {unreadCount > 0 && (
                      <span className="bg-brand-100 text-brand-700 text-xs px-1.5 py-0.2 rounded-full font-semibold">
                        {unreadCount} ใหม่
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 font-medium"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      อ่านทั้งหมด
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      ไม่มีการแจ้งเตือนใหม่
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors ${
                          !notif.is_read ? 'bg-sky-50/50 dark:bg-sky-950/30' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {notif.title}
                          </div>
                          {!notif.is_read && (
                            <span className="w-2 h-2 rounded-full bg-brand-500 mt-1 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                          {notif.message}
                        </p>
                        <div className="text-[10px] text-slate-400 mt-1.5">
                          {new Date(notif.created_at).toLocaleString('th-TH')}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  <Link
                    to="/notifications"
                    onClick={() => setIsNotifOpen(false)}
                    className="text-xs text-brand-600 hover:underline font-medium"
                  >
                    ดูการแจ้งเตือนทั้งหมด
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile & Role */}
          {user && (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-sm">
                  {user.full_name.charAt(0)}
                </div>
                <div className="hidden md:block">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                    {user.full_name}
                  </div>
                  <div className="mt-0.5">
                    <RoleBadge role={user.role} size="sm" />
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {user.full_name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {user.email}
                    </div>
                    <div className="mt-2">
                      <RoleBadge role={user.role} size="sm" />
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        logout();
                        setIsProfileOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      ออกจากระบบ (Logout)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
