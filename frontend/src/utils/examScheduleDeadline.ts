const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseCalendarDate(value: string): [year: number, month: number, day: number] | null {
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

/** Preserves the calendar day in date-only values and legacy canonical UTC timestamps. */
export function normalizeStoredCalendarDate(value: string): string | null {
  if (parseCalendarDate(value)) return value;
  const match = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.exec(value);
  if (!match || !parseCalendarDate(match[1])) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value ? null : match[1];
}

export function getLatestAllowedDeadlineDate(examDate: string): string | null {
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

export function isDeadlineAtLeastTwoDaysBeforeExam(deadlineDate: string, examDate: string): boolean {
  const latestDeadlineDate = getLatestAllowedDeadlineDate(examDate);
  return parseCalendarDate(deadlineDate) !== null && latestDeadlineDate !== null && deadlineDate <= latestDeadlineDate;
}

export function reconcileDeadlineDate(currentDeadlineDate: string, examDate: string): string {
  const latestDeadlineDate = getLatestAllowedDeadlineDate(examDate);
  if (!latestDeadlineDate) return currentDeadlineDate;
  return currentDeadlineDate && isDeadlineAtLeastTwoDaysBeforeExam(currentDeadlineDate, examDate)
    ? currentDeadlineDate
    : latestDeadlineDate;
}

export function formatCalendarDate(value: string, locale: string): string {
  const parsed = parseCalendarDate(value);
  if (!parsed) return '';

  const [year, month, day] = parsed;
  const localCalendarDate = new Date(0);
  localCalendarDate.setHours(12, 0, 0, 0);
  localCalendarDate.setFullYear(year, month - 1, day);

  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(localCalendarDate);
}
