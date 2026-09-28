import React from 'react';
import { AlertTriangle, Lock, CheckCircle } from 'lucide-react';
import { Exam } from '../../types';

interface DeadlineNoticeProps {
  exam: Exam;
}

export const DeadlineNotice: React.FC<DeadlineNoticeProps> = ({ exam }) => {
  const canEdit = exam.can_edit_or_cancel;
  const reason = exam.edit_restriction_reason;

  const deadlineDate = new Date(exam.deadline_at);
  const now = new Date();
  const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (!canEdit) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3 text-amber-900 dark:text-amber-200">
        <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm">
          <div className="font-bold flex items-center gap-1.5">
            <span>เงื่อนไขการแก้ไข/ยกเลิก: ล็อคการแก้ไขแล้ว</span>
          </div>
          <div className="mt-1 text-amber-800 dark:text-amber-300 leading-relaxed">
            {reason || 'ไม่อนุญาตให้แก้ไขหรือยกเลิกข้อสอบหลังสถานะตัดข้อสอบ หรือน้อยกว่า 2 วันก่อน Deadline'}
          </div>
          <div className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            • กำหนดส่ง (Deadline): {deadlineDate.toLocaleDateString('th-TH', { dateStyle: 'medium' })} {deadlineDate.toLocaleTimeString('th-TH', { timeStyle: 'short' })} น.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl p-4 flex items-start gap-3 text-emerald-900 dark:text-emerald-200">
      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
      <div className="text-xs sm:text-sm">
        <div className="font-bold">
          สามารถแก้ไขหรือยกเลิกข้อสอบได้ (ก่อนตัดข้อสอบและล่วงหน้า ≥ 2 วัน)
        </div>
        <div className="mt-1 text-emerald-800 dark:text-emerald-300 text-xs">
          เหลือเวลาแก้ไขได้อีกประมาณ {diffDays > 0 ? `${diffDays} วัน` : 'ไม่กี่ชั่วโมง'} (Deadline: {deadlineDate.toLocaleDateString('th-TH')})
        </div>
      </div>
    </div>
  );
};
