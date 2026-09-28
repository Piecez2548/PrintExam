import React from 'react';
import { ExamStatus, ExamStatusHistory } from '../../types';
import { CheckCircle2, Clock, XCircle, ChevronRight, User, Calendar } from 'lucide-react';

interface StatusTimelineProps {
  currentStatus: ExamStatus;
  history?: ExamStatusHistory[];
}

const STEPS = [
  { key: ExamStatus.SUBMITTED, label: '1. ส่งข้อสอบ', sub: 'อาจารย์ส่งไฟล์' },
  { key: ExamStatus.APPROVED, label: '2. ตัดข้อสอบ', sub: 'หน่วยโสตอนุมัติ' },
  { key: ExamStatus.PRINTED, label: '3. จัดพิมพ์', sub: 'พิมพ์ครบจำนวน' },
  { key: ExamStatus.PACKED, label: '4. บรรจุซอง', sub: 'ติดใบปะหน้าซอง' },
  { key: ExamStatus.READY_FOR_PICKUP, label: '5. พร้อมส่งมอบ', sub: 'แจ้งศูนย์สอบ' },
  { key: ExamStatus.DELIVERED, label: '6. ส่งมอบแล้ว', sub: 'รับมอบสมบูรณ์' },
];

export const StatusTimeline: React.FC<StatusTimelineProps> = ({ currentStatus, history = [] }) => {
  const getStepIndex = (status: ExamStatus): number => {
    switch (status) {
      case ExamStatus.DRAFT: return -1;
      case ExamStatus.SUBMITTED: return 0;
      case ExamStatus.REJECTED: return 0; // Rejected at step 1
      case ExamStatus.APPROVED: return 1;
      case ExamStatus.PRINTING: return 2;
      case ExamStatus.PRINTED: return 2;
      case ExamStatus.PACKED: return 3;
      case ExamStatus.READY_FOR_PICKUP: return 4;
      case ExamStatus.DELIVERED: return 5;
      default: return 0;
    }
  };

  const currentIndex = getStepIndex(currentStatus);
  const isRejected = currentStatus === ExamStatus.REJECTED;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
      <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
        <span>ลำดับกระบวนการพิมพ์ข้อสอบ (Workflow Progress)</span>
      </h3>

      {/* Stepper Bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIndex || (idx === currentIndex && currentStatus === ExamStatus.DELIVERED);
          const isCurrent = idx === currentIndex && currentStatus !== ExamStatus.DELIVERED;
          const isFailed = isCurrent && isRejected;

          return (
            <div
              key={step.key}
              className={`relative rounded-xl p-3 border transition-all ${
                isFailed
                  ? 'bg-rose-50 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800'
                  : isDone
                  ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800'
                  : isCurrent
                  ? 'bg-sky-50 border-sky-400 dark:bg-sky-950/50 dark:border-sky-700 ring-2 ring-sky-400/30'
                  : 'bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Step {idx + 1}
                </span>
                {isFailed ? (
                  <XCircle className="w-4 h-4 text-rose-500" />
                ) : isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : isCurrent ? (
                  <Clock className="w-4 h-4 text-sky-600 animate-spin" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600" />
                )}
              </div>
              <div className={`text-xs font-bold leading-tight ${
                isFailed ? 'text-rose-700 dark:text-rose-300' :
                isDone ? 'text-emerald-800 dark:text-emerald-300' :
                isCurrent ? 'text-sky-800 dark:text-sky-300' : 'text-slate-600 dark:text-slate-400'
              }`}>
                {step.label}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {step.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* History Log Timeline */}
      {history.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            ประวัติการเปลี่ยนสถานะและผู้ดำเนินการ (Audit Trail)
          </h4>
          <div className="space-y-3">
            {history.map((h, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                <div className="flex-1 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-800">
                  <div className="flex items-center justify-between font-medium text-slate-700 dark:text-slate-200">
                    <span className="font-semibold text-brand-600 dark:text-brand-400">{h.to_status}</span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(h.action_at).toLocaleString('th-TH')}
                    </span>
                  </div>
                  {h.note && <div className="text-slate-600 dark:text-slate-300 mt-1">{h.note}</div>}
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>ผู้ดำเนินการ: {h.action_name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
