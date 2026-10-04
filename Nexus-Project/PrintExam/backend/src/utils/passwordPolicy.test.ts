import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePassword } from './passwordPolicy';

test('password policy accepts a strong passphrase', () => {
  assert.equal(validatePassword('PrintExam!2569'), null);
});

test('password policy rejects short and single-class passwords', () => {
  assert.match(validatePassword('Short!1') || '', /12/);
  assert.match(validatePassword('onlylowercase123') || '', /ตัวพิมพ์เล็ก/);
});
