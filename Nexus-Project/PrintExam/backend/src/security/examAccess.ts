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
