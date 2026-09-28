import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isDateOnlyBefore, isValidDateOnly } from '../../src/utils/dateOnly';

test('validates calendar-only dates strictly', () => {
  assert.equal(isValidDateOnly('2026-10-12'), true);
  assert.equal(isValidDateOnly('2026-02-29'), false);
  assert.equal(isValidDateOnly('2026-10-1'), false);
});

test('requires deadline to be before exam date', () => {
  assert.equal(isDateOnlyBefore('2026-10-07', '2026-10-12'), true);
  assert.equal(isDateOnlyBefore('2026-10-12', '2026-10-12'), false);
  assert.equal(isDateOnlyBefore('2026-10-13', '2026-10-12'), false);
});
