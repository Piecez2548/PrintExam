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
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, isInstructor, isAvStaff, isCoordinator, isAdmin } = useAuth();

  const navItems = [
    // Instructor Links
    {
      to: '/instructor/dashboard',
      label: 'แดชบอร์ดข้อสอบ',
      icon: <LayoutDashboard className="w-4 h-4" />,
      show: isInstructor,
    },
    {
      to: '/instructor/exams/new',
      label: 'ส่งข้อสอบใหม่',
      icon: <FilePlus2 className="w-4 h-4" />,
      show: isInstructor,
    },

    // AV Staff Links
    {
      to: '/av-staff/queue',
      label: 'คิวงานตรวจ/พิมพ์/บรรจุ',
      icon: <ListTodo className="w-4 h-4" />,
      show: isAvStaff,
    },

    // Exam Coordinator Links
    {
      to: '/coordinator/courses',
      label: 'รายวิชา & ตารางสอบ',
      icon: <CalendarCheck className="w-4 h-4" />,
      show: isCoordinator,
    },
    {
      to: '/coordinator/receive',
      label: 'รับมอบข้อสอบ',
      icon: <PackageCheck className="w-4 h-4" />,
      show: isCoordinator,
    },

    // Admin Links
    {
      to: '/admin/users',
      label: 'จัดการผู้ใช้งาน',
      icon: <Users className="w-4 h-4" />,
      show: isAdmin,
    },
    {
      to: '/admin/reports',
      label: 'สรุปภาพรวม & ค้นหา',
      icon: <BarChart3 className="w-4 h-4" />,
      show: true, // Everyone can view reports filtered by role
    },
    {
      to: '/admin/audit-log',
      label: 'ประวัติ Audit Log',
      icon: <History className="w-4 h-4" />,
      show: isAdmin,
    },

    // Shared
    {
      to: '/notifications',
      label: 'การแจ้งเตือน',
      icon: <Bell className="w-4 h-4" />,
      show: true,
    },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 min-h-[calc(100vh-4rem)]">
      {/* Role Notice Card */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700/60 text-xs">
          <div className="text-slate-500 dark:text-slate-400 font-medium">สิทธิ์การใช้งานปัจจุบัน:</div>
          <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
            {user?.role}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            {user?.department || 'มหาวิทยาลัย'}
          </div>
        </div>
      </div>

      {/* Nav items list */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">
          เมนูหลักตามบทบาท
        </div>
        {navItems
          .filter((item) => item.show)
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
        <div className="text-[10px] text-slate-400">ระบบจัดการพิมพ์ข้อสอบ Online</div>
      </div>
    </aside>
  );
};
