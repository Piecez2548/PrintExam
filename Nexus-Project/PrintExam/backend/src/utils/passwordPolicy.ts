const COMMON_PASSWORDS = new Set(['password123', '123456789012', 'qwertyuiop12', 'admin12345678']);

export function validatePassword(password: string): string | null {
  if (password.length < 12) return 'รหัสผ่านต้องมีความยาวอย่างน้อย 12 ตัวอักษร';
  if (password.length > 128) return 'รหัสผ่านต้องไม่ยาวเกิน 128 ตัวอักษร';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'รหัสผ่านนี้คาดเดาง่ายเกินไป กรุณาเลือกรหัสอื่น';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'รหัสผ่านต้องมีตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ ตัวเลข และอักขระพิเศษ';
  }
  return null;
}
