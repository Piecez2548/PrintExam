import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JWT_SECRET ||= 'test-only-secret-that-is-long-enough-for-local-tests';

test('cookie parser reads only the requested cookie', async () => {
  const { readCookie } = await import('./authTokenService');
  assert.equal(readCookie('theme=dark; print_exam_session=abc%20123; x=1', 'print_exam_session'), 'abc 123');
  assert.equal(readCookie('theme=dark', 'print_exam_session'), null);
});
