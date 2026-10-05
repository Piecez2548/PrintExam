import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getLatestAllowedDeadlineDate,
  isDeadlineAtLeastTwoDaysBeforeExam,
  normalizeStoredCalendarDate,
} from './examScheduleDeadline';

test('enforces the two-calendar-day boundary for October 19, 2026', () => {
  assert.equal(getLatestAllowedDeadlineDate('2026-10-19'), '2026-10-17');
  assert.equal(isDeadlineAtLeastTwoDaysBeforeExam('2026-10-17', '2026-10-19'), true);
  assert.equal(isDeadlineAtLeastTwoDaysBeforeExam('2026-10-16', '2026-10-19'), true);
  assert.equal(isDeadlineAtLeastTwoDaysBeforeExam('2026-10-18', '2026-10-19'), false);
  assert.equal(isDeadlineAtLeastTwoDaysBeforeExam('2026-10-19', '2026-10-19'), false);
  assert.equal(isDeadlineAtLeastTwoDaysBeforeExam('2026-10-20', '2026-10-19'), false);
});

test('subtracts two calendar days across month and year boundaries', () => {
  assert.equal(getLatestAllowedDeadlineDate('2026-11-01'), '2026-10-30');
  assert.equal(getLatestAllowedDeadlineDate('2027-01-01'), '2026-12-30');
});

test('uses Gregorian leap-year arithmetic and validates actual calendar dates', () => {
  assert.equal(getLatestAllowedDeadlineDate('2024-03-02'), '2024-02-29');
  assert.equal(getLatestAllowedDeadlineDate('2023-03-01'), '2023-02-27');
  assert.equal(getLatestAllowedDeadlineDate('2026-02-30'), null);
  assert.equal(isDeadlineAtLeastTwoDaysBeforeExam('2026-02-30', '2026-03-10'), false);
});

test('normalizes legacy canonical ISO timestamps by their stored UTC date', () => {
  assert.equal(normalizeStoredCalendarDate('2026-10-17'), '2026-10-17');
  assert.equal(normalizeStoredCalendarDate('2026-10-17T00:00:00.000Z'), '2026-10-17');
  assert.equal(normalizeStoredCalendarDate('2026-02-30T00:00:00.000Z'), null);
  assert.equal(normalizeStoredCalendarDate('2026-10-17T00:00:00+07:00'), null);
});
