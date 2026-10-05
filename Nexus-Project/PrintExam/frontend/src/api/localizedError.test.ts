import assert from 'node:assert/strict';
import test from 'node:test';

Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: { documentElement: { lang: '', title: '' } },
});

const [{ clearUserConflictFieldError, getUserConflictFields, localizedApiError }, { default: i18n }] = await Promise.all([
  import('./localizedError.ts'),
  import('../i18n/index.ts'),
]);

test('user-create conflicts map each conflicting field to localized feedback', async () => {
  const cases = [
    {
      conflicts: ['username'],
      fields: ['username'],
      th: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาใช้ชื่อผู้ใช้อื่น',
      en: 'This username is already in use. Please choose another username.',
    },
    {
      conflicts: ['email'],
      fields: ['email'],
      th: 'อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น',
      en: 'This email is already in use. Please use another email.',
    },
    {
      conflicts: ['username', 'email'],
      fields: ['username', 'email'],
      th: 'ชื่อผู้ใช้และอีเมลนี้ถูกใช้งานแล้ว กรุณาเปลี่ยนชื่อผู้ใช้และอีเมล',
      en: 'This username and email are already in use. Please change both.',
    },
  ];

  for (const item of cases) {
    const conflictError = {
      response: {
        status: 409,
        data: { code: 'USER_CONFLICT', conflicts: item.conflicts, message: 'duplicate' },
      },
    };
    assert.deepEqual(getUserConflictFields(conflictError), item.fields);
    await i18n.changeLanguage('th');
    assert.equal(localizedApiError(conflictError, 'fallback'), item.th);
    await i18n.changeLanguage('en');
    assert.equal(localizedApiError(conflictError, 'fallback'), item.en);
  }
});

test('legacy duplicate response remains localized and unknown conflicts use a safe fallback', async () => {
  await i18n.changeLanguage('en');
  assert.equal(
    localizedApiError({ response: { status: 409, data: { message: 'ชื่อผู้ใช้หรืออีเมลนี้มีอยู่ในระบบแล้ว' } } }, 'fallback'),
    'The username or email is already in use.',
  );
  assert.equal(
    localizedApiError({ response: { status: 409, data: { code: 'USER_CONFLICT', conflicts: ['unexpected'] } } }, 'Safe fallback'),
    'The username or email is already in use.',
  );
  assert.deepEqual(
    getUserConflictFields({ response: { status: 409, data: { code: 'USER_CONFLICT', conflicts: ['unexpected'] } } }),
    [],
  );
  assert.equal(
    localizedApiError({ response: { status: 409, data: { code: 'UNEXPECTED_CONFLICT', message: 'internal details' } } }, 'Safe fallback'),
    'Safe fallback',
  );
  assert.deepEqual(
    clearUserConflictFieldError({ username: true, email: true }, 'username'),
    { username: false, email: true },
  );
  assert.deepEqual(
    clearUserConflictFieldError({ username: true, email: true }, 'email'),
    { username: true, email: false },
  );
});

test('unknown backend errors continue to use the safe generic fallback', async () => {
  await i18n.changeLanguage('en');
  assert.equal(
    localizedApiError({ response: { status: 500, data: { message: 'internal details' } } }, 'Safe fallback'),
    'Safe fallback',
  );
});
