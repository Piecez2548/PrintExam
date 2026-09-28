import test from 'node:test';
import assert from 'node:assert/strict';
import { UserRole } from '../../generated/prisma';

process.env.JWT_SECRET = 'phase4-test-secret';

test('requireRole allows only an explicitly listed role', async () => {
  const { requireRole } = await import('../../src/middleware/rbac');
  const middleware = requireRole(UserRole.ADMIN);
  let nextCalled = false;
  const response = {
    statusCode: 0,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };

  middleware({ user: { role: UserRole.INSTRUCTOR } } as never, response as never, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 403);
});

test('requireRole passes an allowed role to next', async () => {
  const { requireRole } = await import('../../src/middleware/rbac');
  const middleware = requireRole(UserRole.ADMIN);
  let nextCalled = false;

  middleware({ user: { role: UserRole.ADMIN } } as never, {} as never, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});
