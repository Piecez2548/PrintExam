import assert from 'node:assert/strict';
import test from 'node:test';
import { APPROVED_PAPER_WEIGHTS, createPaperPrintSpecification } from './paperPrintSpecification';

test('only 80gsm and 100gsm are approved paper weights', () => {
  assert.deepEqual(APPROVED_PAPER_WEIGHTS, ['80gsm', '100gsm']);
});

test('A4, 80gsm, and authoritative double-sided exam setting create the canonical value', () => {
  assert.deepEqual(createPaperPrintSpecification('A4', true, '80gsm'), {
    ok: true,
    paperType: 'A4 80gsm หน้า-หลัง',
  });
});

test('A4, 80gsm, and authoritative single-sided exam setting create the canonical value', () => {
  assert.deepEqual(createPaperPrintSpecification('A4', false, '80gsm'), {
    ok: true,
    paperType: 'A4 80gsm หน้าเดียว',
  });
});

test('A4, 100gsm, and authoritative double-sided exam setting create the canonical value', () => {
  assert.deepEqual(createPaperPrintSpecification('A4', true, '100gsm'), {
    ok: true,
    paperType: 'A4 100gsm หน้า-หลัง',
  });
});

test('A4, 100gsm, and authoritative single-sided exam setting create the canonical value', () => {
  assert.deepEqual(createPaperPrintSpecification('A4', false, '100gsm'), {
    ok: true,
    paperType: 'A4 100gsm หน้าเดียว',
  });
});

test('unsupported paper weights and sizes are rejected without changing exam settings', () => {
  assert.deepEqual(createPaperPrintSpecification('A4', true, '120gsm'), {
    ok: false,
    error: 'UNSUPPORTED_PAPER_WEIGHT',
  });
  assert.deepEqual(createPaperPrintSpecification('Letter', true, '80gsm'), {
    ok: false,
    error: 'UNSUPPORTED_PAPER_SIZE',
  });
});

test('canonical storage is locale-independent', () => {
  const thaiUiResult = createPaperPrintSpecification('A4', true, '80gsm');
  const englishUiResult = createPaperPrintSpecification('A4', true, '80gsm');
  assert.deepEqual(thaiUiResult, englishUiResult);
  assert.equal(thaiUiResult.ok && thaiUiResult.paperType, 'A4 80gsm หน้า-หลัง');
});
