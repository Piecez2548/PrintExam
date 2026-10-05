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

function deleteExam(server: Server, token: string, body?: unknown): Promise<{ status: number; body: AnyRecord }> {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const bodyText = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: '127.0.0.1',
      port: address.port,
      path: '/api/exams/41/soft-delete',
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(bodyText === undefined ? {} : {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyText),
        }),
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve({ status: response.statusCode || 0, body: raw ? JSON.parse(raw) : {}, raw } as any);
      });
    });
    request.on('error', reject);
    request.end(bodyText);
  });
}

async function setup(t: TestContext, failAudit = false) {
  const [{ default: examRoutes }, { prisma }, { JWT_SECRET }, { UserRole, ExamStatus }, { auditMiddleware }] = await Promise.all([
    import('./examRoutes'),
    import('../database/prisma'),
    import('../config/constants'),
    import('../../generated/prisma'),
    import('../middleware/audit'),
  ]);
  const admin = {
    id: 7, username: 'qa-admin', fullName: 'QA Admin', email: 'qa-admin@example.test',
    role: UserRole.ADMIN, department: null, phone: null, officeRoom: null,
    isActive: true, mustChangePassword: false, sessionVersion: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'), deletedAt: null,
  };
  const exam: AnyRecord = {
    id: 41, deletedAt: null, status: ExamStatus.DELIVERED, fileUrl: '/uploads/exam-private.pdf',
    course: { courseCode: 'QA101', courseName: 'QA Course', instructor: { fullName: 'QA Instructor' } },
    schedule: { examType: 'FINAL', examDate: '2026-10-05' },
    _count: { statusHistory: 3, printRecords: 1, packingRecords: 1, deliveryRecords: 1 },
  };
  const audits: AnyRecord[] = [];
  let updates = 0;
  let findWhere: AnyRecord | undefined;
  let inTransaction = 0;
  stubMethod(t, prisma.user, 'findUnique', async () => admin);
  stubMethod(t, prisma, '$transaction', async (callback: (tx: AnyRecord) => Promise<unknown>) => {
    const priorDeletedAt = exam.deletedAt;
    inTransaction += 1;
    const tx = {
      exam: {
        findFirst: async ({ where }: AnyRecord) => {
          findWhere = where;
          return exam.deletedAt === null && where.deletedAt === null ? exam : null;
        },
        updateMany: async ({ where, data }: AnyRecord) => {
          if (exam.deletedAt !== null || where.deletedAt !== null) return { count: 0 };
          exam.deletedAt = data.deletedAt;
          updates += 1;
          return { count: 1 };
        },
      },
      auditLog: {
        create: async ({ data }: AnyRecord) => {
          if (failAudit) throw new Error('audit insert failed');
          audits.push(data);
          return data;
        },
      },
    };
    try {
      return await callback(tx);
    } catch (error) {
      exam.deletedAt = priorDeletedAt;
      throw error;
    }
  });

  const app = express();
  app.use(express.json());
  app.use('/api', auditMiddleware);
  app.use('/api/exams', examRoutes);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const token = jwt.sign({ id: admin.id, username: admin.username, sessionVersion: admin.sessionVersion }, JWT_SECRET);
  return { server, token, admin, exam, audits, updates: () => updates, findWhere: () => findWhere, transactions: () => inTransaction, UserRole };
}

test('ADMIN soft-deletes one exam, preserves record and history, and writes authenticated actor audit atomically', async (t) => {
  const state = await setup(t);
  const response = await deleteExam(state.server, state.token, { actor_user_id: 999, actor_role: 'INSTRUCTOR' });

  assert.equal(response.status, 200);
  assert.ok(state.exam.deletedAt instanceof Date);
  assert.equal(state.exam.status, 'DELIVERED');
  assert.deepEqual(state.exam._count, { statusHistory: 3, printRecords: 1, packingRecords: 1, deliveryRecords: 1 });
  assert.equal(state.updates(), 1);
  assert.equal(state.transactions(), 1);
  assert.deepEqual(state.findWhere(), { id: 41, deletedAt: null });
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].userId, state.admin.id);
  assert.equal(state.audits[0].userRole, state.UserRole.ADMIN);
  assert.equal(state.audits[0].action, 'EXAM_SOFT_DELETED');
  const detail = JSON.parse(state.audits[0].detailJson);
  assert.equal(detail.previous_status, 'DELIVERED');
  assert.equal(detail.actor_user_id, state.admin.id);
  assert.equal(detail.actor_role, state.UserRole.ADMIN);
  assert.equal(detail.deletion_mode, 'logical_delete');
  assert.equal(detail.retained_file, true);
  assert.doesNotMatch(state.audits[0].detailJson, /999|INSTRUCTOR/);
});

test('non-ADMIN roles are denied before any deletion transaction', async (t) => {
  const state = await setup(t);
  const actor = { ...state.admin, id: 8, role: state.UserRole.INSTRUCTOR };
  const [{ prisma }, { JWT_SECRET }] = await Promise.all([import('../database/prisma'), import('../config/constants')]);
  const original = prisma.user.findUnique;
  Object.defineProperty(prisma.user, 'findUnique', { configurable: true, writable: true, value: async () => actor });
  t.after(() => Object.defineProperty(prisma.user, 'findUnique', { configurable: true, writable: true, value: original }));
  const token = jwt.sign({ id: actor.id, username: actor.username, sessionVersion: 0 }, JWT_SECRET);

  const response = await deleteExam(state.server, token);
  assert.equal(response.status, 403);
  assert.equal(state.transactions(), 0);
  assert.equal(state.exam.deletedAt, null);
});

test('audit failure rolls back the Exam soft delete', async (t) => {
  const state = await setup(t, true);
  const response = await deleteExam(state.server, state.token);

  assert.equal(response.status, 500);
  assert.equal(state.exam.deletedAt, null);
  assert.equal(state.audits.length, 0);
  assert.equal(state.updates(), 1);
});
