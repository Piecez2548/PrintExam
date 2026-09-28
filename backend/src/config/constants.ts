import { UserRole, ExamStatus } from '../../generated/prisma';

export { UserRole, ExamStatus };

export const STATUS_LABELS_TH: Record<ExamStatus, string> = {
  [ExamStatus.DRAFT]: 'ฉบับร่าง (Draft)',
  [ExamStatus.SUBMITTED]: 'ส่งแล้ว รอตรวจสอบ',
  [ExamStatus.REJECTED]: 'ไม่ผ่านตรวจสอบ (ต้องแก้ไข)',
  [ExamStatus.APPROVED]: 'อนุมัติ / ตัดข้อสอบแล้ว',
  [ExamStatus.PRINTING]: 'กำลังจัดพิมพ์',
  [ExamStatus.PRINTED]: 'พิมพ์เสร็จเรียบร้อย',
  [ExamStatus.PACKED]: 'บรรจุซองเรียบร้อย',
  [ExamStatus.READY_FOR_PICKUP]: 'พร้อมส่งมอบ',
  [ExamStatus.DELIVERED]: 'ส่งมอบแล้ว',
};

export const ROLE_LABELS_TH: Record<UserRole, string> = {
  [UserRole.INSTRUCTOR]: 'อาจารย์ผู้สอน (Instructor)',
  [UserRole.AV_STAFF]: 'เจ้าหน้าที่หน่วยโสต (AV Staff)',
  [UserRole.COORDINATOR]: 'จนท.ดำเนินการสอบ (Coordinator)',
  [UserRole.ADMIN]: 'ผู้ดูแลระบบ (Admin)',
};

/** หยุดการเปิดระบบทันทีหากไม่ได้ตั้ง secret เพื่อป้องกัน token ที่เดาค่าได้ */
function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required. Configure it in backend/.env');
  }
  return secret;
}

export const JWT_SECRET = requireJwtSecret();
export const TWO_FACTOR_EXPIRY_MINUTES = 3; // 3-minute timeout as required by NFR-5 & REQ-0001
export const DEADLINE_EDIT_LOCK_DAYS = 2; // At least 2 days before deadline as required by REQ-0005
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
];
