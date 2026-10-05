import assert from 'node:assert/strict';
import { createServer, request as httpRequest, type Server } from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import test, { type TestContext } from 'node:test';

process.env.JWT_SECRET ||= 'test-only-secret-that-is-long-enough-for-local-tests';

type AnyRecord = Record<string, any>;

function stubMethod(t: TestContext, target: AnyRecord, methodName: string, implementation: (...args: any[]) => any): void {
  const original = target[methodName];
  Object.defineProperty(target, methodName, { configurable: true, writable: true, value: implementation });
  t.after(() => Object.defineProperty(target, methodName, { configurable: true, writable: true, value: original }));
}

function send(server: Server, body: AnyRecord, token: string): Promise<{ status: number; body: AnyRecord }> {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: '127.0.0.1',
      port: address.port,
      path: '/api/courses/52',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

async function setup(t: TestContext) {
  const [{ default: courseRoutes }, { prisma }, { JWT_SECRET }, { UserRole }, { auditMiddleware }] = await Promise.all([
    import('./courseRoutes'),
    import('../database/prisma'),
    import('../config/constants'),
    import('../../generated/prisma'),
    import('../middleware/audit'),
  ]);
  const coordinator = {
    id: 31,
    username: 'qa-coordinator',
    fullName: 'QA Coordinator',
    email: 'qa-coordinator@example.test',
    role: UserRole.COORDINATOR,
    department: 'QA',
    phone: null,
    officeRoom: null,
    isActive: true,
    mustChangePassword: false,
    sessionVersion: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const persisted: AnyRecord = {
    id: 52,
    courseCode: 'QA-101',
    courseName: 'QA Course',
    instructorId: 63,
    department: 'Science',
    section: null,
    semester: 1,
    studentCount: 40,
    academicYear: '2569',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    instructor: { fullName: 'QA Instructor', email: 'qa-instructor@example.test', department: 'Science' },
  };
  const audits: AnyRecord[] = [];
  const tx = {
    course: {
      findUnique: async () => ({ ...persisted }),
      update: async ({ data }: AnyRecord) => {
        for (const [key, value] of Object.entries(data)) if (value !== undefined) persisted[key] = value;
        return { ...persisted };
      },
    },
    exam: { findMany: async () => [{ id: 901 }] },
    auditLog: { create: async ({ data }: AnyRecord) => { audits.push(data); return data; } },
  };
  stubMethod(t, prisma.user, 'findUnique', async () => coordinator);
  stubMethod(t, prisma, '$transaction', async (operation: any) => operation(tx));

  const app = express();
  app.use(express.json());
  app.use('/api', auditMiddleware);
  app.use('/api/courses', courseRoutes);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const token = jwt.sign({ id: coordinator.id, username: coordinator.username, sessionVersion: 0 }, JWT_SECRET);
  return { server, token, persisted, audits };
}

test('course edit audits persisted field values using the authenticated actor and suppresses spoofed actor data', async (t) => {
  const state = await setup(t);
  const response = await send(state.server, { course_name: 'Updated QA Course', actor_id: 999, actor_role: 'ADMIN' }, state.token);

  assert.equal(response.status, 200);
  assert.equal(state.persisted.courseName, 'Updated QA Course');
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].userId, 31);
  assert.equal(state.audits[0].userName, 'QA Coordinator');
  assert.equal(state.audits[0].userRole, 'COORDINATOR');
  assert.deepEqual(JSON.parse(state.audits[0].detailJson).changes, {
    course_name: { before: 'QA Course', after: 'Updated QA Course' },
  });
});

test('course no-op optional section does not create a phantom audit field', async (t) => {
  const state = await setup(t);
  const response = await send(state.server, { section: '' }, state.token);

  assert.equal(response.status, 200);
  assert.equal(state.persisted.section, null);
  assert.equal(state.audits.length, 0);
});
