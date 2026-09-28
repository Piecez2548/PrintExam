import { ExamStatus } from '../../generated/prisma';

/**
 * Canonical business lifecycle for an exam.
 *
 * Keeping this map in one place prevents a privileged caller from skipping
 * approval, printing, packing, or handover steps by calling an API directly.
 */
export const ALLOWED_EXAM_STATUS_TRANSITIONS: Readonly<Record<ExamStatus, readonly ExamStatus[]>> = {
  [ExamStatus.DRAFT]: [ExamStatus.SUBMITTED],
  [ExamStatus.SUBMITTED]: [ExamStatus.APPROVED, ExamStatus.REJECTED],
  [ExamStatus.REJECTED]: [ExamStatus.SUBMITTED],
  [ExamStatus.APPROVED]: [ExamStatus.PRINTING],
  [ExamStatus.PRINTING]: [ExamStatus.PRINTED],
  [ExamStatus.PRINTED]: [ExamStatus.PACKED],
  [ExamStatus.PACKED]: [ExamStatus.READY_FOR_PICKUP],
  [ExamStatus.READY_FOR_PICKUP]: [ExamStatus.DELIVERED],
  [ExamStatus.DELIVERED]: [],
};

export function canTransitionExamStatus(from: ExamStatus, to: ExamStatus): boolean {
  return ALLOWED_EXAM_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionErrorMessage(from: ExamStatus, to: ExamStatus): string {
  return `ไม่สามารถเปลี่ยนสถานะข้อสอบจาก "${from}" เป็น "${to}" ได้ตามลำดับขั้นตอนของระบบ`;
}
