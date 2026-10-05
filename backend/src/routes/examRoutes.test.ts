import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, request as httpRequest, type Server } from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

process.env.JWT_SECRET ||= 'test-only-secret-that-is-long-enough-for-local-tests';

type AnyRecord = Record<string, any>;

function stubMethod(target: AnyRecord, methodName: string, implementation: (...args: any[]) => any): () => void {
  const original = target[methodName];
  Object.defineProperty(target, methodName, { configurable: true, writable: true, value: implementation });
  return () => Object.defineProperty(target, methodName, { configurable: true, writable: true, value: original });
}

function getExam(server: Server, token: string): Promise<{ status: number; body: AnyRecord }> {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: '127.0.0.1',
      port: address.port,
      path: '/api/exams/41',
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {},
      }));
    });
    request.on('error', reject);
    request.end();
  });
}

function updateExam(server: Server, token: string, fields: Record<string, string>): Promise<{ status: number; body: AnyRecord }> {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const boundary = '----PrintExamAuditRegressionBoundary';
  const body = `${Object.entries(fields).map(([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`).join('')}--${boundary}--\r\n`;
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: '127.0.0.1',
      port: address.port,
      path: '/api/exams/41',
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {},
      }));
    });
    request.on('error', reject);
    request.end(body);
  });
}

async function setupExamUpdate(t: import('node:test').TestContext) {
  const [{ default: examRoutes }, { prisma }, { JWT_SECRET }, { UserRole, ExamStatus }] = await Promise.all([
    import('./examRoutes'),
    import('../database/prisma'),
    import('../config/constants'),
    import('../../generated/prisma'),
  ]);
  const instructor = {
    id: 10,
    username: 'qa-instructor',
    fullName: 'QA Instructor',
    email: 'qa-instructor@example.test',
    role: UserRole.INSTRUCTOR,
    department: 'QA',
    phone: null,
    officeRoom: null,
    isActive: true,
    mustChangePassword: false,
    sessionVersion: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const persisted: AnyRecord = {
    id: 41,
    courseId: 52,
    scheduleId: null,
    status: ExamStatus.DRAFT,
    createdById: instructor.id,
    deadlineAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
    submittedAt: null,
    fileUrl: '/uploads/existing.pdf',
    originalFilename: 'existing.pdf',
    fileType: 'application/pdf',
    fileSize: 100,
    numCopies: 2,
    studentCount: 1,
    reserveCopies: 1,
    section: '01',
    numPages: 2,
    examLanguage: 'THAI',
    printFormat: 'DOUBLE_SIDED',
    allowedMaterials: null,
    requiresAnswerSheet: false,
    examSessionType: 'IN_SCHEDULE',
    specialInstructions: null,
    isDoubleSided: true,
    paperSize: 'A4',
  };
  const audits: AnyRecord[] = [];
  const tx = {
    exam: {
      findUnique: async () => ({ ...persisted }),
      update: async ({ data }: AnyRecord) => {
        for (const [key, value] of Object.entries(data)) if (value !== undefined) persisted[key] = value;
        return { ...persisted };
      },
    },
    auditLog: { create: async ({ data }: AnyRecord) => { audits.push(data); return data; } },
    examStatusHistory: { create: async () => ({}) },
  };
  const restoreUser = stubMethod(prisma.user, 'findUnique', async () => instructor);
  const restoreExam = stubMethod(prisma.exam, 'findUnique', async () => ({ ...persisted }));
  const restoreTransaction = stubMethod(prisma, '$transaction', async (operation: any) => operation(tx));
  t.after(restoreUser);
  t.after(restoreExam);
  t.after(restoreTransaction);

  const app = express();
  app.use('/api/exams', examRoutes);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const token = jwt.sign({ id: instructor.id, username: instructor.username, sessionVersion: 0 }, JWT_SECRET);
  return { server, token, persisted, audits, instructor };
}

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

test('audit change payload records one and multiple effective fields and suppresses no-op values', async () => {
  const { buildAuditChanges } = await import('../data/auditTrail');
  const changes = buildAuditChanges(
    { exam_date: '2026-10-19', room: 'L1', student_count: 40 },
    { exam_date: '2026-10-20', room: 'L2', student_count: 40 },
    ['exam_date', 'room', 'student_count']
  );

  assert.deepEqual(changes, {
    exam_date: { before: '2026-10-19', after: '2026-10-20' },
    room: { before: 'L1', after: 'L2' },
  });
  assert.equal(Object.keys(buildAuditChanges({ room: 'L1' }, { room: 'L1' }, ['room'])).length, 0);
});

test('audit trail sorts newest first and breaks equal timestamps by descending event id', async () => {
  const { sortAuditTrail } = await import('../data/auditTrail');
  const sorted = sortAuditTrail([
    { id: 5, event_type: 'STATUS_CHANGE', action_at: '2026-10-01T10:00:00.000Z' },
    { id: 7, event_type: 'DATA_EDIT', action_at: '2026-10-01T11:00:00.000Z' },
    { id: 6, event_type: 'STATUS_CHANGE', action_at: '2026-10-01T10:00:00.000Z' },
  ]);

  assert.deepEqual(sorted.map(({ id }) => id), [7, 6, 5]);
});

test('audit metadata redacts credential-like values and sensitive nested keys', async () => {
  const { buildAuditChanges, parseAuditChanges } = await import('../data/auditTrail');
  const changes = buildAuditChanges(
    { special_instructions: 'password=old-value', token: 'old-token' },
    { special_instructions: 'Bring a calculator', token: 'new-token' },
    ['special_instructions', 'token']
  );

  assert.deepEqual(changes, {
    special_instructions: { before: '[REDACTED]', after: 'Bring a calculator' },
    token: { before: '[REDACTED]', after: '[REDACTED]' },
  });
  assert.doesNotMatch(JSON.stringify(changes), /old-value|old-token|new-token/);
  assert.equal(parseAuditChanges(JSON.stringify({ changes: { room: { before: 'A', after: 'B' } } })), null);
  assert.deepEqual(parseAuditChanges(JSON.stringify({ audit_version: 1, changes: { room: { before: 'A', after: 'B' }, password: { before: 'x', after: 'y' } } })), {
    room: { before: 'A', after: 'B' },
  });
});

test('exam edit changing only num_copies preserves student_count, reserve_copies, and unset instructions', async (t) => {
  const state = await setupExamUpdate(t);
  const response = await updateExam(state.server, state.token, { num_copies: '333' });

  assert.equal(response.status, 200);
  assert.equal(state.persisted.numCopies, 333);
  assert.equal(state.persisted.studentCount, 1);
  assert.equal(state.persisted.reserveCopies, 1);
  assert.equal(state.persisted.specialInstructions, null);
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].userId, state.instructor.id);
  assert.equal(state.audits[0].userRole, 'INSTRUCTOR');
  const details = JSON.parse(state.audits[0].detailJson);
  assert.deepEqual(details.changes, { num_copies: { before: 2, after: 333 } });
});

test('exam edit changing only student_count records only student_count', async (t) => {
  const state = await setupExamUpdate(t);
  const response = await updateExam(state.server, state.token, { student_count: '8' });

  assert.equal(response.status, 200);
  assert.equal(state.persisted.numCopies, 2);
  assert.equal(state.persisted.studentCount, 8);
  assert.equal(state.persisted.reserveCopies, 1);
  assert.deepEqual(JSON.parse(state.audits[0].detailJson).changes, {
    student_count: { before: 1, after: 8 },
  });
});

test('exam edit changing only reserve_copies preserves student count and copies', async (t) => {
  const state = await setupExamUpdate(t);
  const response = await updateExam(state.server, state.token, { reserve_copies: '4' });

  assert.equal(response.status, 200);
  assert.equal(state.persisted.numCopies, 2);
  assert.equal(state.persisted.studentCount, 1);
  assert.equal(state.persisted.reserveCopies, 4);
  assert.deepEqual(JSON.parse(state.audits[0].detailJson).changes, {
    reserve_copies: { before: 1, after: 4 },
  });
});

test('exam edit changing copies and student count records exactly both persisted fields', async (t) => {
  const state = await setupExamUpdate(t);
  const response = await updateExam(state.server, state.token, { num_copies: '5', student_count: '4' });

  assert.equal(response.status, 200);
  assert.equal(state.persisted.numCopies, 5);
  assert.equal(state.persisted.studentCount, 4);
  assert.deepEqual(JSON.parse(state.audits[0].detailJson).changes, {
    num_copies: { before: 2, after: 5 },
    student_count: { before: 1, after: 4 },
  });
});

test('blank optional instructions normalize to null and do not create a phantom audit event', async (t) => {
  const state = await setupExamUpdate(t);
  const response = await updateExam(state.server, state.token, { special_instructions: '   ' });

  assert.equal(response.status, 200);
  assert.equal(state.persisted.specialInstructions, null);
  assert.equal(state.audits.length, 0);
});

test('editing only page count preserves other exam fields and the existing file when no replacement is selected', async (t) => {
  const state = await setupExamUpdate(t);
  const response = await updateExam(state.server, state.token, { num_pages: '7' });

  assert.equal(response.status, 200);
  assert.equal(state.persisted.numPages, 7);
  assert.equal(state.persisted.numCopies, 2);
  assert.equal(state.persisted.studentCount, 1);
  assert.equal(state.persisted.reserveCopies, 1);
  assert.equal(state.persisted.fileUrl, '/uploads/existing.pdf');
  assert.equal(state.persisted.originalFilename, 'existing.pdf');
  assert.deepEqual(JSON.parse(state.audits[0].detailJson).changes, {
    num_pages: { before: 2, after: 7 },
  });
});

test('controlled exam options persist together in one audit event and use the authenticated actor', async (t) => {
  const state = await setupExamUpdate(t);
  const response = await updateExam(state.server, state.token, {
    exam_language: 'ENGLISH',
    print_format: 'SINGLE_SIDED',
    is_double_sided: 'false',
    allowed_materials: JSON.stringify(['CALCULATOR', 'OTHER:Graphing calculator']),
    requires_answer_sheet: 'true',
    user_id: '999',
    actor_name: 'Spoofed Actor',
  });

  assert.equal(response.status, 200);
  assert.equal(state.persisted.examLanguage, 'ENGLISH');
  assert.equal(state.persisted.printFormat, 'SINGLE_SIDED');
  assert.equal(state.persisted.isDoubleSided, false);
  assert.equal(state.persisted.allowedMaterials, JSON.stringify(['CALCULATOR', 'OTHER:Graphing calculator']));
  assert.equal(state.persisted.requiresAnswerSheet, true);
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].userId, state.instructor.id);
  assert.equal(state.audits[0].userName, state.instructor.fullName);
  assert.equal(state.audits[0].userRole, 'INSTRUCTOR');
  assert.deepEqual(Object.keys(JSON.parse(state.audits[0].detailJson).changes).sort(), [
    'allowed_materials', 'exam_language', 'is_double_sided', 'print_format', 'requires_answer_sheet',
  ]);
  assert.doesNotMatch(state.audits[0].detailJson, /Spoofed Actor|999/);
});

test('unsupported controlled exam values are rejected without changing the record', async (t) => {
  const invalidCases: Array<Record<string, string>> = [
    { exam_language: 'THAI;DROP' },
    { print_format: 'INVALID_FORMAT' },
    { print_format: 'BOOKLET', is_double_sided: 'false' },
    { allowed_materials: JSON.stringify(['UNLISTED_MATERIAL']) },
    { allowed_materials: JSON.stringify(['NONE', 'BOOK']) },
    { requires_answer_sheet: 'yes' },
  ];

  for (const invalidFields of invalidCases) {
    const state = await setupExamUpdate(t);
    const response = await updateExam(state.server, state.token, invalidFields);
    assert.equal(response.status, 400);
    assert.equal(state.persisted.examLanguage, 'THAI');
    assert.equal(state.persisted.printFormat, 'DOUBLE_SIDED');
    assert.equal(state.persisted.allowedMaterials, null);
    assert.equal(state.audits.length, 0);
  }
});

test('no-op edit of a submitted exam does not create an audit event', async (t) => {
  const state = await setupExamUpdate(t);
  state.persisted.status = 'SUBMITTED';
  const response = await updateExam(state.server, state.token, {});

  assert.equal(response.status, 200);
  assert.equal(state.persisted.status, 'SUBMITTED');
  assert.equal(state.audits.length, 0);
});

test('replacement file still requires valid PDF magic bytes', async (t) => {
  const { validateUploadedFileMagic } = await import('../middleware/upload');
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'printexam-edit-file-test-'));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const validPdf = path.join(tempDir, 'replacement.pdf');
  const fakePdf = path.join(tempDir, 'fake.pdf');
  await writeFile(validPdf, Buffer.from('%PDF-1.7\nvalid test fixture', 'ascii'));
  await writeFile(fakePdf, Buffer.from('<html>not a PDF</html>', 'ascii'));

  assert.equal(await validateUploadedFileMagic(validPdf), true);
  assert.equal(await validateUploadedFileMagic(fakePdf), false);
});

test('audit comparison suppresses equivalent empty optional values but preserves meaningful empty values elsewhere', async () => {
  const { buildAuditChanges } = await import('../data/auditTrail');
  assert.deepEqual(buildAuditChanges(
    { special_instructions: null, allowed_materials: undefined, course_name: '' },
    { special_instructions: '', allowed_materials: null, course_name: 'Course' },
    ['special_instructions', 'allowed_materials', 'course_name']
  ), { course_name: { before: '', after: 'Course' } });
});

test('exam detail refetch returns persisted audit events newest first with authenticated actors', async (t) => {
  const [{ default: examRoutes }, { prisma }, { JWT_SECRET }, { UserRole, ExamStatus }] = await Promise.all([
    import('./examRoutes'),
    import('../database/prisma'),
    import('../config/constants'),
    import('../../generated/prisma'),
  ]);
  const instructor = {
    id: 10,
    username: 'qa-instructor',
    fullName: 'QA Instructor',
    email: 'qa-instructor@example.test',
    role: UserRole.INSTRUCTOR,
    department: 'QA',
    phone: null,
    officeRoom: null,
    isActive: true,
    mustChangePassword: false,
    sessionVersion: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const exam = {
    id: 41,
    courseId: 52,
    scheduleId: 74,
    status: ExamStatus.DRAFT,
    createdById: instructor.id,
    createdBy: { fullName: instructor.fullName },
    course: { instructorId: instructor.id, courseCode: 'QA-101', courseName: 'QA Course', instructor: { fullName: instructor.fullName } },
    schedule: { id: 74, examDate: '2026-10-19', startTime: '09:00', endTime: '12:00', room: 'L2', examType: 'FINAL', coordinator: null },
    deadlineAt: new Date('2026-10-17T16:59:59.999Z'),
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    statusHistory: [{
      id: 3,
      examId: 41,
      fromStatus: null,
      toStatus: ExamStatus.DRAFT,
      actionById: instructor.id,
      actionName: instructor.fullName,
      actionAt: new Date('2026-10-01T00:00:00.000Z'),
      note: 'Saved draft',
      actionBy: { role: UserRole.INSTRUCTOR },
    }],
    printRecords: [],
    packingRecords: [],
    deliveryRecords: [],
  };
  const persistedEdit = {
    id: 12,
    userId: 31,
    userName: 'QA Coordinator',
    userRole: UserRole.COORDINATOR,
    action: 'UPDATE_SCHEDULE',
    entityType: 'SCHEDULE',
    entityId: '74',
    detailJson: JSON.stringify({ audit_version: 1, changes: { room: { before: 'L1', after: 'L2' } } }),
    createdAt: new Date('2026-10-02T00:00:00.000Z'),
  };
  let auditReads = 0;
  const restoreUser = stubMethod(prisma.user, 'findUnique', async () => instructor);
  const restoreExam = stubMethod(prisma.exam, 'findUnique', async () => exam);
  const restoreAudit = stubMethod(prisma.auditLog, 'findMany', async () => { auditReads += 1; return [persistedEdit]; });
  t.after(restoreUser);
  t.after(restoreExam);
  t.after(restoreAudit);

  const app = express();
  app.use('/api/exams', examRoutes);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const token = jwt.sign({ id: instructor.id, username: instructor.username, sessionVersion: 0 }, JWT_SECRET);

  const first = await getExam(server, token);
  const second = await getExam(server, token);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(auditReads, 2);
  assert.deepEqual(second.body.data.audit_trail.map((event: AnyRecord) => event.event_type), ['DATA_EDIT', 'STATUS_CHANGE']);
  assert.equal(second.body.data.audit_trail[0].action_at, persistedEdit.createdAt.toISOString());
  assert.equal(second.body.data.audit_trail[0].action_name, 'QA Coordinator');
  assert.equal(second.body.data.audit_trail[0].action_role, UserRole.COORDINATOR);
  assert.deepEqual(second.body.data.audit_trail[0].changes.room, { before: 'L1', after: 'L2' });
});
