import { UserRole } from '../../generated/prisma';

export interface ExamFileUser {
  id: number;
  role: UserRole;
}

export interface ExamFileOwner {
  createdById: number;
  course?: { instructorId: number } | null;
}

export function canAccessExamFile(user: ExamFileUser | undefined, exam: ExamFileOwner): boolean {
  if (!user) return false;
  if (user.role === UserRole.AV_STAFF || user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.INSTRUCTOR) {
    return exam.createdById === user.id || exam.course?.instructorId === user.id;
  }
  return false;
}

/** Envelope labels are operational documents, but an instructor may view the
 * label for an exam they own. This remains separate from raw exam-file access. */
export function canAccessExamEnvelope(user: ExamFileUser | undefined, exam: ExamFileOwner): boolean {
  if (!user) return false;
  if (
    user.role === UserRole.AV_STAFF ||
    user.role === UserRole.COORDINATOR ||
    user.role === UserRole.ADMIN
  ) {
    return true;
  }
  if (user.role === UserRole.INSTRUCTOR) {
    return exam.createdById === user.id || exam.course?.instructorId === user.id;
  }
  return false;
}
