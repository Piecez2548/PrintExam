import i18n from '../i18n';

interface ApiErrorShape {
  response?: {
    status?: number;
    data?: { code?: unknown; conflicts?: unknown; message?: unknown };
  };
}

export type UserConflictField = 'username' | 'email';
export type UserConflictFieldErrors = Record<UserConflictField, boolean>;

export function getUserConflictFields(error: unknown): UserConflictField[] {
  const apiError = error as ApiErrorShape;
  if (apiError?.response?.data?.code !== 'USER_CONFLICT') return [];
  const conflicts = apiError.response.data.conflicts;
  if (!Array.isArray(conflicts)) return [];
  return ['username', 'email'].filter((field): field is UserConflictField => conflicts.includes(field));
}

export function clearUserConflictFieldError(
  current: UserConflictFieldErrors,
  field: UserConflictField,
): UserConflictFieldErrors {
  return { ...current, [field]: false };
}

const knownBackendMessages: Record<string, string> = {
  'ชื่อผู้ใช้หรืออีเมลนี้มีอยู่ในระบบแล้ว': 'The username or email is already in use.',
  'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง': 'The username or password is incorrect.',
  'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ': 'Your account is suspended. Contact an administrator.',
  'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน': 'Your account is suspended. Contact an administrator.',
  'ลองเข้าสู่ระบบมากเกินไป กรุณารอ 15 วินาที': 'Too many sign-in attempts. Please wait 15 seconds.',
  'รหัส 2FA หมดอายุแล้ว (เกิน 3 นาที) กรุณาเข้าสู่ระบบใหม่อีกครั้ง': 'The verification code has expired. Sign in again.',
  'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง': 'The verification code is incorrect. Try again.',
  'กรอกรหัส OTP ผิดครบ 5 ครั้ง กรุณาเข้าสู่ระบบใหม่': 'Too many incorrect verification codes. Sign in again.',
  'ชื่อผู้ใช้ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข และ . _ - เท่านั้น (3-64 ตัว)': 'Username may contain only English letters, numbers, and . _ - (3-64 characters).',
  'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก ในรูปแบบ 000-000-0000': 'Phone number must contain 10 digits in the format 000-000-0000.',
};

export function localizedApiError(error: unknown, fallback: string): string {
  const apiError = error as ApiErrorShape;
  const code = apiError?.response?.data?.code;
  if (code === 'USER_CONFLICT') {
    const conflicts = getUserConflictFields(error);
    const messageKey = conflicts.length === 2
      ? 'This username and email are already in use. Please change both.'
      : conflicts[0] === 'username'
        ? 'This username is already in use. Please choose another username.'
        : conflicts[0] === 'email'
          ? 'This email is already in use. Please use another email.'
          : 'The username or email is already in use.';
    return i18n.t(messageKey, { ns: 'common' });
  }
  if (code === 'INVALID_PSU_ORGANIZATION') {
    return i18n.t('Select a valid PSU Hat Yai organization.', { ns: 'common' });
  }
  const message = apiError?.response?.data?.message;
  if (typeof message === 'string' && knownBackendMessages[message]) {
    return i18n.t(knownBackendMessages[message], { ns: 'common' });
  }
  if (apiError?.response?.status === 429) {
    return i18n.t('Too many requests. Please try again shortly.', { ns: 'common' });
  }
  return fallback;
}
