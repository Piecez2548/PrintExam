export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;

export const USERNAME_RULE_MESSAGE =
  'Username ต้องมีความยาว 3-64 ตัวอักษร และใช้ได้เฉพาะ A-Z, a-z, 0-9, จุด (.), ขีดล่าง (_) และขีดกลาง (-)';

export function isValidUsername(value: unknown): value is string {
  return typeof value === 'string' && USERNAME_PATTERN.test(value);
}

export function validateNewUsername(
  value: unknown,
): { ok: true; username: string } | { ok: false; message: string } {
  if (!isValidUsername(value)) {
    return { ok: false, message: USERNAME_RULE_MESSAGE };
  }

  return { ok: true, username: value };
}
