import assert from 'node:assert/strict';
import { createServer, request as httpRequest, type Server } from 'node:http';
import test, { type TestContext } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET ||= 'test-only-secret-that-is-long-enough-for-local-tests';

type AnyRecord = Record<string, any>;

function stubMethod(t: TestContext, target: AnyRecord, methodName: string, implementation: (...args: any[]) => any): void {
  const original = target[methodName];
  Object.defineProperty(target, methodName, { configurable: true, writable: true, value: implementation });
  t.after(() => Object.defineProperty(target, methodName, { configurable: true, writable: true, value: original }));
}

function send(server: Server, body: unknown, token: string, language = 'th'): Promise<{ status: number; body: AnyRecord }> {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: '127.0.0.1',
      port: address.port,
      path: '/api/exams/41/print',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': language,
        Authorization: `Bearer ${token}`,
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
    request.end(JSON.stringify(body));
  });
}

async function setup(t: TestContext, examOverrides: AnyRecord = {}) {
  const [{ default: avRoutes }, { prisma }, { JWT_SECRET }, { ExamStatus, UserRole }] = await Promise.all([
    import('./avRoutes'),
    import('../database/prisma'),
    import('../config/constants'),
    import('../../generated/prisma'),
  ]);

  const avStaff = {
    id: 17,
    username: 'qa-av-staff',
    fullName: 'QA AV Staff',
    email: 'qa-av-staff@example.test',
    role: UserRole.AV_STAFF,
    department: 'QA',
    phone: null,
    officeRoom: null,
    isActive: true,
    mustChangePassword: false,
    sessionVersion: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const exam: AnyRecord = {
    id: 41,
    status: ExamStatus.APPROVED,
    paperSize: 'A4',
    isDoubleSided: true,
    numCopies: 20,
    ...examOverrides,
  };
  const printRecords: AnyRecord[] = [];
  const examUpdates: AnyRecord[] = [];
  const auditLogs: AnyRecord[] = [];

  stubMethod(t, prisma.user, 'findUnique', async () => avStaff);
  stubMethod(t, prisma.exam, 'findUnique', async () => exam);
  stubMethod(t, prisma.printRecord, 'create', async ({ data }: AnyRecord) => {
    printRecords.push(data);
    return { id: printRecords.length, ...data };
  });
  stubMethod(t, prisma.exam, 'update', async ({ data }: AnyRecord) => {
    examUpdates.push(data);
    Object.assign(exam, data);
    return exam;
  });
  stubMethod(t, prisma.examStatusHistory, 'create', async ({ data }: AnyRecord) => data);
  stubMethod(t, prisma.auditLog, 'create', async ({ data }: AnyRecord) => {
    auditLogs.push(data);
    return data;
  });
  stubMethod(t, prisma, '$transaction', async (operations: Promise<unknown>[]) => Promise.all(operations));

  const app = express();
  app.use(express.json());
  app.use('/api/exams', avRoutes);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const token = jwt.sign({ id: avStaff.id, username: avStaff.username, sessionVersion: 0 }, JWT_SECRET);
  return {
    post: (body: unknown, language?: string) => send(server, body, token, language),
    printRecords,
    exam,
    examUpdates,
    auditLogs,
    ExamStatus,
  };
}

test('server derives the canonical double-sided specification and preserves Mark as Printed behavior', async (t) => {
  const state = await setup(t);
  const response = await state.post({
    printed_copies: 7,
    paper_weight: '80gsm',
    paper_type: 'client value must not be trusted',
    paper_size: 'Letter',
    is_double_sided: false,
    notes: 'QA note',
    mark_completed: true,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, state.ExamStatus.PRINTED);
  assert.equal(state.printRecords[0].paperType, 'A4 80gsm หน้า-หลัง');
  assert.equal(state.printRecords[0].printedCopies, 7);
  assert.equal(state.printRecords[0].notes, 'QA note');
  assert.match(state.auditLogs[0].detailJson, /"paper_type":"A4 80gsm หน้า-หลัง"/);
  assert.doesNotMatch(state.auditLogs[0].detailJson, /client value must not be trusted/);
  assert.deepEqual(state.examUpdates, [{ status: state.ExamStatus.PRINTED }]);
});

test('server uses the exam single-sided setting and canonical storage is independent of UI locale', async (t) => {
  const state = await setup(t, { isDoubleSided: false });
  const body = { printed_copies: 3, paper_weight: '80gsm', mark_completed: false };

  const thaiResponse = await state.post(body, 'th');
  const englishResponse = await state.post(body, 'en');

  assert.equal(thaiResponse.status, 200);
  assert.equal(englishResponse.status, 200);
  assert.deepEqual(state.printRecords.map((record) => record.paperType), [
    'A4 80gsm หน้าเดียว',
    'A4 80gsm หน้าเดียว',
  ]);
  assert.equal(state.exam.status, state.ExamStatus.PRINTING);
});

test('unsupported weights and exam paper sizes return 400 without creating print records', async (t) => {
  const unsupportedWeight = await setup(t);
  const weightResponse = await unsupportedWeight.post({ paper_weight: '90gsm', mark_completed: true });
  assert.equal(weightResponse.status, 400);
  assert.equal(weightResponse.body.code, 'UNSUPPORTED_PRINT_SPEC');
  assert.equal(unsupportedWeight.printRecords.length, 0);

  const unsupportedSize = await setup(t, { paperSize: 'Letter' });
  const sizeResponse = await unsupportedSize.post({ paper_weight: '80gsm', mark_completed: true });
  assert.equal(sizeResponse.status, 400);
  assert.equal(sizeResponse.body.code, 'UNSUPPORTED_PRINT_SPEC');
  assert.equal(unsupportedSize.printRecords.length, 0);
  assert.equal(unsupportedSize.exam.paperSize, 'Letter');
});
