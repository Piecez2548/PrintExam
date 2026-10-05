import { Router, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { UserRole, Prisma } from '../../generated/prisma';
import { recordAuditLog } from '../middleware/audit';
import { notifyRole } from '../services/notificationService';
import { buildAuditChanges } from '../data/auditTrail';

const router = Router();

// Helper to format course object for frontend
function formatCourse(c: any) {
  return {
    id: c.id,
    course_code: c.courseCode,
    course_name: c.courseName,
    instructor_id: c.instructorId,
    instructor_name: c.instructor ? c.instructor.fullName : undefined,
    instructor_deleted: Boolean(c.instructor?.deletedAt),
    instructor_email: c.instructor ? c.instructor.email : undefined,
    instructor_department: c.instructor ? c.instructor.department : undefined,
    department: c.department,
    section: c.section,
    semester: c.semester,
    student_count: c.studentCount,
    academic_year: c.academicYear,
    created_at: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updated_at: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
  };
}

// Get all courses (public to all authenticated users)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const { instructor_id, semester, academic_year, search } = req.query;

  try {
    const where: Prisma.CourseWhereInput = {};

    if (instructor_id) {
      where.instructorId = Number(instructor_id);
    } else if (req.user?.role === UserRole.INSTRUCTOR) {
      where.instructorId = req.user.id;
    }

    if (semester) {
      where.semester = Number(semester);
    }

    if (academic_year) {
      where.academicYear = String(academic_year);
    }

    if (search) {
      const s = String(search);
      where.OR = [
        { courseCode: { contains: s, mode: 'insensitive' } },
        { courseName: { contains: s, mode: 'insensitive' } },
        { instructor: { fullName: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const courses = await prisma.course.findMany({
      where,
      include: {
        instructor: true,
      },
      orderBy: { courseCode: 'asc' },
      take: 500,
    });

    res.json({ success: true, data: courses.map(formatCourse) });
  } catch (error) {
    console.error('[Course List Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายวิชา' });
  }
});

// Create course (Instructor, Coordinator & Admin)
router.post(
  '/',
  authenticateToken,
  requireRole(UserRole.INSTRUCTOR, UserRole.COORDINATOR, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
    let { course_code, course_name, instructor_id, department, section, semester, student_count, academic_year } = req.body;

    if (req.user?.role === UserRole.INSTRUCTOR) {
      instructor_id = req.user.id;
    }

    if (!course_code || !course_name || !instructor_id) {
      res.status(400).json({ success: false, message: 'กรุณากรอกรหัสวิชา, ชื่อวิชา, และระบุอาจารย์ผู้สอน' });
      return;
    }

    const normalizedSemester = Number(semester || 1);
    const normalizedStudentCount = Number(student_count || 1);
    if (![1, 2, 3].includes(normalizedSemester)) {
      res.status(400).json({ success: false, message: 'ภาคการศึกษาต้องเป็นภาค 1, ภาค 2 หรือซัมเมอร์' });
      return;
    }
    if (!Number.isInteger(normalizedStudentCount) || normalizedStudentCount < 1) {
      res.status(400).json({ success: false, message: 'จำนวนนักศึกษาต้องเป็นจำนวนเต็มอย่างน้อย 1 คน' });
      return;
    }

    try {
      const instructor = await prisma.user.findFirst({
        where: { id: Number(instructor_id), role: UserRole.INSTRUCTOR, isActive: true },
        select: { id: true },
      });
      if (!instructor) {
        res.status(400).json({ success: false, message: 'ไม่พบบัญชีอาจารย์ผู้สอนที่ใช้งานได้' });
        return;
      }

      const normalizedCode = String(course_code).trim().toUpperCase();
      const normalizedSection = String(section || '').trim();
      const normalizedYear = String(academic_year || '2569').trim();
      const duplicate = await prisma.course.findFirst({
        where: {
          courseCode: normalizedCode,
          instructorId: Number(instructor_id),
          section: normalizedSection || null,
          semester: normalizedSemester,
          academicYear: normalizedYear,
        },
        select: { id: true },
      });
      if (duplicate) {
        res.status(409).json({ success: false, message: 'รายวิชา ตอน ภาค และปีการศึกษานี้มีอยู่แล้ว' });
        return;
      }

      const newCourse = await prisma.course.create({
        data: {
          courseCode: normalizedCode,
          courseName: String(course_name).trim(),
          instructorId: Number(instructor_id),
          department: department || null,
          section: normalizedSection || null,
          semester: normalizedSemester,
          studentCount: normalizedStudentCount,
          academicYear: normalizedYear,
        },
        include: {
          instructor: true,
        },
      });

      await recordAuditLog(
        req.user!.id,
        req.user!.full_name,
        req.user!.role,
        'CREATE_COURSE',
        'COURSE',
        newCourse.id.toString(),
        req.ip || '127.0.0.1',
        {
          course_code,
          course_name,
          instructor_id,
          section: normalizedSection || null,
          semester: normalizedSemester,
          academic_year: normalizedYear,
          student_count: normalizedStudentCount,
        }
      );

      if (req.user?.role === UserRole.INSTRUCTOR) {
        await notifyRole(
          UserRole.COORDINATOR,
          'COURSE_WAITING_FOR_SCHEDULE',
          `มีรายวิชาใหม่รอกำหนดตารางสอบ: ${normalizedCode}`,
          `${newCourse.courseName}${normalizedSection ? ` ตอน ${normalizedSection}` : ''} โดย ${newCourse.instructor.fullName} กรุณากำหนดวัน เวลา ห้องสอบ และกำหนดส่งข้อสอบ`,
          '/coordinator/courses'
        );
      }

      res.status(201).json({ success: true, message: 'เพิ่มรายวิชาสำเร็จ', data: formatCourse(newCourse) });
    } catch (error) {
      console.error('[Create Course Error]', error);
      if ((error as { code?: string }).code === 'P2002') {
        res.status(409).json({ success: false, message: 'รายวิชา ตอน ภาค และปีการศึกษานี้มีอยู่แล้ว' });
        return;
      }
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้างรายวิชา' });
    }
  }
);

// Update course
router.put(
  '/:id',
  authenticateToken,
  requireRole(UserRole.COORDINATOR, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { course_code, course_name, instructor_id, department, section, semester, student_count, academic_year } = req.body;
    const courseId = Number(id);

    if (semester !== undefined && ![1, 2, 3].includes(Number(semester))) {
      res.status(400).json({ success: false, message: 'ภาคการศึกษาต้องเป็นภาค 1, ภาค 2 หรือซัมเมอร์' });
      return;
    }
    if (student_count !== undefined && (!Number.isInteger(Number(student_count)) || Number(student_count) < 1)) {
      res.status(400).json({ success: false, message: 'จำนวนนักศึกษาต้องเป็นจำนวนเต็มอย่างน้อย 1 คน' });
      return;
    }

    try {
      if (instructor_id !== undefined) {
        const instructor = await prisma.user.findFirst({
          where: { id: Number(instructor_id), role: UserRole.INSTRUCTOR, isActive: true },
          select: { id: true },
        });
        if (!instructor) {
          res.status(400).json({ success: false, message: 'ผู้รับผิดชอบรายวิชาต้องเป็นบัญชีอาจารย์ที่เปิดใช้งานอยู่' });
          return;
        }
      }
      const courseUpdateData = {
        courseCode: course_code ? course_code.toUpperCase() : undefined,
        courseName: course_name !== undefined ? course_name : undefined,
        instructorId: instructor_id !== undefined ? Number(instructor_id) : undefined,
        department: department !== undefined ? department : undefined,
        section: section !== undefined ? String(section).trim() || null : undefined,
        semester: semester !== undefined ? Number(semester) : undefined,
        studentCount: student_count !== undefined ? Number(student_count) : undefined,
        academicYear: academic_year !== undefined ? String(academic_year) : undefined,
      };
      const updated = await prisma.$transaction(async (tx) => {
        const current = await tx.course.findUnique({ where: { id: courseId } });
        if (!current) throw new Error('Course not found');
        const saved = await tx.course.update({
          where: { id: courseId },
          data: courseUpdateData,
          include: { instructor: true },
        });
        const courseAuditBefore: Record<string, unknown> = {
          course_code: current.courseCode,
          course_name: current.courseName,
          instructor_id: current.instructorId,
          department: current.department,
          section: current.section,
          semester: current.semester,
          student_count: current.studentCount,
          academic_year: current.academicYear,
        };
        const courseAuditAfter: Record<string, unknown> = {
          course_code: saved.courseCode,
          course_name: saved.courseName,
          instructor_id: saved.instructorId,
          department: saved.department,
          section: saved.section,
          semester: saved.semester,
          student_count: saved.studentCount,
          academic_year: saved.academicYear,
        };
        const courseChanges = buildAuditChanges(courseAuditBefore, courseAuditAfter, Object.keys(courseAuditBefore));
        if (Object.keys(courseChanges).length > 0) {
          const relatedExams = await tx.exam.findMany({ where: { courseId }, select: { id: true } });
          await tx.auditLog.create({
            data: {
              userId: req.user!.id,
              userName: req.user!.full_name,
              userRole: req.user!.role,
              action: 'UPDATE_COURSE',
              entityType: 'COURSE',
              entityId: String(courseId),
              ipAddress: req.ip || '127.0.0.1',
              detailJson: JSON.stringify({
                audit_version: 1,
                updated_fields: { course_code, course_name, instructor_id },
                related_exam_ids: relatedExams.map((entry) => entry.id),
                related_entity_type: 'COURSE',
                related_entity_id: courseId,
                changes: courseChanges,
              }),
            },
          });
        }
        return saved;
      });
      req.auditHandledAtomically = true;

      res.json({ success: true, message: 'แก้ไขข้อมูลรายวิชาสำเร็จ', data: formatCourse(updated) });
    } catch (error) {
      console.error('[Update Course Error]', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลรายวิชา' });
    }
  }
);

// Delete course
router.delete(
  '/:id',
  authenticateToken,
  requireRole(UserRole.COORDINATOR, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const courseId = Number(id);

    try {
      const examsCount = await prisma.exam.count({
        where: { courseId },
      });

      if (examsCount > 0) {
        res.status(400).json({ success: false, message: 'ไม่สามารถลบรายวิชานี้ได้ เนื่องจากมีข้อสอบที่ผูกอยู่ในระบบแล้ว' });
        return;
      }
      const schedulesCount = await prisma.examSchedule.count({ where: { courseId } });
      if (schedulesCount > 0) {
        res.status(409).json({ success: false, message: 'ไม่สามารถลบรายวิชาที่เคยกำหนดตารางสอบแล้ว กรุณาเก็บไว้เป็นประวัติ' });
        return;
      }

      await prisma.course.delete({
        where: { id: courseId },
      });

      await recordAuditLog(
        req.user!.id,
        req.user!.full_name,
        req.user!.role,
        'DELETE_COURSE',
        'COURSE',
        id,
        req.ip || '127.0.0.1',
        {
          deleted_course_id: id,
        }
      );

      res.json({ success: true, message: 'ลบรายวิชาเรียบร้อยแล้ว' });
    } catch (error) {
      console.error('[Delete Course Error]', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบรายวิชา' });
    }
  }
);

export default router;
