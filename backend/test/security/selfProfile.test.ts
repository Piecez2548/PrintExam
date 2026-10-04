import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSelfProfileUpdate } from '../../src/security/selfProfile';

process.env.JWT_SECRET = 'req05-self-profile-test-secret';

test('authenticated self-profile update accepts only safe personal fields', () => {
  const result = validateSelfProfileUpdate({
    full_name: 'Updated User',
    email: 'updated@example.com',
    department: 'Engineering',
    phone: '0812345678',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.data, {
      fullName: 'Updated User',
      email: 'updated@example.com',
      department: 'Engineering',
      phone: '0812345678',
    });
  }
});

test('self-profile contract has no target user id and rejects another-user targeting', () => {
  const result = validateSelfProfileUpdate({ full_name: 'Updated User', user_id: 999 });
  assert.equal(result.ok, false);
});

test('role escalation and account status changes are rejected', () => {
  assert.equal(validateSelfProfileUpdate({ role: 'ADMIN' }).ok, false);
  assert.equal(validateSelfProfileUpdate({ is_active: false }).ok, false);
  assert.equal(validateSelfProfileUpdate({ status: 'inactive' }).ok, false);
});

test('username, id, password, and ownership fields are rejected', () => {
  assert.equal(validateSelfProfileUpdate({ username: 'other' }).ok, false);
  assert.equal(validateSelfProfileUpdate({ id: 999 }).ok, false);
  assert.equal(validateSelfProfileUpdate({ password: 'new-password' }).ok, false);
  assert.equal(validateSelfProfileUpdate({ course_ids: [999] }).ok, false);
});

test('invalid unauthenticated/empty-shaped profile payloads do not pass validation', () => {
  assert.equal(validateSelfProfileUpdate(undefined).ok, false);
  assert.equal(validateSelfProfileUpdate({}).ok, false);
  assert.equal(validateSelfProfileUpdate({ email: 'not-an-email' }).ok, false);
});

test('unauthenticated self-profile request is denied with HTTP 401', async () => {
  const { authenticateToken } = await import('../../src/middleware/auth');
  let statusCode = 0;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };

  await authenticateToken({ headers: {} } as never, response as never, () => {
    throw new Error('unauthenticated request must not call next');
  });

  assert.equal(statusCode, 401);
});
