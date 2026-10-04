import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import test, { type TestContext } from 'node:test';
import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';

process.env.JWT_SECRET ||= 'test-only-secret-that-is-long-enough-for-local-tests';

function stubMethod(t: TestContext, prismaClient: any, delegateName: string, methodName: string, implementation: (...args: any[]) => Promise<unknown>): void {
  const delegate = prismaClient[delegateName];
  const original = delegate[methodName];
  Object.defineProperty(delegate, methodName, { configurable: true, writable: true, value: implementation });
  t.after(() => Object.defineProperty(delegate, methodName, { configurable: true, writable: true, value: original }));
}

function stubUserLookup(t: TestContext, prismaClient: any, lookup: () => Promise<unknown>): void {
  stubMethod(t, prismaClient, 'user', 'findUnique', lookup);
}

function putJson(server: ReturnType<typeof createServer>, token: string, body: Record<string, string>): Promise<{ status: number; body: any }> {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: '127.0.0.1',
      port: address.port,
      path: '/api/users/me/profile',
      method: 'PUT',
      headers: {
        Cookie: `print_exam_session=${token}`,
        'Content-Type': 'application/json',
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
      }));
    });
    request.on('error', reject);
    request.end(JSON.stringify(body));
  });
}

test('must-change-password accounts can use authenticated APIs while active and session checks remain enforced', async (t) => {
  const [{ authenticateToken }, { prisma }, { JWT_SECRET, UserRole }] = await Promise.all([
    import('./auth'),
    import('../database/prisma'),
    import('../config/constants'),
  ]);
  const account = {
    id: 42,
    username: 'qa-instructor',
    fullName: 'QA Instructor',
    email: 'qa-instructor@example.test',
    role: UserRole.INSTRUCTOR,
    department: 'QA',
    phone: null,
    officeRoom: null,
    isActive: true,
    mustChangePassword: true,
    sessionVersion: 7,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  let databaseCalls = 0;
  stubUserLookup(t, prisma, async () => { databaseCalls += 1; return account; });

  const token = jwt.sign(
    { id: account.id, username: account.username, role: account.role, sessionVersion: account.sessionVersion },
    JWT_SECRET,
    { algorithm: 'HS256' },
  );
  const req = {
    headers: { cookie: `print_exam_session=${token}` },
    originalUrl: '/api/notifications',
  } as Parameters<typeof authenticateToken>[0];
  let statusCode: number | undefined;
  let responseBody: unknown;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { responseBody = value; return this; },
  } as Parameters<typeof authenticateToken>[1];
  let nextCalled = false;

  await authenticateToken(req, res, () => { nextCalled = true; });

  assert.equal(statusCode, undefined);
  assert.equal(responseBody, undefined);
  assert.equal(nextCalled, true);
  assert.equal(req.user?.must_change_password, true);
  assert.equal(req.user?.role, UserRole.INSTRUCTOR);
  assert.equal(databaseCalls, 1);
});

test('unauthenticated and inactive accounts remain rejected', async (t) => {
  const [{ authenticateToken }, { prisma }, { JWT_SECRET, UserRole }] = await Promise.all([
    import('./auth'),
    import('../database/prisma'),
    import('../config/constants'),
  ]);
  const inactiveAccount = {
    id: 43,
    username: 'inactive-qa',
    fullName: 'Inactive QA',
    email: 'inactive@example.test',
    role: UserRole.INSTRUCTOR,
    department: null,
    phone: null,
    officeRoom: null,
    isActive: false,
    mustChangePassword: true,
    sessionVersion: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  let lookupAccount = { ...inactiveAccount, isActive: true, sessionVersion: 2 };
  let databaseCalls = 0;
  stubUserLookup(t, prisma, async () => { databaseCalls += 1; return lookupAccount; });
  const response = () => {
    let statusCode: number | undefined;
    let body: unknown;
    return {
      res: {
        status(code: number) { statusCode = code; return this; },
        json(value: unknown) { body = value; return this; },
      } as Parameters<typeof authenticateToken>[1],
      status: () => statusCode,
      body: () => body,
    };
  };

  const unauthenticated = response();
  let unauthenticatedNextCalled = false;
  await authenticateToken(
    { headers: {}, originalUrl: '/api/notifications' } as Parameters<typeof authenticateToken>[0],
    unauthenticated.res,
    () => { unauthenticatedNextCalled = true; },
  );
  assert.equal(unauthenticated.status(), 401);
  assert.equal(unauthenticatedNextCalled, false);
  assert.equal(databaseCalls, 0);

  const staleSessionToken = jwt.sign(
    { id: inactiveAccount.id, username: inactiveAccount.username, role: inactiveAccount.role, sessionVersion: 1 },
    JWT_SECRET,
    { algorithm: 'HS256' },
  );
  const staleSession = response();
  let staleSessionNextCalled = false;
  await authenticateToken(
    { headers: { cookie: `print_exam_session=${staleSessionToken}` }, originalUrl: '/api/notifications' } as Parameters<typeof authenticateToken>[0],
    staleSession.res,
    () => { staleSessionNextCalled = true; },
  );
  assert.equal(staleSession.status(), 401);
  assert.equal(staleSessionNextCalled, false);

  lookupAccount = inactiveAccount;
  const token = jwt.sign(
    { id: inactiveAccount.id, username: inactiveAccount.username, role: inactiveAccount.role, sessionVersion: 1 },
    JWT_SECRET,
    { algorithm: 'HS256' },
  );
  const inactive = response();
  let inactiveNextCalled = false;
  await authenticateToken(
    { headers: { cookie: `print_exam_session=${token}` }, originalUrl: '/api/notifications' } as Parameters<typeof authenticateToken>[0],
    inactive.res,
    () => { inactiveNextCalled = true; },
  );
  assert.equal(inactive.status(), 403);
  assert.equal(inactiveNextCalled, false);
  assert.deepEqual(inactive.body(), { success: false, message: 'บัญชีผู้ใช้นี้ถูกระงับการใช้งานชั่วคราว' });
  assert.equal(databaseCalls, 2);
});

test('wrong-role authorization remains rejected for must-change-password accounts', async () => {
  const [{ requireRole }, { UserRole }] = await Promise.all([
    import('./rbac'),
    import('../config/constants'),
  ]);
  const middleware = requireRole(UserRole.ADMIN);
  const req = {
    user: {
      id: 42,
      username: 'qa-instructor',
      full_name: 'QA Instructor',
      email: 'qa-instructor@example.test',
      role: UserRole.INSTRUCTOR,
      is_active: true,
      must_change_password: true,
    },
  } as Parameters<typeof middleware>[0];
  let statusCode: number | undefined;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json() { return this; },
  } as Parameters<typeof middleware>[1];
  let nextCalled = false;

  middleware(req, res, () => { nextCalled = true; });

  assert.equal(statusCode, 403);
  assert.equal(nextCalled, false);
});

test('profile changes remain optional and a voluntary password change still clears the flag', async (t) => {
  const [{ default: userRoutes }, { prisma }, { JWT_SECRET, UserRole }] = await Promise.all([
    import('../routes/userRoutes'),
    import('../database/prisma'),
    import('../config/constants'),
  ]);
  let current: Record<string, any> = {
    id: 45,
    username: 'qa-profile',
    fullName: 'QA Profile',
    email: 'qa-profile@example.test',
    role: UserRole.INSTRUCTOR,
    department: 'QA',
    phone: '0812345678',
    officeRoom: 'QA-1',
    isActive: true,
    mustChangePassword: true,
    sessionVersion: 3,
    passwordHash: bcrypt.hashSync('OldPass!123456', 4),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  stubUserLookup(t, prisma, async () => current);
  stubMethod(t, prisma, 'user', 'findFirst', async () => null);
  stubMethod(t, prisma, 'user', 'update', async ({ data }: { data: Record<string, any> }) => {
    current = {
      ...current,
      username: data.username,
      fullName: data.fullName,
      email: data.email,
      department: data.department,
      phone: data.phone,
      officeRoom: data.officeRoom,
      ...(data.passwordHash ? { passwordHash: data.passwordHash } : {}),
      ...(data.mustChangePassword !== undefined ? { mustChangePassword: data.mustChangePassword } : {}),
      ...(data.sessionVersion?.increment ? { sessionVersion: current.sessionVersion + data.sessionVersion.increment } : {}),
      updatedAt: new Date(),
    };
    return current;
  });
  stubMethod(t, prisma, 'auditLog', 'create', async () => ({}));

  const app = express();
  app.use(express.json());
  app.use('/api/users', userRoutes);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const token = jwt.sign(
    { id: current.id, username: current.username, role: current.role, sessionVersion: current.sessionVersion },
    JWT_SECRET,
    { algorithm: 'HS256' },
  );
  const profile = {
    username: current.username,
    full_name: current.fullName,
    email: current.email,
    department: current.department,
    phone: current.phone,
    office_room: current.officeRoom,
  };

  try {
    const profileOnly = await putJson(server, token, profile);
    assert.equal(profileOnly.status, 200);
    assert.equal(profileOnly.body.data.must_change_password, true);

    const voluntaryPasswordChange = await putJson(server, token, {
      ...profile,
      current_password: 'OldPass!123456',
      new_password: 'NewPass!123456',
    });
    assert.equal(voluntaryPasswordChange.status, 200);
    assert.equal(voluntaryPasswordChange.body.data.must_change_password, false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('must-change-password accounts can authenticate a WebSocket session', async (t) => {
  const [{ initWebSocketServer }, { prisma }, { JWT_SECRET, UserRole }] = await Promise.all([
    import('../services/wsService'),
    import('../database/prisma'),
    import('../config/constants'),
  ]);
  const account = {
    id: 44,
    role: UserRole.INSTRUCTOR,
    isActive: true,
    sessionVersion: 9,
    mustChangePassword: true,
  };
  stubUserLookup(t, prisma, async () => account);

  const server = createServer();
  const wss = initWebSocketServer(server);
  const originalFrontendUrl = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'http://localhost:5173';
  let client: WebSocket | undefined;
  const originalLog = console.log;
  let resolveAuthenticated!: () => void;
  const authenticated = new Promise<void>((resolve) => { resolveAuthenticated = resolve; });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  console.log = (...args: unknown[]) => {
    if (args.some((arg) => String(arg).includes('Client authenticated: User 44 (INSTRUCTOR)'))) {
      resolveAuthenticated();
    }
  };

  try {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const token = jwt.sign(
      { id: account.id, role: account.role, sessionVersion: account.sessionVersion },
      JWT_SECRET,
      { algorithm: 'HS256' },
    );
    client = new WebSocket(`ws://127.0.0.1:${address.port}/ws`, {
      headers: {
        Origin: 'http://localhost:5173',
        Cookie: `print_exam_session=${token}`,
      },
    });
    client.on('error', () => undefined);
    const opened = new Promise<void>((resolve, reject) => {
      client!.once('open', resolve);
      client!.once('error', () => reject(new Error('WebSocket connection failed')));
      client!.once('close', (code) => reject(new Error(`WebSocket closed before authentication (${code})`)));
    });

    await Promise.race([
      Promise.all([authenticated, opened]).then(() => undefined),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('WebSocket authentication timed out')), 3000); }),
    ]);
    assert.equal(client.readyState, WebSocket.OPEN);
  } finally {
    console.log = originalLog;
    if (timeout) clearTimeout(timeout);
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
    client?.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
