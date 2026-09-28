import React from 'react';
import { ExamStatus, STATUS_LABELS_TH } from '../../types';
import {
  FileEdit,
  Clock,
  AlertCircle,
  CheckCircle,
  Printer,
  PackageCheck,
  Truck,
  Send,
} from 'lucide-react';

interface StatusBadgeProps {
  status: ExamStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
}) => {
  const getBadgeConfig = () => {
    switch (status) {
      case ExamStatus.DRAFT:
        return {
          bg: 'bg-slate-100 dark:bg-slate-800',
          text: 'text-slate-700 dark:text-slate-300',
          border: 'border-slate-300 dark:border-slate-700',
          icon: <FileEdit className="w-3.5 h-3.5" />,
          label: STATUS_LABELS_TH[ExamStatus.DRAFT],
        };
      case ExamStatus.SUBMITTED:
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/50',
          text: 'text-blue-700 dark:text-blue-300',
          border: 'border-blue-200 dark:border-blue-800',
          icon: <Clock className="w-3.5 h-3.5 animate-pulse" />,
          label: STATUS_LABELS_TH[ExamStatus.SUBMITTED],
        };
      case ExamStatus.REJECTED:
        return {
          bg: 'bg-rose-50 dark:bg-rose-950/50',
          text: 'text-rose-700 dark:text-rose-300',
          border: 'border-rose-200 dark:border-rose-800',
          icon: <AlertCircle className="w-3.5 h-3.5" />,
          label: STATUS_LABELS_TH[ExamStatus.REJECTED],
        };
      case ExamStatus.APPROVED:
        return {
          bg: 'bg-teal-50 dark:bg-teal-950/50',
          text: 'text-teal-700 dark:text-teal-300',
          border: 'border-teal-200 dark:border-teal-800',
          icon: <CheckCircle className="w-3.5 h-3.5" />,
          label: STATUS_LABELS_TH[ExamStatus.APPROVED],
        };
      case ExamStatus.PRINTING:
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/50',
          text: 'text-amber-700 dark:text-amber-300',
          border: 'border-amber-200 dark:border-amber-800',
          icon: <Printer className="w-3.5 h-3.5 animate-spin" />,
          label: STATUS_LABELS_TH[ExamStatus.PRINTING],
        };
      case ExamStatus.PRINTED:
        return {
          bg: 'bg-indigo-50 dark:bg-indigo-950/50',
          text: 'text-indigo-700 dark:text-indigo-300',
          border: 'border-indigo-200 dark:border-indigo-800',
          icon: <Printer className="w-3.5 h-3.5" />,
          label: STATUS_LABELS_TH[ExamStatus.PRINTED],
        };
      case ExamStatus.PACKED:
        return {
          bg: 'bg-purple-50 dark:bg-purple-950/50',
          text: 'text-purple-700 dark:text-purple-300',
          border: 'border-purple-200 dark:border-purple-800',
          icon: <PackageCheck className="w-3.5 h-3.5" />,
          label: STATUS_LABELS_TH[ExamStatus.PACKED],
        };
      case ExamStatus.READY_FOR_PICKUP:
        return {
          bg: 'bg-sky-50 dark:bg-sky-950/50',
          text: 'text-sky-700 dark:text-sky-300',
          border: 'border-sky-300 dark:border-sky-800',
          icon: <Send className="w-3.5 h-3.5" />,
          label: STATUS_LABELS_TH[ExamStatus.READY_FOR_PICKUP],
        };
      case ExamStatus.DELIVERED:
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/50',
          text: 'text-emerald-700 dark:text-emerald-300',
          border: 'border-emerald-300 dark:border-emerald-800',
          icon: <Truck className="w-3.5 h-3.5" />,
          label: STATUS_LABELS_TH[ExamStatus.DELIVERED],
        };
      default:
        return {
          bg: 'bg-slate-100',
          text: 'text-slate-700',
          border: 'border-slate-300',
          icon: null,
          label: status,
        };
    }
  };

  const config = getBadgeConfig();

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-sm transition-all ${config.bg} ${config.text} ${config.border} ${sizeClasses[size]}`}
    >
      {showIcon && config.icon}
      <span>{config.label}</span>
    </span>
  );
};
