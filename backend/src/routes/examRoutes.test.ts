import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JWT_SECRET ||= 'test-only-secret-that-is-long-enough-for-local-tests';

test('date-only deadline remains open through 23:59 Thailand time', async () => {
  const { parseDeadlineAt } = await import('./examRoutes');
  assert.equal(parseDeadlineAt('2026-10-04').toISOString(), '2026-10-04T16:59:59.999Z');
});
test('submitted exam is editable only before the two-day lock', async () => {
  const { checkCanEditOrCancel } = await import('./examRoutes');
  const farDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const nearDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
  assert.equal(checkCanEditOrCancel({ status: 'SUBMITTED', deadlineAt: farDeadline }).allowed, true);
  assert.equal(checkCanEditOrCancel({ status: 'SUBMITTED', deadlineAt: nearDeadline }).allowed, false);
});

test('approved exam cannot be edited or cancelled', async () => {
  const { checkCanEditOrCancel } = await import('./examRoutes');
  const result = checkCanEditOrCancel({
    status: 'APPROVED',
    deadlineAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
  });
  assert.equal(result.allowed, false);
});

test('rejected exam remains correctable until its actual deadline', async () => {
  const { checkCanEditOrCancel } = await import('./examRoutes');
  const soon = new Date(Date.now() + 60 * 60 * 1000);
  const expired = new Date(Date.now() - 60 * 1000);
  assert.equal(checkCanEditOrCancel({ status: 'REJECTED', deadlineAt: soon }).allowed, true);
  assert.equal(checkCanEditOrCancel({ status: 'REJECTED', deadlineAt: expired }).allowed, false);
});

test('historical paper_type values remain readable exactly as stored', async () => {
  const { formatHistoricalPrintRecord } = await import('./examRoutes');
  const oldValues = ['A4', 'A4 80gsm', 'A4 80gsm หน้า-หลัง', 'legacy custom value'];

  for (const paperType of oldValues) {
    const record = formatHistoricalPrintRecord({
      id: 1,
      examId: 41,
      printedById: 17,
      printedBy: null,
      printedCopies: 4,
      paperType,
      printedAt: new Date('2026-01-01T00:00:00.000Z'),
      notes: null,
    });
    assert.equal(record.paper_type, paperType);
  }
});

test('exam response exposes the authoritative course department for cover sheets', async () => {
  const { formatExam } = await import('./examRoutes');
  const formatted = formatExam({
    id: 52,
    courseId: 11,
    numCopies: 42,
    studentCount: 40,
    reserveCopies: 2,
    course: {
      courseCode: 'CS101',
      courseName: 'Introduction to Computing',
      department: 'Faculty of Science',
      semester: 2,
      academicYear: '2569',
      instructorId: 6,
      instructor: { fullName: 'Example Instructor', phone: '074000000', officeRoom: 'SCI-201' },
    },
    schedule: {
      examDate: '2026-10-04',
      startTime: '09:00',
      endTime: '12:00',
      room: 'CB-2301',
      examType: 'FINAL',
      section: '01',
    },
  });

  assert.equal(formatted.department, 'Faculty of Science');
  assert.equal(formatted.student_count, 40);
  assert.equal(formatted.num_copies, 42);
  assert.equal(formatted.reserve_copies, 2);
  assert.equal(formatted.exam_date, '2026-10-04');
  assert.equal(formatted.room, 'CB-2301');
  assert.equal(formatted.section, '01');
});
