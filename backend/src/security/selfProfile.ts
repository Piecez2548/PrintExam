export const SELF_PROFILE_FIELDS = ['full_name', 'email', 'department', 'phone'] as const;

export type SelfProfileField = (typeof SELF_PROFILE_FIELDS)[number];

export interface SelfProfileUpdateData {
  fullName?: string;
  email?: string;
  department?: string | null;
  phone?: string | null;
}

export type SelfProfileValidationResult =
  | { ok: true; data: SelfProfileUpdateData; fields: SelfProfileField[] }
  | { ok: false; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Validate and map the public self-profile contract to Prisma field names.
 * Unknown or protected fields are rejected as a whole to prevent mass assignment.
 */
export function validateSelfProfileUpdate(input: unknown): SelfProfileValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, message: 'ข้อมูลโปรไฟล์ไม่ถูกต้อง' };
  }

  const body = input as Record<string, unknown>;
  const keys = Object.keys(body);
  const unknownFields = keys.filter((key) => !(SELF_PROFILE_FIELDS as readonly string[]).includes(key));

  if (unknownFields.length > 0) {
    return { ok: false, message: 'อนุญาตให้แก้ไขเฉพาะชื่อ อีเมล หน่วยงาน และเบอร์โทรศัพท์เท่านั้น' };
  }

  if (keys.length === 0) {
    return { ok: false, message: 'กรุณาระบุข้อมูลที่ต้องการแก้ไข' };
  }

  const data: SelfProfileUpdateData = {};
  const fields: SelfProfileField[] = [];

  if (hasOwn(body, 'full_name')) {
    if (typeof body.full_name !== 'string') {
      return { ok: false, message: 'ชื่อ-นามสกุลไม่ถูกต้อง' };
    }
    const fullName = body.full_name.trim();
    if (fullName.length < 2 || fullName.length > 200) {
      return { ok: false, message: 'ชื่อ-นามสกุลต้องมีความยาว 2-200 ตัวอักษร' };
    }
    data.fullName = fullName;
    fields.push('full_name');
  }

  if (hasOwn(body, 'email')) {
    if (typeof body.email !== 'string') {
      return { ok: false, message: 'อีเมลไม่ถูกต้อง' };
    }
    const email = body.email.trim().toLowerCase();
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return { ok: false, message: 'รูปแบบอีเมลไม่ถูกต้อง' };
    }
    data.email = email;
    fields.push('email');
  }

  if (hasOwn(body, 'department')) {
    if (body.department !== null && typeof body.department !== 'string') {
      return { ok: false, message: 'หน่วยงานไม่ถูกต้อง' };
    }
    const department = typeof body.department === 'string' ? body.department.trim() : null;
    if (department && department.length > 200) {
      return { ok: false, message: 'หน่วยงานต้องมีความยาวไม่เกิน 200 ตัวอักษร' };
    }
    data.department = department || null;
    fields.push('department');
  }

  if (hasOwn(body, 'phone')) {
    if (body.phone !== null && typeof body.phone !== 'string') {
      return { ok: false, message: 'เบอร์โทรศัพท์ไม่ถูกต้อง' };
    }
    const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
    if (phone && phone.length > 50) {
      return { ok: false, message: 'เบอร์โทรศัพท์ต้องมีความยาวไม่เกิน 50 ตัวอักษร' };
    }
    data.phone = phone || null;
    fields.push('phone');
  }

  return { ok: true, data, fields };
}
