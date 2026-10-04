import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isValidUsername,
  validateNewUsername,
} from '../../src/security/usernameValidation';

const userRoutesSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/routes/userRoutes.ts'),
  'utf8',
);
const authRoutesSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/routes/authRoutes.ts'),
  'utf8',
);

test('new ASCII usernames within the 3-64 character rule are accepted', () => {
  assert.equal(isValidUsername('somchai.j'), true);
  assert.equal(isValidUsername('abc'), true);
  assert.equal(isValidUsername('a'.repeat(64)), true);
  assert.equal(validateNewUsername('staff-01').ok, true);
});

test('Thai, spaces, unsupported symbols, short, and long usernames are rejected', () => {
  for (const value of ['สมชาย', 'abc def', 'abc@def', 'ab', 'a'.repeat(65)]) {
    assert.equal(isValidUsername(value), false, `expected invalid username: ${value}`);
    assert.equal(validateNewUsername(value).ok, false);
  }
});

test('full name remains independent from username validation and can contain Thai text', () => {
  assert.equal(isValidUsername('somchai.j'), true);
  assert.match(userRoutesSource, /full_name/);
  assert.doesNotMatch(userRoutesSource, /USERNAME_PATTERN.*full_name/s);
});

test('duplicate username protection remains in the Admin create path', () => {
  assert.match(userRoutesSource, /OR:\s*\[\{ username \}, \{ email \}\]/);
  assert.match(userRoutesSource, /status\(409\)/);
});

test('legacy usernames remain compatible with login and are not validated at login', () => {
  assert.match(authRoutesSource, /where:\s*\{ username \}/);
  assert.doesNotMatch(authRoutesSource, /validateNewUsername|isValidUsername/);
});

test('the current Admin edit path does not rewrite an existing username', () => {
  const updateStart = userRoutesSource.indexOf("router.put('/:id'");
  const updateEnd = userRoutesSource.indexOf('// Toggle suspend / active', updateStart);
  const updateRoute = userRoutesSource.slice(updateStart, updateEnd);
  assert.match(updateRoute, /const \{ full_name, email, department, phone, role \} = req.body/);
  assert.doesNotMatch(updateRoute, /data:\s*\{[\s\S]*username/);
});

test('Admin RBAC and REQ-05 self-profile security tests remain in the suite', () => {
  assert.match(userRoutesSource, /requireRole\(UserRole\.ADMIN\)/);
  assert.match(fs.readFileSync(path.resolve(process.cwd(), 'test/security/selfProfile.test.ts'), 'utf8'), /username/);
});
