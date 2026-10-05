import i18n from '../i18n';

interface ApiErrorShape {
  response?: {
    status?: number;
    data?: { code?: unknown; message?: unknown };
  };
}

const knownBackendMessages: Record<string, string> = {
  'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง': 'The username or password is incorrect.',
  'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ': 'Your account is suspended. Contact an administrator.',
  'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน': 'Your account is suspended. Contact an administrator.',
  'ลองเข้าสู่ระบบมากเกินไป กรุณารอ 15 วินาที': 'Too many sign-in attempts. Please wait 15 seconds.',
  'รหัส 2FA หมดอายุแล้ว (เกิน 3 นาที) กรุณาเข้าสู่ระบบใหม่อีกครั้ง': 'The verification code has expired. Sign in again.',
  'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง': 'The verification code is incorrect. Try again.',
  'กรอกรหัส OTP ผิดครบ 5 ครั้ง กรุณาเข้าสู่ระบบใหม่': 'Too many incorrect verification codes. Sign in again.',
};

export function localizedApiError(error: unknown, fallback: string): string {
  const apiError = error as ApiErrorShape;
  const message = apiError?.response?.data?.message;
  if (typeof message === 'string' && knownBackendMessages[message]) {
    return i18n.t(knownBackendMessages[message], { ns: 'common' });
  }
  if (apiError?.response?.status === 429) {
    return i18n.t('Too many requests. Please try again shortly.', { ns: 'common' });
  }
  return fallback;
}
