export const USERNAME_PATTERN_SOURCE = '[A-Za-z0-9._-]{3,64}';
export const USERNAME_PATTERN = new RegExp(`^${USERNAME_PATTERN_SOURCE}$`);

export const USERNAME_RULE_MESSAGE =
  'Username ใช้ได้เฉพาะ A-Z, a-z, 0-9, จุด (.), ขีดล่าง (_) และขีดกลาง (-) ความยาว 3-64 ตัวอักษร';

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}
