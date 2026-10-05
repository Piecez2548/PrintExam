export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;

export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isCompletePhone(value: string): boolean {
  return /^\d{3}-\d{3}-\d{4}$/.test(value);
}
