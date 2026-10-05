import assert from 'node:assert/strict';
import { createServer, request as httpRequest, type Server } from 'node:http';
import test, { type TestContext } from 'node:test';
import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET ||= 'test-only-secret-that-is-long-enough-for-local-tests';

type AnyRecord = Record<string, any>;

function stubMethod(
  t: TestContext,
  target: AnyRecord,
  methodName: string,
  implementation: (...args: any[]) => any,
): void {
  const original = target[methodName];
  Object.defineProperty(target, methodName, { configurable: true, writable: true, value: implementation });
  t.after(() => Object.defineProperty(target, methodName, { configurable: true, writable: true, value: original }));
}

function makeUser(id: number, role = 'INSTRUCTOR'): AnyRecord {
  return {
    id,
    username: `qa-user-${id}`,
    passwordHash: bcrypt.hashSync('Valid@Password123', 4),
    fullName: `QA User ${id}`,
    email: `qa-user-${id}@example.test`,
    role,
    department: 'QA',
    phone: null,
    officeRoom: null,
    isActive: true,
    mustChangePassword: false,
    sessionVersion: 0,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    twoFactorTempCode: null,
    twoFactorExpiresAt: null,
    twoFactorFailedAttempts: 0,
  };
}

function tokenFor(user: AnyRecord): string {
  return jwt.sign({ id: user.id, username: user.username, sessionVersion: user.sessionVersion }, process.env.JWT_SECRET!);
}

function send(
  server: Server,
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; body: AnyRecord }> {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    request.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

async function setup(t: TestContext, options: { retained?: Record<string, number>; targetExists?: boolean; notificationCount?: number; failAudit?: boolean; createRaceConflict?: 'username' | 'email' } = {}) {
  const [{ default: userRoutes }, { default: authRoutes }, { prisma }, { UserRole }, { auditMiddleware }] = await Promise.all([
    import('./userRoutes'),
    import('./authRoutes'),
    import('../database/prisma'),
    import('../config/constants'),
    import('../middleware/audit'),
  ]);
  const admin = makeUser(1, UserRole.ADMIN);
  const target = makeUser(2);
  const unrelated = makeUser(3);
  const users = new Map<number, AnyRecord>([[admin.id, admin], [target.id, target], [unrelated.id, unrelated]]);
  let targetExists = options.targetExists ?? true;
  const retained = options.retained || {};
  const retainedCalls: Record<string, any> = {};
  const createdUsers: AnyRecord[] = [];
  let nextUserId = 4;
  let notificationCount = options.notificationCount ?? 0;
  let notificationDeleteCalls = 0;
  let deletedIds: number[] = [];
  let auditCreates: AnyRecord[] = [];
  let createRaceTriggered = false;

  stubMethod(t, prisma.user, 'findUnique', async ({ where }: AnyRecord) => users.get(where.id) || null);
  stubMethod(t, prisma.user, 'findFirst', async ({ where }: AnyRecord) => {
    if (where?.deletedAt === null) {
      const activeMatch = [...users.values()].find((user) => !user.deletedAt && (
        (where.OR || []).some((clause: AnyRecord) =>
          (clause.username?.equals && user.username.toLowerCase() === String(clause.username.equals).toLowerCase())
          || (clause.email?.equals && user.email.toLowerCase() === String(clause.email.equals).toLowerCase())
        )
      ));
      return activeMatch || null;
    }
    const usernameQuery = where?.username?.equals ?? where?.OR?.find((clause: AnyRecord) => clause.username)?.username?.equals;
    const emailQuery = where?.email?.equals ?? where?.OR?.find((clause: AnyRecord) => clause.email)?.email?.equals;
    return [...users.values()].find((user) =>
      (usernameQuery && user.username.toLowerCase() === String(usernameQuery).toLowerCase())
      || (emailQuery && user.email.toLowerCase() === String(emailQuery).toLowerCase())
    ) || null;
  });
  stubMethod(t, prisma.user, 'create', async ({ data }: AnyRecord) => {
    if (options.createRaceConflict && !createRaceTriggered) {
      createRaceTriggered = true;
      const concurrentUser: AnyRecord = {
        ...makeUser(nextUserId, data.role),
        username: options.createRaceConflict === 'username' ? data.username : `race-user-${nextUserId}`,
        email: options.createRaceConflict === 'email' ? data.email : `race-${nextUserId}@example.test`,
      };
      users.set(concurrentUser.id, concurrentUser);
      throw Object.assign(new Error('unique constraint'), {
        code: 'P2002',
        meta: { target: [options.createRaceConflict] },
      });
    }
    const user = {
      ...makeUser(nextUserId, data.role),
      ...data,
      id: nextUserId,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    nextUserId += 1;
    users.set(user.id, user);
    createdUsers.push(user);
    return user;
  });
  stubMethod(t, prisma.user, 'update', async ({ where, data }: AnyRecord) => {
    const user = users.get(where.id);
    if (!user) throw new Error('missing test user');
    Object.assign(user, data);
    if (data.sessionVersion?.increment) user.sessionVersion += data.sessionVersion.increment;
    return user;
  });
  stubMethod(t, prisma.passwordResetRequest, 'updateMany', async () => ({ count: 0 }));
  stubMethod(t, prisma.auditLog, 'create', async ({ data }: AnyRecord) => {
    auditCreates.push(data);
    return data;
  });

  const tx: AnyRecord = {
    user: {
      findUnique: async ({ where }: AnyRecord) => where.id === target.id && targetExists ? { ...target } : null,
      update: async ({ data }: AnyRecord) => {
        const priorSessionVersion = target.sessionVersion;
        Object.assign(target, { ...data, sessionVersion: priorSessionVersion });
        if (data.sessionVersion?.increment) target.sessionVersion = priorSessionVersion + data.sessionVersion.increment;
        return target;
      },
    },
    notification: {
      deleteMany: async ({ where }: AnyRecord) => {
        assert.equal(where.userId, target.id);
        notificationDeleteCalls += 1;
        const count = notificationCount;
        notificationCount = 0;
        return { count };
      },
    },
    passwordResetRequest: {
      updateMany: async () => ({ count: 0 }),
    },
    auditLog: {
      create: async ({ data }: AnyRecord) => {
        if (options.failAudit) throw new Error('audit insert failed');
        auditCreates.push(data);
        return data;
      },
    },
  };
  const retainedModels = [
    'course', 'exam', 'examStatusHistory', 'envelopeLabel', 'printRecord', 'packingRecord',
    'deliveryRecord', 'examSchedule',
  ];
  for (const model of retainedModels) {
    tx[model] = {
      count: async ({ where }: AnyRecord) => {
        retainedCalls[model] = where;
        return retained[model] || 0;
      },
    };
  }
  stubMethod(t, prisma, '$transaction', async (callback: (client: AnyRecord) => Promise<unknown>) => {
    const snapshot = { ...target };
    try {
      return await callback(tx);
    } catch (error) {
      Object.assign(target, snapshot);
      throw error;
    }
  });

  const app = express();
  app.use(express.json());
  app.use('/api', auditMiddleware);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  return {
    server,
    postUser: (body: unknown, token = tokenFor(admin)) => send(server, 'POST', '/api/users', token, body),
    createdUsers,
    admin,
    target,
    unrelated,
    users,
    deleteTarget: (token = tokenFor(admin), id = target.id) => send(server, 'DELETE', `/api/users/${id}`, token),
    notificationCount: () => notificationCount,
    notificationDeleteCalls: () => notificationDeleteCalls,
    deletedIds: () => deletedIds,
    retainedCalls,
    auditCreates: () => auditCreates,
    setTargetExists: (value: boolean) => { targetExists = value; },
  };
}

test('ADMIN can create every supported role with normalized ASCII username, phone, and unchanged first-login metadata', async (t) => {
  const state = await setup(t);
  const roles = ['INSTRUCTOR', 'AV_STAFF', 'COORDINATOR'] as const;

  for (const [index, role] of roles.entries()) {
    const result = await state.postUser({
      username: ` qa.user_${index + 1}-x `,
      password: 'Valid@Password123',
      full_name: `QA User ${index + 1}`,
      email: `create-${index + 1}@example.test`,
      role,
      phone: index === 1 ? '081-234-5678' : '0812345678',
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.data.username, `qa.user_${index + 1}-x`);
    assert.equal(result.body.data.role, role);
    assert.equal(result.body.data.phone, '081-234-5678');
    assert.equal(result.body.data.is_active, true);
    assert.equal(state.createdUsers[index].mustChangePassword, true);
    assert.equal(state.createdUsers[index].deletedAt, null);
    assert.equal(state.createdUsers[index].officeRoom, null);
    assert.match(state.createdUsers[index].passwordHash, /^\$2[aby]\$\d{2}\$/);
    assert.equal(bcrypt.compareSync('Valid@Password123', state.createdUsers[index].passwordHash), true);
    const createAudit = state.auditCreates().find((entry) =>
      entry.action === 'CREATE_USER' && entry.entityId === String(state.createdUsers[index].id));
    assert.ok(createAudit);
    assert.equal(createAudit.userId, state.admin.id);
    assert.equal(createAudit.userRole, state.admin.role);
  }

  const numericUsername = await state.postUser({
    username: '123456',
    password: 'Valid@Password123',
    full_name: 'QA Numeric Username',
    email: 'numeric-username@example.test',
    role: 'INSTRUCTOR',
  });
  assert.equal(numericUsername.status, 201);
  assert.equal(numericUsername.body.data.username, '123456');

  const withoutPhone = await state.postUser({
    username: 'qa.phone-empty',
    password: 'Valid@Password123',
    full_name: 'QA Optional Phone',
    email: 'optional-phone@example.test',
    role: 'INSTRUCTOR',
    phone: '',
  });
  assert.equal(withoutPhone.status, 201);
  assert.equal(withoutPhone.body.data.phone, null);

  const userCountBeforeDuplicates = state.createdUsers.length;
  const auditCountBeforeDuplicates = state.auditCreates().length;
  const duplicateUsername = await state.postUser({
    username: state.admin.username,
    password: 'Valid@Password123',
    full_name: 'Duplicate Username',
    email: 'unique-email@example.test',
    role: 'INSTRUCTOR',
  });
  assert.equal(duplicateUsername.status, 409);
  assert.equal(duplicateUsername.body.code, 'USER_CONFLICT');
  assert.deepEqual(duplicateUsername.body.conflicts, ['username']);
  assert.equal(state.createdUsers.length, userCountBeforeDuplicates);

  const duplicateEmail = await state.postUser({
    username: 'new-unique-username',
    password: 'Valid@Password123',
    full_name: 'Duplicate Email',
    email: state.admin.email,
    role: 'INSTRUCTOR',
  });
  assert.equal(duplicateEmail.status, 409);
  assert.equal(duplicateEmail.body.code, 'USER_CONFLICT');
  assert.deepEqual(duplicateEmail.body.conflicts, ['email']);
  assert.equal(state.createdUsers.length, userCountBeforeDuplicates);
  assert.equal(state.auditCreates().length, auditCountBeforeDuplicates);

  const duplicateBoth = await state.postUser({
    username: state.admin.username,
    password: 'Valid@Password123',
    full_name: 'Duplicate Username And Email',
    email: state.admin.email,
    role: 'INSTRUCTOR',
  });
  assert.equal(duplicateBoth.status, 409);
  assert.deepEqual(duplicateBoth.body.conflicts, ['username', 'email']);
  assert.equal(state.createdUsers.length, userCountBeforeDuplicates);
  assert.equal(state.auditCreates().length, auditCountBeforeDuplicates);
});

test('soft-deleted users continue reserving usernames and emails', async (t) => {
  const state = await setup(t);
  const deletedUsernameUser = makeUser(50);
  deletedUsernameUser.username = 'deleted-username';
  deletedUsernameUser.email = 'deleted-username@example.test';
  deletedUsernameUser.deletedAt = new Date('2026-01-01T00:00:00.000Z');
  state.users.set(deletedUsernameUser.id, deletedUsernameUser);
  const deletedEmailUser = makeUser(51);
  deletedEmailUser.username = 'deleted-email';
  deletedEmailUser.email = 'deleted-email@example.test';
  deletedEmailUser.deletedAt = new Date('2026-01-01T00:00:00.000Z');
  state.users.set(deletedEmailUser.id, deletedEmailUser);

  const usernameConflict = await state.postUser({
    username: 'deleted-username',
    password: 'Valid@Password123',
    full_name: 'QA Username Conflict',
    email: 'unique-username@example.test',
    role: 'INSTRUCTOR',
  });
  assert.equal(usernameConflict.status, 409);
  assert.deepEqual(usernameConflict.body.conflicts, ['username']);

  const emailConflict = await state.postUser({
    username: 'unique-email-username',
    password: 'Valid@Password123',
    full_name: 'QA Email Conflict',
    email: 'deleted-email@example.test',
    role: 'INSTRUCTOR',
  });
  assert.equal(emailConflict.status, 409);
  assert.deepEqual(emailConflict.body.conflicts, ['email']);
  assert.equal(deletedUsernameUser.deletedAt instanceof Date, true);
  assert.equal(deletedEmailUser.deletedAt instanceof Date, true);
  assert.equal(state.createdUsers.length, 0);
});

test('a P2002 race is translated into a safe field-specific conflict response', async (t) => {
  const state = await setup(t, { createRaceConflict: 'username' });
  const response = await state.postUser({
    username: 'race-username',
    password: 'Valid@Password123',
    full_name: 'QA Race Conflict',
    email: 'race-email@example.test',
    role: 'INSTRUCTOR',
  });

  assert.equal(response.status, 409);
  assert.equal(response.body.code, 'USER_CONFLICT');
  assert.deepEqual(response.body.conflicts, ['username']);
  assert.equal(JSON.stringify(response.body).includes('P2002'), false);
  assert.equal(state.createdUsers.length, 0);
});

test('create-user validation failures do not leave a partial user or audit record', async (t) => {
  const state = await setup(t);
  const missingRequired = await state.postUser({
    username: 'qa-missing-email',
    password: 'Valid@Password123',
    full_name: 'QA Missing Email',
    role: 'INSTRUCTOR',
  });
  assert.equal(missingRequired.status, 400);

  const invalidRole = await state.postUser({
    username: 'qa-invalid-role',
    password: 'Valid@Password123',
    full_name: 'QA Invalid Role',
    email: 'invalid-role@example.test',
    role: 'SUPERUSER',
  });
  assert.equal(invalidRole.status, 400);
  assert.equal(invalidRole.body.message, 'บทบาทผู้ใช้ไม่ถูกต้อง');
  assert.equal(state.createdUsers.length, 0);
  assert.equal(state.auditCreates().length, 0);
});

test('create-user accepts only canonical PSU Hat Yai organizations while keeping department optional', async (t) => {
  const state = await setup(t);
  const canonical = 'คณะวิศวกรรมศาสตร์';
  const accepted = await state.postUser({
    username: 'qa-hatyai-org',
    password: 'Valid@Password123',
    full_name: 'QA Hat Yai Organization',
    email: 'hatyai-org@example.test',
    role: 'INSTRUCTOR',
    department: canonical,
  });
  assert.equal(accepted.status, 201);
  assert.equal(accepted.body.data.department, canonical);

  const arbitrary = await state.postUser({
    username: 'qa-arbitrary-org',
    password: 'Valid@Password123',
    full_name: 'QA Arbitrary Organization',
    email: 'arbitrary-org@example.test',
    role: 'INSTRUCTOR',
    department: 'Computer Science',
  });
  assert.equal(arbitrary.status, 400);
  assert.equal(arbitrary.body.code, 'INVALID_PSU_ORGANIZATION');

  const empty = await state.postUser({
    username: 'qa-empty-org',
    password: 'Valid@Password123',
    full_name: 'QA Empty Organization',
    email: 'empty-org@example.test',
    role: 'INSTRUCTOR',
    department: '',
  });
  assert.equal(empty.status, 201);
  assert.equal(empty.body.data.department, null);
});

test('creating users requires authentication and ADMIN role', async (t) => {
  const state = await setup(t);
  const body = {
    username: 'qa-new-user',
    password: 'Valid@Password123',
    full_name: 'QA New User',
    email: 'qa-new-user@example.test',
    role: 'INSTRUCTOR',
  };
  const unauthenticated = await send(state.server, 'POST', '/api/users', undefined, body);
  assert.equal(unauthenticated.status, 401);

  const instructor = makeUser(5, 'INSTRUCTOR');
  state.users.set(instructor.id, instructor);
  const nonAdmin = await state.postUser(body, tokenFor(instructor));
  assert.equal(nonAdmin.status, 403);
  assert.equal(state.createdUsers.length, 0);
});

test('create-user rejects non-ASCII, whitespace, and unsupported username characters', async (t) => {
  const state = await setup(t);
  for (const [index, username] of ['ผู้ใช้ใหม่', 'has space', 'name+tag', 'ab', 'x'.repeat(65)].entries()) {
    const result = await state.postUser({
      username,
      password: 'Valid@Password123',
      full_name: `Invalid User ${index}`,
      email: `invalid-user-${index}@example.test`,
      role: 'INSTRUCTOR',
    });
    assert.equal(result.status, 400);
    assert.match(result.body.message, /ตัวอักษรภาษาอังกฤษ/);
  }
  assert.equal(state.createdUsers.length, 0);
});

test('create-user rejects malformed phone values and keeps password policy enforced', async (t) => {
  const state = await setup(t);
  for (const [index, phone] of ['081234567', '08123456789', '081-ABC-5678', '081-23-5678'].entries()) {
    const result = await state.postUser({
      username: `qa-phone-${index}`,
      password: 'Valid@Password123',
      full_name: `Invalid Phone ${index}`,
      email: `invalid-phone-${index}@example.test`,
      role: 'INSTRUCTOR',
      phone,
    });
    assert.equal(result.status, 400);
    assert.match(result.body.message, /10 หลัก/);
  }

  const weakPassword = await state.postUser({
    username: 'qa-weak-password',
    password: 'weakpassword123',
    full_name: 'QA Weak Password',
    email: 'weak-password@example.test',
    role: 'INSTRUCTOR',
  });
  assert.equal(weakPassword.status, 400);
  assert.equal(state.createdUsers.length, 0);
});

test('Admin can edit a user with an unchanged legacy phone and cannot set a malformed new phone', async (t) => {
  const state = await setup(t);
  state.target.phone = '02-555-0100';
  state.target.department = 'Legacy department';

  const unchanged = await send(state.server, 'PUT', `/api/users/${state.target.id}`, tokenFor(state.admin), {
    full_name: 'Edited QA User',
    phone: '02-555-0100',
    department: 'Legacy department',
  });
  assert.equal(unchanged.status, 200);
  assert.equal(state.target.phone, '02-555-0100');
  assert.equal(state.target.department, 'Legacy department');

  const invalidChangedPhone = await send(state.server, 'PUT', `/api/users/${state.target.id}`, tokenFor(state.admin), {
    full_name: 'Edited QA User',
    phone: '02-555-0101',
  });
  assert.equal(invalidChangedPhone.status, 400);
  assert.equal(state.target.phone, '02-555-0100');
});

test('admin organization edits accept canonical changes and preserve unchanged legacy values, but reject new arbitrary values', async (t) => {
  const state = await setup(t);
  state.target.department = 'คณะวิทยาศาสตร์';

  const canonicalChange = await send(state.server, 'PUT', `/api/users/${state.target.id}`, tokenFor(state.admin), {
    department: 'คณะวิศวกรรมศาสตร์',
  });
  assert.equal(canonicalChange.status, 200);
  assert.equal(state.target.department, 'คณะวิศวกรรมศาสตร์');

  state.target.department = 'วิทยาการคอมพิวเตอร์';
  const unchangedLegacy = await send(state.server, 'PUT', `/api/users/${state.target.id}`, tokenFor(state.admin), {
    full_name: 'Still Editable',
    department: 'วิทยาการคอมพิวเตอร์',
  });
  assert.equal(unchangedLegacy.status, 200);
  assert.equal(state.target.department, 'วิทยาการคอมพิวเตอร์');

  const legacyToCanonical = await send(state.server, 'PUT', `/api/users/${state.target.id}`, tokenFor(state.admin), {
    department: 'คณะวิศวกรรมศาสตร์',
  });
  assert.equal(legacyToCanonical.status, 200);
  assert.equal(state.target.department, 'คณะวิศวกรรมศาสตร์');

  state.target.department = 'วิทยาการคอมพิวเตอร์';
  const arbitraryChange = await send(state.server, 'PUT', `/api/users/${state.target.id}`, tokenFor(state.admin), {
    department: 'CS',
  });
  assert.equal(arbitraryChange.status, 400);
  assert.equal(arbitraryChange.body.code, 'INVALID_PSU_ORGANIZATION');
  assert.equal(state.target.department, 'วิทยาการคอมพิวเตอร์');
});

test('user deletion requires authentication and ADMIN role', async (t) => {
  const state = await setup(t);
  const unauthenticated = await send(state.server, 'DELETE', `/api/users/${state.target.id}`);
  assert.equal(unauthenticated.status, 401);

  const instructor = makeUser(4, 'INSTRUCTOR');
  state.users.set(instructor.id, instructor);
  const nonAdmin = await state.deleteTarget(tokenFor(instructor));
  assert.equal(nonAdmin.status, 403);
  assert.equal(state.users.has(state.target.id), true);
});

test('user deletion rejects missing and self targets', async (t) => {
  const state = await setup(t, { targetExists: false });
  const missing = await state.deleteTarget();
  assert.equal(missing.status, 404);

  state.setTargetExists(true);
  const self = await state.deleteTarget(tokenFor(state.admin), state.admin.id);
  assert.equal(self.status, 400);
  assert.equal(state.users.has(state.admin.id), true);
});

test('admin soft-deletes a user and retains the user row and owned notifications', async (t) => {
  const state = await setup(t, { notificationCount: 3 });
  const result = await state.deleteTarget();
  assert.equal(result.status, 200);
  assert.equal(state.users.has(state.target.id), true);
  assert.ok(state.target.deletedAt instanceof Date);
  assert.equal(state.target.isActive, false);
  assert.equal(state.target.sessionVersion, 1);
  assert.equal(state.target.twoFactorTempCode, null);
  assert.equal(state.users.has(state.admin.id), true);
  assert.equal(state.users.has(state.unrelated.id), true);
  assert.deepEqual(state.deletedIds(), []);
  assert.equal(state.notificationDeleteCalls(), 0);
  assert.equal(state.notificationCount(), 3);
  const deletionAudit = state.auditCreates().find((entry) => entry.action === 'USER_SOFT_DELETED'
    && entry.userId === state.admin.id && entry.entityId === String(state.target.id));
  assert.ok(deletionAudit);
  const auditDetails = JSON.parse(deletionAudit.detailJson);
  assert.equal(auditDetails.target_username, state.target.username);
  assert.equal(auditDetails.target_role, state.target.role);
  assert.equal(auditDetails.previous_active_state, true);

  const activate = await send(state.server, 'PATCH', `/api/users/${state.target.id}/suspend`, tokenFor(state.admin));
  assert.equal(activate.status, 409);
  assert.equal(activate.body.code, 'USER_ALREADY_DELETED');

  const reset = await send(state.server, 'PATCH', `/api/users/${state.target.id}/reset-password`, tokenFor(state.admin), {
    new_password: 'Temporary@Password123',
    admin_password: 'Valid@Password123',
  });
  assert.equal(reset.status, 409);

  const login = await send(state.server, 'POST', '/api/auth/login', undefined, {
    username: state.target.username,
    password: 'Valid@Password123',
  });
  assert.equal(login.status, 401);
});

test('user soft delete rolls back when the transactional audit insert fails', async (t) => {
  const state = await setup(t, { failAudit: true });
  const result = await state.deleteTarget();

  assert.equal(result.status, 500);
  assert.equal(state.target.deletedAt, null);
  assert.equal(state.target.isActive, true);
  assert.equal(state.target.sessionVersion, 0);
  assert.equal(state.auditCreates().length, 0);
});

test('existing edit, suspend, activate, reset-password and ADMIN permissions remain available', async (t) => {
  const state = await setup(t);
  const originalPasswordHash = state.target.passwordHash;

  const edit = await send(state.server, 'PUT', `/api/users/${state.target.id}`, tokenFor(state.admin), {
    full_name: 'Edited QA User',
  });
  assert.equal(edit.status, 200);
  assert.equal(edit.body.data.full_name, 'Edited QA User');

  const suspend = await send(state.server, 'PATCH', `/api/users/${state.target.id}/suspend`, tokenFor(state.admin));
  assert.equal(suspend.status, 200);
  assert.equal(suspend.body.data.is_active, false);

  const activate = await send(state.server, 'PATCH', `/api/users/${state.target.id}/suspend`, tokenFor(state.admin));
  assert.equal(activate.status, 200);
  assert.equal(activate.body.data.is_active, true);

  const reset = await send(state.server, 'PATCH', `/api/users/${state.target.id}/reset-password`, tokenFor(state.admin), {
    new_password: 'Temporary@Password123',
    admin_password: 'Valid@Password123',
  });
  assert.equal(reset.status, 200);
  assert.notEqual(state.target.passwordHash, originalPasswordHash);
  assert.equal(bcrypt.compareSync('Temporary@Password123', state.target.passwordHash), true);

  const nonAdmin = makeUser(4, 'INSTRUCTOR');
  state.users.set(nonAdmin.id, nonAdmin);
  const forbidden = await send(state.server, 'DELETE', `/api/users/${state.target.id}`, tokenFor(nonAdmin));
  assert.equal(forbidden.status, 403);
  assert.equal(state.users.has(state.target.id), true);
});
