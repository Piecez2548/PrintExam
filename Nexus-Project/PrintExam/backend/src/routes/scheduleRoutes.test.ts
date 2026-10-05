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

function send(server: Server, method: 'POST' | 'PUT', path: string, body: unknown, token: string): Promise<{ status: number; body: AnyRecord }> {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
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
  const [{ default: scheduleRoutes }, { prisma }, { JWT_SECRET }, { UserRole, ExamType, ScheduleStatus }] = await Promise.all([
    import('./scheduleRoutes'),
    import('../database/prisma'),
    import('../config/constants'),
    import('../../generated/prisma'),
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
  const course = {
    id: 52,
    instructorId: 63,
    courseCode: 'QA-101',
    courseName: 'QA Course',
    section: '01',
    instructor: { fullName: 'QA Instructor' },
  };
  const currentSchedule = {
    id: 74,
    courseId: course.id,
    course,
    examType: ExamType.FINAL,
    examDate: '2026-10-19',
    startTime: '09:00',
    endTime: '12:00',
    room: 'QA-ROOM',
    section: '01',
    coordinatorId: coordinator.id,
    deadlineDate: '2026-10-17',
    status: ScheduleStatus.CONFIRMED,
  };
  const writes = { creates: 0, transactions: 0 };

  stubMethod(t, prisma.user, 'findUnique', async () => coordinator);
  stubMethod(t, prisma.course, 'findUnique', async () => course);
  stubMethod(t, prisma.examSchedule, 'findUnique', async () => currentSchedule);
  stubMethod(t, prisma.examSchedule, 'create', async () => { writes.creates += 1; return {}; });
  stubMethod(t, prisma, '$transaction', async () => { writes.transactions += 1; return {}; });

  const app = express();
  app.use(express.json());
  app.use('/api/schedules', scheduleRoutes);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const token = jwt.sign({ id: coordinator.id, username: coordinator.username, sessionVersion: 0 }, JWT_SECRET);
  return { server, token, writes };
}

test('Create schedule rejects an invalid deadline before writing', async (t) => {
  const state = await setup(t);
  const response = await send(state.server, 'POST', '/api/schedules', {
    course_id: 52,
    exam_type: 'FINAL',
    exam_date: '2026-10-19',
    start_time: '09:00',
    end_time: '12:00',
    room: 'QA-ROOM',
    deadline_date: '2026-10-18',
  }, state.token);

  assert.equal(response.status, 400);
  assert.equal(state.writes.creates, 0);
});

test('Edit schedule rejects an invalid deadline before writing', async (t) => {
  const state = await setup(t);
  const response = await send(state.server, 'PUT', '/api/schedules/74', {
    deadline_date: '2026-10-18',
  }, state.token);

  assert.equal(response.status, 400);
  assert.equal(state.writes.transactions, 0);
});
