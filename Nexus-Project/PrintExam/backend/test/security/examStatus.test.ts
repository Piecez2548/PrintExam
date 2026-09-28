import test from 'node:test';
import assert from 'node:assert/strict';
import { ExamStatus } from '../../generated/prisma';
import { canTransitionExamStatus } from '../../src/security/examStatus';

test('required happy-path transitions are allowed', () => {
  const path: Array<[ExamStatus, ExamStatus]> = [
    [ExamStatus.DRAFT, ExamStatus.SUBMITTED],
    [ExamStatus.SUBMITTED, ExamStatus.APPROVED],
    [ExamStatus.APPROVED, ExamStatus.PRINTING],
    [ExamStatus.PRINTING, ExamStatus.PRINTED],
    [ExamStatus.PRINTED, ExamStatus.PACKED],
    [ExamStatus.PACKED, ExamStatus.READY_FOR_PICKUP],
    [ExamStatus.READY_FOR_PICKUP, ExamStatus.DELIVERED],
  ];

  for (const [from, to] of path) assert.equal(canTransitionExamStatus(from, to), true, `${from} -> ${to}`);
});

test('rejection and resubmission transitions are allowed', () => {
  assert.equal(canTransitionExamStatus(ExamStatus.SUBMITTED, ExamStatus.REJECTED), true);
  assert.equal(canTransitionExamStatus(ExamStatus.REJECTED, ExamStatus.SUBMITTED), true);
});

test('incompatible status jumps are rejected', () => {
  assert.equal(canTransitionExamStatus(ExamStatus.SUBMITTED, ExamStatus.PACKED), false);
  assert.equal(canTransitionExamStatus(ExamStatus.APPROVED, ExamStatus.DELIVERED), false);
  assert.equal(canTransitionExamStatus(ExamStatus.DELIVERED, ExamStatus.SUBMITTED), false);
});
