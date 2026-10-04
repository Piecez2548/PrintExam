import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  isValidUsername,
  USERNAME_PATTERN_SOURCE,
  USERNAME_RULE_MESSAGE,
} from '../src/utils/usernameValidation';

const adminPageSource = readFileSync(
  new URL('../src/pages/admin/UserManagementPage.tsx', import.meta.url),
  'utf8',
);

test('frontend username validator mirrors the creation rule', () => {
  assert.equal(isValidUsername('staff-01'), true);
  assert.equal(isValidUsername('ab'), false);
  assert.equal(isValidUsername('abc def'), false);
  assert.equal(isValidUsername('สมชาย'), false);
  assert.equal(isValidUsername('a'.repeat(65)), false);
});

test('Admin create UI exposes the same username pattern and guidance', () => {
  assert.match(adminPageSource, /isValidUsername\(username\)/);
  assert.match(adminPageSource, /pattern=\{USERNAME_PATTERN_SOURCE\}/);
  assert.match(adminPageSource, new RegExp(USERNAME_RULE_MESSAGE.split(' ')[0]));
});
