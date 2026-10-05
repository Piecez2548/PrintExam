const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseCalendarDate(value: unknown): [year: number, month: number, day: number] | null {
  if (typeof value !== 'string') return null;
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return null;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysPerMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysPerMonth[month - 1]) return null;

  return [year, month, day];
}

export function isValidCalendarDate(value: unknown): value is string {
  return parseCalendarDate(value) !== null;
}

/** Normalizes legacy ISO timestamps to their stored UTC calendar-date prefix. */
export function normalizeStoredCalendarDate(value: unknown): string | null {
  if (isValidCalendarDate(value)) return value;
  if (typeof value !== 'string') return null;

  const match = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.exec(value);
  if (!match || !isValidCalendarDate(match[1])) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value ? null : match[1];
}

/** Uses UTC fields solely as a timezone-independent Gregorian calendar calculator. */
export function getLatestAllowedDeadlineDate(examDate: unknown): string | null {
  const parsed = parseCalendarDate(examDate);
  if (!parsed) return null;

  const [year, month, day] = parsed;
  const calendarDate = new Date(0);
  calendarDate.setUTCHours(0, 0, 0, 0);
  calendarDate.setUTCFullYear(year, month - 1, day - 2);

  return [
    String(calendarDate.getUTCFullYear()).padStart(4, '0'),
    String(calendarDate.getUTCMonth() + 1).padStart(2, '0'),
    String(calendarDate.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function isDeadlineAtLeastTwoDaysBeforeExam(deadlineDate: unknown, examDate: unknown): boolean {
  if (!isValidCalendarDate(deadlineDate)) return false;
  const latestDeadlineDate = getLatestAllowedDeadlineDate(examDate);
  return latestDeadlineDate !== null && deadlineDate <= latestDeadlineDate;
}
