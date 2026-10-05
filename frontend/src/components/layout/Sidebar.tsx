import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  FilePlus2,
  ListTodo,
  CalendarCheck,
  PackageCheck,
  Users,
  BarChart3,
  History,
  Bell,
  Sparkles,
  UserRound,
  BookOpen,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose = () => undefined }) => {
  const { t } = useTranslation("common");

  const { user, isInstructor, isAvStaff, isCoordinator, isAdmin } = useAuth();

  const navItems = [
    // Shared overview: same system-wide information for every role
    {
      to: '/reports',
      label: t("สรุปภาพรวม"),
      icon: <BarChart3 className="w-4 h-4" />,
      show: true,
    },
    // Instructor Links
    {
      to: '/instructor/dashboard',
      label: t("แดชบอร์ดข้อสอบ"),
      icon: <LayoutDashboard className="w-4 h-4" />,
      show: isInstructor,
    },
    {
      to: '/instructor/courses',
      label: t("รายวิชาที่ฉันสอน"),
      icon: <BookOpen className="w-4 h-4" />,
      show: isInstructor,
    },
    {
      to: '/instructor/exams/new',
      label: t("ส่งข้อสอบใหม่"),
      icon: <FilePlus2 className="w-4 h-4" />,
      show: isInstructor,
    },

    // AV Staff Links
    {
      to: '/av-staff/queue',
      label: t("คิวงานตรวจ/พิมพ์/บรรจุ"),
      icon: <ListTodo className="w-4 h-4" />,
      show: isAvStaff,
    },

    // Exam Coordinator Links
    {
      to: '/coordinator/courses',
      label: t("รายวิชา & ตารางสอบ"),
      icon: <CalendarCheck className="w-4 h-4" />,
      show: isCoordinator,
    },
    {
      to: '/coordinator/receive',
      label: t("รับมอบข้อสอบ"),
      icon: <PackageCheck className="w-4 h-4" />,
      show: isCoordinator,
    },

    // Admin Links
    {
      to: '/admin/users',
      label: t("จัดการผู้ใช้งาน"),
      icon: <Users className="w-4 h-4" />,
      show: isAdmin,
    },
    {
      to: '/admin/audit-log',
      label: t("ประวัติ Audit Log"),
      icon: <History className="w-4 h-4" />,
      show: isAdmin,
    },

    // Shared
    {
      to: '/profile',
      label: t("โปรไฟล์ของฉัน"),
      icon: <UserRound className="w-4 h-4" />,
      show: true,
    },
    {
      to: '/notifications',
      label: t("การแจ้งเตือน"),
      icon: <Bell className="w-4 h-4" />,
      show: true,
    },
  ];

  return (
    <>
      {isOpen && (
        <button
          aria-label={t("ปิดเมนู")}
          className="fixed inset-0 top-16 z-40 bg-slate-950/45 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
        />
      )}
      <aside className={`fixed left-0 top-16 bottom-0 z-50 w-72 max-w-[86vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:min-h-[calc(100vh-4rem)] lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between px-4 pt-4 lg:hidden">
        <div className="font-extrabold text-slate-900 dark:text-white">{t("เมนูระบบ")}</div>
        <button aria-label={t("ปิดเมนู")} onClick={onClose} className="rounded-xl p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="h-5 w-5" />
        </button>
      </div>
      {/* Role Notice Card */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700/60 text-xs">
          <div className="text-slate-500 dark:text-slate-400 font-medium">{t("สิทธิ์การใช้งานปัจจุบัน:")}</div>
          <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
            {user?.role ? t(`role.${user.role}`, { ns: 'statuses', defaultValue: user.role }) : '-'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            {user?.department || t("มหาวิทยาลัย")}
          </div>
        </div>
      </div>

      {/* Nav items list */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">

          {t("เมนูหลักตามบทบาท")}
        </div>
        {navItems
          .filter((item) => item.show)
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/30 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
      </nav>

      {/* Footer System Info */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
        <div>PrintExam Platform v1.0</div>
        <div className="text-[10px] text-slate-400">{t("ระบบจัดการพิมพ์ข้อสอบ Online")}</div>
      </div>
      </aside>
    </>
  );
};
