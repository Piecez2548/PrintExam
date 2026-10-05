import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import i18next from 'i18next';
import {
  formatAuditValue,
  getAuditFieldLabel,
  getAuditRoleLabel,
  getAuditTitle,
  getVisibleAuditChanges,
} from './auditPresentation.ts';

const readLocale = (path) => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);
const [commonTh, commonEn, statusesTh, statusesEn] = await Promise.all([
  readLocale('../locales/th/common.json'),
  readLocale('../locales/en/common.json'),
  readLocale('../locales/th/statuses.json'),
  readLocale('../locales/en/statuses.json'),
]);

async function makeTranslator(language) {
  const instance = i18next.createInstance();
  await instance.init({
    resources: {
      th: { common: commonTh, statuses: statusesTh },
      en: { common: commonEn, statuses: statusesEn },
    },
    lng: language,
    fallbackLng: 'th',
    defaultNS: 'common',
    ns: ['common', 'statuses'],
    keySeparator: false,
    nsSeparator: false,
  });
  return instance.getFixedT(language, 'common');
}

test('audit presentation resolves the exact Thai and English title, fields, unset value, and actor role', async () => {
  const th = await makeTranslator('th');
  const en = await makeTranslator('en');

  assert.equal(getAuditTitle('EXAM', th, 'th'), 'แก้ไขข้อมูลข้อสอบ');
  assert.equal(getAuditTitle('EXAM', en, 'en'), 'Exam information updated');
  assert.equal(getAuditFieldLabel('num_copies', th, 'th'), 'จำนวนชุดที่ต้องการพิมพ์');
  assert.equal(getAuditFieldLabel('numCopies', en, 'en'), 'Number of Copies');
  assert.equal(formatAuditValue(null, th, 'th'), 'ไม่ได้ระบุ');
  assert.equal(formatAuditValue('', en, 'en'), 'Not specified');
  assert.equal(getAuditRoleLabel('INSTRUCTOR', th, 'th'), 'อาจารย์ผู้สอน (Instructor)');
  assert.equal(getAuditRoleLabel('INSTRUCTOR', en, 'en'), 'Instructor');
});

test('all backend audit fields have localized labels and no literal translation keys are returned', async () => {
  const th = await makeTranslator('th');
  const en = await makeTranslator('en');
  const fields = [
    'course_id', 'schedule_id', 'deadline_at', 'original_filename', 'file_type', 'file_size', 'file',
    'num_copies', 'student_count', 'reserve_copies', 'section', 'num_pages', 'exam_language',
    'print_format', 'allowed_materials', 'requires_answer_sheet', 'exam_session_type',
    'special_instructions', 'is_double_sided', 'paper_size', 'exam_type', 'exam_date', 'start_time',
    'end_time', 'room', 'coordinator_id', 'deadline_date', 'course_code', 'course_name',
    'instructor_id', 'department', 'semester', 'academic_year',
  ];
  for (const field of fields) {
    const thaiLabel = getAuditFieldLabel(field, th, 'th');
    const englishLabel = getAuditFieldLabel(field, en, 'en');
    assert.ok(thaiLabel && englishLabel);
    assert.doesNotMatch(`${thaiLabel} ${englishLabel}`, /audit\.|num_copies|student_count|special_instructions/);
  }

  const visible = getVisibleAuditChanges({
    special_instructions: { before: null, after: '' },
    num_copies: { before: 2, after: 333 },
  });
  assert.deepEqual(visible.map(([field]) => field), ['num_copies']);
  const rendered = [
    getAuditTitle('EXAM', th, 'th'),
    ...visible.map(([field, change]) => `${getAuditFieldLabel(field, th, 'th')}: ${formatAuditValue(change.before, th, 'th', field)} → ${formatAuditValue(change.after, th, 'th', field)}`),
  ].join('\n');
  assert.match(rendered, /แก้ไขข้อมูลข้อสอบ/);
  assert.match(rendered, /จำนวนชุดที่ต้องการพิมพ์: 2 → 333/);
  assert.doesNotMatch(rendered, /audit\.examUpdated|audit\.valueNotSet|num_copies|special_instructions/);
});

test('enum values and missing translations do not expose raw audit keys or enum names', async () => {
  const th = await makeTranslator('th');
  assert.equal(formatAuditValue('FINAL', th, 'th', 'exam_type'), 'สอบปลายภาค');
  assert.equal(formatAuditValue('["BOOK","OTHER:เครื่องคิดเลขกราฟิก"]', th, 'th', 'allowed_materials'), 'อนุญาตนำตำราเข้าห้องสอบ, เครื่องคิดเลขกราฟิก');
  const en = await makeTranslator('en');
  assert.equal(formatAuditValue('["NONE"]', en, 'en', 'allowed_materials'), 'No additional materials');
  assert.equal(getAuditFieldLabel('unknown_internal_field', th, 'th'), 'ข้อมูลอื่น');
  assert.equal(getAuditTitle('UNKNOWN', th, 'th'), 'แก้ไขข้อมูล');
});
