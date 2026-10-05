import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPhoneInput, isCompletePhone, USERNAME_PATTERN } from './userManagementInput.ts';
import {
  getPsuOrganizationLabel,
  getPsuOrganizationOptionLabel,
  isCanonicalPsuHatYaiOrganization,
  PSU_HATYAI_ORGANIZATIONS,
} from './psuHatYaiOrganizations.ts';

test('username rule accepts ASCII characters and supported separators only', () => {
  assert.equal(USERNAME_PATTERN.test('abc123'), true);
  assert.equal(USERNAME_PATTERN.test('a.b_c-d'), true);
  assert.equal(USERNAME_PATTERN.test('ชื่อผู้ใช้'), false);
  assert.equal(USERNAME_PATTERN.test('has space'), false);
  assert.equal(USERNAME_PATTERN.test('name+tag'), false);
  assert.equal(USERNAME_PATTERN.test('ab'), false);
});

test('phone input formats pasted and typed digits as 3-3-4', () => {
  assert.equal(formatPhoneInput('0812345678'), '081-234-5678');
  assert.equal(formatPhoneInput('081-234-5678'), '081-234-5678');
  assert.equal(isCompletePhone('081-234-5678'), true);
});

test('phone input removes non-digits, caps at ten digits, and never creates doubled separators', () => {
  assert.equal(formatPhoneInput('081-ABC-5678'), '081-567-8');
  assert.equal(formatPhoneInput('081234567899'), '081-234-5678');
  assert.equal(formatPhoneInput('081-234-567'), '081-234-567');
  assert.equal(formatPhoneInput(''), '');
  assert.equal(isCompletePhone('081-234-567'), false);
});

test('PSU Hat Yai organization catalog has unique stable keys, canonical Thai values, and bilingual labels', () => {
  assert.equal(PSU_HATYAI_ORGANIZATIONS.length, 18);
  assert.equal(new Set(PSU_HATYAI_ORGANIZATIONS.map(({ key }) => key)).size, 18);
  assert.equal(new Set(PSU_HATYAI_ORGANIZATIONS.map(({ th }) => th)).size, 18);
  assert.equal(PSU_HATYAI_ORGANIZATIONS.some(({ key }) => key.includes('SINO_THAI')), false);

  const engineering = PSU_HATYAI_ORGANIZATIONS.find(({ key }) => key === 'HATYAI_ENGINEERING');
  assert.ok(engineering);
  assert.equal(getPsuOrganizationLabel(engineering, 'th'), 'คณะวิศวกรรมศาสตร์');
  assert.equal(getPsuOrganizationLabel(engineering, 'en'), 'Faculty of Engineering');
  assert.equal(getPsuOrganizationOptionLabel(engineering.th, 'en', 'Legacy value'), 'Faculty of Engineering');
  assert.equal(getPsuOrganizationOptionLabel('วิทยาการคอมพิวเตอร์', 'en', 'Legacy value'), 'วิทยาการคอมพิวเตอร์ (Legacy value)');
  assert.equal(isCanonicalPsuHatYaiOrganization(engineering.th), true);
  assert.equal(isCanonicalPsuHatYaiOrganization('Computer Science'), false);
});
