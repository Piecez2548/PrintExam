import test from 'node:test';
import assert from 'node:assert/strict';
import { UserRole } from '../../generated/prisma';
import { canAccessExamEnvelope, canAccessExamFile } from '../../src/security/examAccess';

const instructorExam = { createdById: 2, course: { instructorId: 2 } };
const otherInstructorExam = { createdById: 6, course: { instructorId: 6 } };

test('instructor can access only an owned exam file', () => {
  assert.equal(canAccessExamFile({ id: 2, role: UserRole.INSTRUCTOR }, instructorExam), true);
  assert.equal(canAccessExamFile({ id: 2, role: UserRole.INSTRUCTOR }, otherInstructorExam), false);
});

test('AV staff and admin can access operational exam files', () => {
  assert.equal(canAccessExamFile({ id: 4, role: UserRole.AV_STAFF }, otherInstructorExam), true);
  assert.equal(canAccessExamFile({ id: 1, role: UserRole.ADMIN }, otherInstructorExam), true);
});

test('coordinator and anonymous requests cannot access exam files', () => {
  assert.equal(canAccessExamFile({ id: 5, role: UserRole.COORDINATOR }, instructorExam), false);
  assert.equal(canAccessExamFile(undefined, instructorExam), false);
});

test('cover sheet access allows an owning instructor and authorized operational roles', () => {
  assert.equal(canAccessExamEnvelope({ id: 2, role: UserRole.INSTRUCTOR }, instructorExam), true);
  assert.equal(canAccessExamEnvelope({ id: 4, role: UserRole.AV_STAFF }, otherInstructorExam), true);
  assert.equal(canAccessExamEnvelope({ id: 5, role: UserRole.COORDINATOR }, otherInstructorExam), true);
  assert.equal(canAccessExamEnvelope({ id: 1, role: UserRole.ADMIN }, otherInstructorExam), true);
});

test('cover sheet access denies another instructor and unauthenticated requests', () => {
  assert.equal(canAccessExamEnvelope({ id: 2, role: UserRole.INSTRUCTOR }, otherInstructorExam), false);
  assert.equal(canAccessExamEnvelope(undefined, instructorExam), false);
});
