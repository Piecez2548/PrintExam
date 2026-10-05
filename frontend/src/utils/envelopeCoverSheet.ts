import type { Exam } from '../types/index.ts';

export interface EnvelopeCoverSheetViewModel {
  courseCode: string;
  courseName: string;
  department: string;
  section: string;
  semester: string;
  academicYear: string;
  examType: string;
  examDay: string;
  examMonth: string;
  examYear: string;
  examTime: string;
  examRoom: string;
  studentCount: string;
  examCopyCount: string;
  reserveCopyCount: string;
  instructorName: string;
  officeRoom: string;
  instructorPhone: string;
  envelopeIdentifier: string;
  specialInstructions: string;
  permittedBooks: boolean;
  permittedCalculator: boolean;
  prohibitsFormulaRuler: boolean;
}

const displayValue = (value: string | number | null | undefined): string =>
  value === null || value === undefined || value === '' ? '-' : String(value);

function formatExamDate(dateValue: string | undefined, language: string) {
  const match = dateValue?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { day: '-', month: '-', year: '-' };

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
    return { day: '-', month: '-', year: '-' };
  }

  const locale = language === 'en' ? 'en-US' : 'th-TH';
  return {
    day: String(date.getDate()),
    month: date.toLocaleDateString(locale, { month: 'long' }),
    year: new Intl.DateTimeFormat(locale, { year: 'numeric' })
      .formatToParts(date)
      .find((part) => part.type === 'year')?.value ?? '-',
  };
}

function parseAllowedMaterials(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** Resolves one cover-sheet data object for both the screen preview and browser print. */
export function resolveEnvelopeCoverSheet(exam: Exam, language: string): EnvelopeCoverSheetViewModel {
  const date = formatExamDate(exam.exam_date, language);
  const materials = parseAllowedMaterials(exam.allowed_materials);
  const examTime = exam.start_time && exam.end_time
    ? `${exam.start_time} - ${exam.end_time}`
    : '-';

  return {
    courseCode: displayValue(exam.course_code),
    courseName: displayValue(exam.course_name),
    department: displayValue(exam.department),
    section: displayValue(exam.section),
    semester: displayValue(exam.semester),
    academicYear: displayValue(exam.academic_year),
    examType: displayValue(exam.exam_type),
    examDay: date.day,
    examMonth: date.month,
    examYear: date.year,
    examTime,
    examRoom: displayValue(exam.room),
    studentCount: displayValue(exam.student_count),
    // Match the authoritative Exam.numCopies used by the backend PDF; printedCopies
    // is an operational print-record count and is not the scheduled envelope quantity.
    examCopyCount: displayValue(exam.num_copies),
    reserveCopyCount: displayValue(exam.reserve_copies),
    instructorName: displayValue(exam.instructor_name),
    officeRoom: displayValue(exam.instructor_office_room),
    instructorPhone: displayValue(exam.instructor_phone),
    envelopeIdentifier: `ENV-${exam.course_code}-${exam.id}`,
    specialInstructions: exam.special_instructions || '',
    permittedBooks: materials.includes('BOOK'),
    permittedCalculator: materials.includes('CALCULATOR'),
    prohibitsFormulaRuler: materials.includes('NO_FORMULA_RULER'),
  };
}
