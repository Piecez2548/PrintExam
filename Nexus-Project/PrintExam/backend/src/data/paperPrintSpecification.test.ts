import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaperPrintSpecification } from './paperPrintSpecification';

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

test('unsupported paper weights and sizes are rejected without changing exam settings', () => {
  assert.deepEqual(createPaperPrintSpecification('A4', true, '90gsm'), {
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
