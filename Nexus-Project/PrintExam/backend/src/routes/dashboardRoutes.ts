import { Router, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { ExamStatus, Prisma } from '../../generated/prisma';

const router = Router();

// Get summary metrics and filterable summary data (REQ-0014)
router.get('/summary', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    exam_date,
    course_code,
    instructor_id,
    status,
    room,
    coordinator_id,
    semester,
    academic_year,
  } = req.query;

  try {
    // 1. Overall counts by status. The overview is intentionally system-wide
    // and identical for every authenticated role; role-specific work remains
    // in each role's dedicated operational pages.
    const countWhere: Prisma.ExamWhereInput = { status: { not: ExamStatus.CANCELLED } };

    const rawCounts = await prisma.exam.groupBy({
      by: ['status'],
      where: countWhere,
      _count: {
        _all: true,
      },
    });

    const statusCounts: Record<string, number> = {
      TOTAL: 0,
      [ExamStatus.DRAFT]: 0,
      [ExamStatus.SUBMITTED]: 0,
      [ExamStatus.REJECTED]: 0,
      [ExamStatus.APPROVED]: 0,
      [ExamStatus.PRINTING]: 0,
      [ExamStatus.PRINTED]: 0,
      [ExamStatus.PACKED]: 0,
      [ExamStatus.READY_FOR_PICKUP]: 0,
      [ExamStatus.DELIVERED]: 0,
      [ExamStatus.CANCELLED]: 0,
    };

    let total = 0;
    rawCounts.forEach((rc) => {
      statusCounts[rc.status] = rc._count._all;
      total += rc._count._all;
    });
    statusCounts.TOTAL = total;

    // 2. Filtered Detailed Table Query (REQ-0014)
    const listWhere: Prisma.ExamWhereInput = { status: { not: ExamStatus.CANCELLED } };
    const courseFilter: Prisma.CourseWhereInput = {};
    const scheduleFilter: Prisma.ExamScheduleWhereInput = {};

    if (instructor_id) {
      courseFilter.instructorId = Number(instructor_id);
    }

    if (course_code) {
      courseFilter.courseCode = { contains: String(course_code), mode: 'insensitive' };
    }

    if (semester) {
      courseFilter.semester = Number(semester);
    }

    if (academic_year) {
      courseFilter.academicYear = String(academic_year);
    }

    if (exam_date) {
      scheduleFilter.examDate = String(exam_date);
    }

    if (room) {
      scheduleFilter.room = { contains: String(room), mode: 'insensitive' };
    }

    if (coordinator_id) {
      scheduleFilter.coordinatorId = Number(coordinator_id);
    }

    if (status && Object.values(ExamStatus).includes(status as ExamStatus)) {
      listWhere.status = status as ExamStatus;
    }

    if (Object.keys(courseFilter).length > 0) {
      listWhere.course = courseFilter;
    }

    if (Object.keys(scheduleFilter).length > 0) {
      listWhere.schedule = scheduleFilter;
    }

    const exams = await prisma.exam.findMany({
      where: listWhere,
      include: {
        course: {
          include: {
            instructor: true,
          },
        },
        schedule: {
          include: {
            coordinator: true,
          },
        },
      },
      orderBy: [
        { schedule: { examDate: 'asc' } },
        { course: { courseCode: 'asc' } },
      ],
      take: 500,
    });

    const rows = exams.map((e) => ({
      exam_id: e.id,
      status: e.status,
      num_copies: e.numCopies,
      num_pages: e.numPages,
      is_double_sided: e.isDoubleSided ? 1 : 0,
      paper_size: e.paperSize,
      submitted_at: e.submittedAt instanceof Date ? e.submittedAt.toISOString() : e.submittedAt,
      deadline_at: e.deadlineAt instanceof Date ? e.deadlineAt.toISOString() : e.deadlineAt,
      course_id: e.courseId,
      course_code: e.course?.courseCode,
      course_name: e.course?.courseName,
      semester: e.course?.semester,
      academic_year: e.course?.academicYear,
      instructor_id: e.course?.instructorId,
      instructor_name: e.course?.instructor?.fullName,
      instructor_department: e.course?.instructor?.department,
      schedule_id: e.scheduleId,
      exam_date: e.schedule?.examDate,
      start_time: e.schedule?.startTime,
      end_time: e.schedule?.endTime,
      room: e.schedule?.room,
      exam_type: e.schedule?.examType,
      schedule_status: e.schedule?.status,
      coordinator_id: e.schedule?.coordinatorId,
      coordinator_name: e.schedule?.coordinator?.fullName,
    }));

    // Total summary statistics
    const totalCopies = rows.reduce((acc: number, item: any) => acc + (item.num_copies || 0), 0);
    const totalCourses = new Set(rows.map((r: any) => r.course_code).filter(Boolean)).size;

    res.json({
      success: true,
      data: {
        statusCounts,
        totalCopies,
        totalCourses,
        exams: rows,
      },
    });
  } catch (error) {
    console.error('[Dashboard Summary Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลภาพรวม' });
  }
});

export default router;
