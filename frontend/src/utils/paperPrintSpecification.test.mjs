import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  APPROVED_PAPER_WEIGHTS,
  DEFAULT_PAPER_WEIGHT,
  formatPaperPrintPreview,
  PAPER_WEIGHT_LABEL_KEYS,
} from './paperPrintSpecification.ts';

const th = JSON.parse(readFileSync(new URL('../locales/th/avStaff.json', import.meta.url), 'utf8'));
const en = JSON.parse(readFileSync(new URL('../locales/en/avStaff.json', import.meta.url), 'utf8'));

test('paper-weight control exposes exactly two approved options and defaults to 80gsm', () => {
  assert.deepEqual(APPROVED_PAPER_WEIGHTS, ['80gsm', '100gsm']);
  assert.equal(DEFAULT_PAPER_WEIGHT, '80gsm');
  assert.deepEqual(Object.keys(PAPER_WEIGHT_LABEL_KEYS), ['80gsm', '100gsm']);
});

test('final preview changes with selected weight and sidedness label', () => {
  assert.equal(formatPaperPrintPreview('A4', '80gsm', 'หน้า-หลัง'), 'A4 • 80gsm • หน้า-หลัง');
  assert.equal(formatPaperPrintPreview('A4', '100gsm', 'หน้า-หลัง'), 'A4 • 100gsm • หน้า-หลัง');
  assert.equal(formatPaperPrintPreview('A4', '100gsm', 'Double-sided'), 'A4 • 100gsm • Double-sided');
  assert.equal(formatPaperPrintPreview('A4', '100gsm', 'หน้าเดียว'), 'A4 • 100gsm • หน้าเดียว');
});

test('Thai and English labels are localized while paper weight values stay canonical', () => {
  assert.equal(th['น้ำหนักกระดาษ'], 'น้ำหนักกระดาษ');
  assert.equal(en['น้ำหนักกระดาษ'], 'Paper Weight');
  assert.equal(th[PAPER_WEIGHT_LABEL_KEYS['80gsm']], '80gsm — กระดาษมาตรฐาน');
  assert.equal(th[PAPER_WEIGHT_LABEL_KEYS['100gsm']], '100gsm — กระดาษหนา');
  assert.equal(en[PAPER_WEIGHT_LABEL_KEYS['80gsm']], '80gsm — Standard paper');
  assert.equal(en[PAPER_WEIGHT_LABEL_KEYS['100gsm']], '100gsm — Heavy paper');
  assert.deepEqual(APPROVED_PAPER_WEIGHTS, ['80gsm', '100gsm']);
});
