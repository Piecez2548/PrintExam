import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatCalendarDate,
  getLatestAllowedDeadlineDate,
  isDeadlineAtLeastTwoDaysBeforeExam,
  normalizeStoredCalendarDate,
  reconcileDeadlineDate,
} from './examScheduleDeadline.ts';

test('frontend date picker and validation use the approved latest deadline', () => {
  assert.equal(getLatestAllowedDeadlineDate('2026-10-19'), '2026-10-17');
  assert.equal(isDeadlineAtLeastTwoDaysBeforeExam('2026-10-17', '2026-10-19'), true);
  assert.equal(isDeadlineAtLeastTwoDaysBeforeExam('2026-10-16', '2026-10-19'), true);
  assert.equal(isDeadlineAtLeastTwoDaysBeforeExam('2026-10-18', '2026-10-19'), false);
});

test('frontend date arithmetic handles month, year, and leap-year boundaries', () => {
  assert.equal(getLatestAllowedDeadlineDate('2026-11-01'), '2026-10-30');
  assert.equal(getLatestAllowedDeadlineDate('2027-01-01'), '2026-12-30');
  assert.equal(getLatestAllowedDeadlineDate('2024-03-02'), '2024-02-29');
});

test('calendar-date display formats a date-only value in the requested locale', () => {
  assert.equal(formatCalendarDate('2026-10-17', 'en-US'), 'Saturday, October 17, 2026');
  assert.match(formatCalendarDate('2026-10-17', 'th-TH'), /17 ตุลาคม 2569/);
});

test('normalizes legacy UTC timestamps without shifting the calendar day', () => {
  assert.equal(normalizeStoredCalendarDate('2026-10-17'), '2026-10-17');
  assert.equal(normalizeStoredCalendarDate('2026-10-17T00:00:00.000Z'), '2026-10-17');
  assert.equal(normalizeStoredCalendarDate('2026-02-30T00:00:00.000Z'), null);
});

test('changing exam date preserves a valid manual deadline and corrects an invalid one', () => {
  assert.equal(reconcileDeadlineDate('2026-10-16', '2026-10-19'), '2026-10-16');
  assert.equal(reconcileDeadlineDate('2026-10-18', '2026-10-19'), '2026-10-17');
  assert.equal(reconcileDeadlineDate('', '2026-10-19'), '2026-10-17');
});
