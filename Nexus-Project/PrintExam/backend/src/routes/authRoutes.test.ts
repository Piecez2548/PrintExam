import assert from 'node:assert/strict';
import { createServer, request as httpRequest, type Server } from 'node:http';
import test, { type TestContext } from 'node:test';
import bcrypt from 'bcryptjs';
import express from 'express';

process.env.JWT_SECRET ||= 'test-only-secret-that-is-long-enough-for-local-tests';

function stubMethod(
  t: TestContext,
  target: Record<string, any>,
  methodName: string,
  implementation: (...args: any[]) => Promise<unknown>,
): void {
  const original = target[methodName];
  Object.defineProperty(target, methodName, { configurable: true, writable: true, value: implementation });
  t.after(() => Object.defineProperty(target, methodName, { configurable: true, writable: true, value: original }));
}

function postLogin(server: Server, username: string, password: string): Promise<{ status: number; body: any }> {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: '127.0.0.1',
      port: address.port,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
      }));
    });
    request.on('error', reject);
    request.end(JSON.stringify({ username, password }));
  });
}

test('login rate limit blocks at ten requests, expires after 15 seconds, then normal auth and OTP continue', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: new Date('2026-10-04T12:00:00.000Z') });

  const originalEnv = {
    nodeEnv: process.env.NODE_ENV,
    otpMode: process.env.OTP_DELIVERY_MODE,
    demoOtp: process.env.ENABLE_DEMO_OTP_LOGGING,
  };
  process.env.NODE_ENV = 'test';
  process.env.OTP_DELIVERY_MODE = 'demo-log';
  process.env.ENABLE_DEMO_OTP_LOGGING = 'true';
  t.after(() => {
    if (originalEnv.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv.nodeEnv;
    if (originalEnv.otpMode === undefined) delete process.env.OTP_DELIVERY_MODE;
    else process.env.OTP_DELIVERY_MODE = originalEnv.otpMode;
    if (originalEnv.demoOtp === undefined) delete process.env.ENABLE_DEMO_OTP_LOGGING;
    else process.env.ENABLE_DEMO_OTP_LOGGING = originalEnv.demoOtp;
  });

  const [{ default: authRoutes }, { prisma }, { UserRole, TWO_FACTOR_EXPIRY_MINUTES }] = await Promise.all([
    import('./authRoutes'),
    import('../database/prisma'),
    import('../config/constants'),
  ]);
  const correctPassword = 'QA-only-password-123!';
  const account = {
    id: 9001,
    username: 'qa-lockout',
    passwordHash: bcrypt.hashSync(correctPassword, 4),
    fullName: 'QA Lockout',
    email: 'qa-lockout@example.test',
    role: UserRole.INSTRUCTOR,
    isActive: true,
    phone: null,
    department: 'QA',
    officeRoom: null,
    sessionVersion: 0,
  };
  let lookups = 0;
  let otpStateUpdate: Record<string, any> | undefined;
  stubMethod(t, prisma.user, 'findFirst', async () => { lookups += 1; return account; });
  stubMethod(t, prisma.user, 'update', async ({ data }: { data: Record<string, any> }) => {
    otpStateUpdate = data;
    return account;
  });
  stubMethod(t, prisma.auditLog, 'create', async () => ({}));

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  // Ten invalid credentials reach the existing credential check; the 11th request is rate limited.
  for (let i = 0; i < 10; i += 1) {
    const response = await postLogin(server, account.username, 'wrong-password');
    assert.equal(response.status, 401);
  }
  assert.equal(lookups, 10);

  const blocked = await postLogin(server, account.username, 'wrong-password');
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.message, /15 วินาที/);
  assert.doesNotMatch(blocked.body.message, /15 นาที/);
  assert.equal(lookups, 10);

  t.mock.timers.tick(14_999);
  const stillBlocked = await postLogin(server, account.username, 'wrong-password');
  assert.equal(stillBlocked.status, 429);
  assert.equal(lookups, 10);

  t.mock.timers.tick(1);
  const afterExpiry = await postLogin(server, account.username, 'wrong-password');
  assert.equal(afterExpiry.status, 401);
  assert.equal(lookups, 11);

  const originalLog = console.log;
  console.log = () => undefined;
  try {
    const successfulLogin = await postLogin(server, account.username, correctPassword);
    assert.equal(successfulLogin.status, 200);
    assert.equal(successfulLogin.body.requires2FA, true);
    assert.equal(typeof successfulLogin.body.tempToken, 'string');
    assert.equal(TWO_FACTOR_EXPIRY_MINUTES, 3);
    assert.equal(otpStateUpdate?.twoFactorFailedAttempts, 0);
    assert.ok(otpStateUpdate?.twoFactorTempCode);
    assert.ok(otpStateUpdate?.twoFactorExpiresAt instanceof Date);
  } finally {
    console.log = originalLog;
  }
});
