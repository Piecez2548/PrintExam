import assert from 'node:assert/strict';
import test from 'node:test';
import type { Exam } from '../types/index.ts';
import { resolveEnvelopeCoverSheet } from './envelopeCoverSheet.ts';

const exam = (overrides: Partial<Exam> = {}): Exam => ({
  id: 52,
  course_id: 11,
  course_code: 'CS101',
  course_name: 'Introduction to Computing',
  department: 'Faculty of Science',
  semester: 2,
  academic_year: '2569',
  exam_type: 'FINAL',
  exam_date: '2026-10-04',
  start_time: '09:00',
  end_time: '12:00',
  room: 'CB-2301',
  num_copies: 42,
  printed_copies: 500,
  student_count: 40,
  reserve_copies: 2,
  instructor_name: 'Example Instructor',
  instructor_phone: '074000000',
  instructor_office_room: 'SCI-201',
  allowed_materials: '["BOOK","CALCULATOR"]',
  special_instructions: 'No smart watches',
  num_pages: 1,
  is_double_sided: true,
  paper_size: 'A4',
  status: 'PRINTED' as Exam['status'],
  created_by: 1,
  deadline_at: '',
  created_at: '',
  updated_at: '',
  ...overrides,
});

test('cover sheet resolves the authoritative exam, schedule and course fields', () => {
  const cover = resolveEnvelopeCoverSheet(exam(), 'en');
  assert.equal(cover.courseCode, 'CS101');
  assert.equal(cover.courseName, 'Introduction to Computing');
  assert.equal(cover.department, 'Faculty of Science');
  assert.equal(cover.section, '-');
  assert.equal(cover.semester, '2');
  assert.equal(cover.academicYear, '2569');
  assert.equal(cover.examType, 'FINAL');
  assert.equal(cover.examDay, '4');
  assert.equal(cover.examMonth, 'October');
  assert.equal(cover.examYear, '2026');
  assert.equal(cover.examTime, '09:00 - 12:00');
  assert.equal(cover.examRoom, 'CB-2301');
  assert.equal(cover.studentCount, '40');
  assert.equal(cover.examCopyCount, '42');
  assert.equal(cover.reserveCopyCount, '2');
  assert.equal(cover.instructorName, 'Example Instructor');
  assert.equal(cover.officeRoom, 'SCI-201');
  assert.equal(cover.instructorPhone, '074000000');
  assert.equal(cover.envelopeIdentifier, 'ENV-CS101-52');
  assert.equal(cover.specialInstructions, 'No smart watches');
  assert.equal(cover.permittedBooks, true);
  assert.equal(cover.permittedCalculator, true);
  assert.equal(cover.prohibitsFormulaRuler, false);
});

test('missing cover data remains missing instead of using defaults or derived counts', () => {
  const cover = resolveEnvelopeCoverSheet(exam({
    department: undefined,
    exam_date: undefined,
    start_time: undefined,
    end_time: undefined,
    room: undefined,
    student_count: undefined,
    num_copies: undefined as unknown as number,
    reserve_copies: undefined,
    instructor_name: undefined,
    instructor_phone: undefined,
    instructor_office_room: undefined,
  }), 'th');
  assert.equal(cover.department, '-');
  assert.equal(cover.examDay, '-');
  assert.equal(cover.examMonth, '-');
  assert.equal(cover.examYear, '-');
  assert.equal(cover.examTime, '-');
  assert.equal(cover.examRoom, '-');
  assert.equal(cover.studentCount, '-');
  assert.equal(cover.examCopyCount, '-');
  assert.equal(cover.reserveCopyCount, '-');
  assert.equal(cover.instructorName, '-');
  assert.equal(cover.officeRoom, '-');
  assert.equal(cover.instructorPhone, '-');
});

test('date-only values are parsed without UTC day drift and invalid dates are not substituted', () => {
  const thai = resolveEnvelopeCoverSheet(exam({ exam_date: '2026-10-04' }), 'th');
  assert.equal(thai.examDay, '4');
  assert.equal(thai.examYear, '2569');
  const invalid = resolveEnvelopeCoverSheet(exam({ exam_date: '2026-02-31' }), 'en');
  assert.deepEqual([invalid.examDay, invalid.examMonth, invalid.examYear], ['-', '-', '-']);
});
