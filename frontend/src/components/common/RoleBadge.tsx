import React from 'react';
import { UserRole, ROLE_LABELS_TH } from '../../types';
import { GraduationCap, Printer, CalendarCheck, ShieldCheck } from 'lucide-react';

interface RoleBadgeProps {
  role: UserRole | string;
  size?: 'sm' | 'md' | 'lg';
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = 'md' }) => {
  const getRoleConfig = () => {
    switch (role) {
      case UserRole.INSTRUCTOR:
        return {
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800',
          icon: <GraduationCap className="w-3.5 h-3.5" />,
          label: ROLE_LABELS_TH[UserRole.INSTRUCTOR],
        };
      case UserRole.AV_STAFF:
        return {
          bg: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
          icon: <Printer className="w-3.5 h-3.5" />,
          label: ROLE_LABELS_TH[UserRole.AV_STAFF],
        };
      case UserRole.COORDINATOR:
        return {
          bg: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800',
          icon: <CalendarCheck className="w-3.5 h-3.5" />,
          label: ROLE_LABELS_TH[UserRole.COORDINATOR],
        };
      case UserRole.ADMIN:
        return {
          bg: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800',
          icon: <ShieldCheck className="w-3.5 h-3.5" />,
          label: ROLE_LABELS_TH[UserRole.ADMIN],
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          icon: null,
          label: role,
        };
    }
  };

  const config = getRoleConfig();
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center rounded-lg border shadow-xs ${config.bg} ${sizeClasses[size]}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};
