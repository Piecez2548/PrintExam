import { Router, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { UserRole, Prisma } from '../../generated/prisma';
import { recordAuditLog } from '../middleware/audit';

const router = Router();

// Helper to format course object for frontend
function formatCourse(c: any) {
  return {
    id: c.id,
    course_code: c.courseCode,
    course_name: c.courseName,
    instructor_id: c.instructorId,
    instructor_name: c.instructor ? c.instructor.fullName : undefined,
    instructor_email: c.instructor ? c.instructor.email : undefined,
    instructor_department: c.instructor ? c.instructor.department : undefined,
    department: c.department,
    semester: c.semester,
    academic_year: c.academicYear,
    created_at: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updated_at: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
  };
}

// Get all courses (public to all authenticated users)
router.get(
  '/',
  authenticateToken,
  requireRole(UserRole.INSTRUCTOR, UserRole.COORDINATOR, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
  const { instructor_id, semester, academic_year, search } = req.query;

  try {
    const where: Prisma.CourseWhereInput = {};

    if (instructor_id) {
      where.instructorId = Number(instructor_id);
    } else if (req.user?.role === UserRole.INSTRUCTOR && req.query.all !== 'true') {
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
    });

    res.json({ success: true, data: courses.map(formatCourse) });
  } catch (error) {
    console.error('[Course List Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายวิชา' });
  }
  }
);

// Create course (Instructor, Coordinator & Admin)
router.post(
  '/',
  authenticateToken,
  requireRole(UserRole.INSTRUCTOR, UserRole.COORDINATOR, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
    let { course_code, course_name, instructor_id, department, semester, academic_year } = req.body;

    if (req.user?.role === UserRole.INSTRUCTOR) {
      instructor_id = req.user.id;
    }

    if (!course_code || !course_name || !instructor_id) {
      res.status(400).json({ success: false, message: 'กรุณากรอกรหัสวิชา, ชื่อวิชา, และระบุอาจารย์ผู้สอน' });
      return;
    }

    try {
      const normalizedCode = String(course_code).trim().toUpperCase();
      const instructorId = Number(instructor_id);
      const instructor = await prisma.user.findUnique({ where: { id: instructorId } });
      if (!instructor || instructor.role !== UserRole.INSTRUCTOR || !instructor.isActive) {
        res.status(400).json({ success: false, message: 'ต้องระบุอาจารย์ผู้สอนที่มีบัญชีและเปิดใช้งานอยู่' });
        return;
      }

      const duplicate = await prisma.course.findFirst({
        where: {
          courseCode: normalizedCode,
          instructorId,
          semester: Number(semester || 1),
          academicYear: String(academic_year || '2569'),
        },
      });
      if (duplicate) {
        res.status(409).json({ success: false, message: 'รายวิชานี้มีอยู่แล้วสำหรับอาจารย์และภาคการศึกษานี้' });
        return;
      }

      const newCourse = await prisma.course.create({
        data: {
          courseCode: normalizedCode,
          courseName: String(course_name).trim(),
          instructorId,
          department: department || null,
          semester: Number(semester || 1),
          academicYear: academic_year || '2569',
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
        course_code: normalizedCode,
        course_name: String(course_name).trim(),
        instructor_id: instructorId,
        }
      );

      res.status(201).json({ success: true, message: 'เพิ่มรายวิชาสำเร็จ', data: formatCourse(newCourse) });
    } catch (error) {
      console.error('[Create Course Error]', error);
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
    const { course_code, course_name, instructor_id, department, semester, academic_year } = req.body;
    const courseId = Number(id);

    try {
      const current = await prisma.course.findUnique({ where: { id: courseId } });
      if (!current) {
        res.status(404).json({ success: false, message: 'ไม่พบรายวิชาที่ระบุ' });
        return;
      }

      const nextInstructorId = instructor_id !== undefined ? Number(instructor_id) : current.instructorId;
      const instructor = await prisma.user.findUnique({ where: { id: nextInstructorId } });
      if (!instructor || instructor.role !== UserRole.INSTRUCTOR || !instructor.isActive) {
        res.status(400).json({ success: false, message: 'ต้องระบุอาจารย์ผู้สอนที่มีบัญชีและเปิดใช้งานอยู่' });
        return;
      }

      const nextCode = course_code !== undefined ? String(course_code).trim().toUpperCase() : current.courseCode;
      const nextSemester = semester !== undefined ? Number(semester) : current.semester;
      const nextYear = academic_year !== undefined ? String(academic_year) : current.academicYear;
      const duplicate = await prisma.course.findFirst({
        where: {
          courseCode: nextCode,
          instructorId: nextInstructorId,
          semester: nextSemester,
          academicYear: nextYear,
          NOT: { id: courseId },
        },
      });
      if (duplicate) {
        res.status(409).json({ success: false, message: 'รายวิชานี้มีอยู่แล้วสำหรับอาจารย์และภาคการศึกษานี้' });
        return;
      }

      const updated = await prisma.course.update({
        where: { id: courseId },
        data: {
          courseCode: course_code ? course_code.toUpperCase() : undefined,
          courseName: course_name !== undefined ? course_name : undefined,
          instructorId: instructor_id !== undefined ? nextInstructorId : undefined,
          department: department !== undefined ? department : undefined,
          semester: semester !== undefined ? Number(semester) : undefined,
          academicYear: academic_year !== undefined ? String(academic_year) : undefined,
        },
        include: {
          instructor: true,
        },
      });

      await recordAuditLog(
        req.user!.id,
        req.user!.full_name,
        req.user!.role,
        'UPDATE_COURSE',
        'COURSE',
        id,
        req.ip || '127.0.0.1',
        {
          updated_fields: { course_code, course_name, instructor_id },
        }
      );

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
