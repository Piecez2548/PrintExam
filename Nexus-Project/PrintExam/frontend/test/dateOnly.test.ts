import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addCalendarDays, isValidDateOnly, toDateInputValue } from '../src/utils/dateOnly';

test('subtracts five calendar days without timezone parsing', () => {
  assert.equal(addCalendarDays('2026-10-12', -5), '2026-10-07');
  assert.equal(addCalendarDays('2026-10-29', -5), '2026-10-24');
  assert.equal(addCalendarDays('2026-11-01', -5), '2026-10-27');
  assert.equal(addCalendarDays('2026-03-01', -5), '2026-02-24');
});

test('handles invalid and month-boundary date-only values', () => {
  assert.equal(addCalendarDays('2026-01-01', -1), '2025-12-31');
  assert.equal(isValidDateOnly('2026-02-29'), false);
  assert.equal(addCalendarDays('2026-02-29', -5), '');
  assert.equal(toDateInputValue('2026-10-12'), '2026-10-12');
});
