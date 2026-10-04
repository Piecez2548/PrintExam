import assert from 'node:assert/strict';
import test from 'node:test';

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
