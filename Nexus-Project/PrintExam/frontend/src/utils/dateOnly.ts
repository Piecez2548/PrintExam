const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function getDateParts(value: string): [number, number, number] | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return [year, month, day];
}

export const isValidDateOnly = (value: string): boolean => getDateParts(value) !== null;

export const addCalendarDays = (value: string, days: number): string => {
  const parts = getDateParts(value);
  if (!parts || !Number.isInteger(days)) return '';

  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-');
};

export const toDateInputValue = (value?: string | Date): string => {
  if (!value) return '';
  if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) return isValidDateOnly(value) ? value : '';

  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const formatDateOnlyThai = (value?: string | Date): string => {
  if (!value) return '';
  const dateOnly = typeof value === 'string' ? getDateParts(value) : null;
  const date = dateOnly
    ? new Date(dateOnly[0], dateOnly[1] - 1, dateOnly[2])
    : typeof value === 'string'
      ? new Date(value)
      : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

export const formatDateOnlyThaiShort = (value?: string | Date): string => {
  if (!value) return '';
  const dateOnly = typeof value === 'string' ? getDateParts(value) : null;
  const date = dateOnly
    ? new Date(dateOnly[0], dateOnly[1] - 1, dateOnly[2])
    : typeof value === 'string'
      ? new Date(value)
      : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('th-TH');
};
