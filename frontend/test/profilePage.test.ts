import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const navbarSource = readFileSync(new URL('../src/components/layout/Navbar.tsx', import.meta.url), 'utf8');
const profilePageSource = readFileSync(new URL('../src/pages/shared/ProfilePage.tsx', import.meta.url), 'utf8');

test('profile is an authenticated shared route for all four roles', () => {
  assert.match(appSource, /path="profile"/);
  assert.match(appSource, /UserRole\.INSTRUCTOR, UserRole\.AV_STAFF, UserRole\.COORDINATOR, UserRole\.ADMIN/);
  assert.match(appSource, /<ProfilePage \/>/);
});

test('Navbar navigates to the profile page instead of opening the removed modal', () => {
  assert.match(navbarSource, /navigate\('\/profile'\)/);
  assert.doesNotMatch(navbarSource, /ProfileEditModal|isProfileEditOpen/);
});

test('profile page exposes the safe self-edit fields and preserves read-only identity fields', () => {
  for (const field of ['full_name', 'email', 'department', 'phone']) {
    assert.match(profilePageSource, new RegExp(field));
  }
  assert.match(profilePageSource, /updateProfile\(payload\)/);
  assert.match(profilePageSource, /user\.username/);
  assert.match(profilePageSource, /user\.role/);
  assert.match(profilePageSource, /บันทึกข้อมูล/);
  assert.match(profilePageSource, /ยกเลิก/);
  assert.match(profilePageSource, /role="alert"/);
  assert.match(profilePageSource, /role="status"/);
});
