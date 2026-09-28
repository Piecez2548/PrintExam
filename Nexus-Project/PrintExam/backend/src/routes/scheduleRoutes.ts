import { Router, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { UserRole, ExamType, ScheduleStatus, Prisma } from '../../generated/prisma';
import { recordAuditLog } from '../middleware/audit';

const router = Router();

function validateScheduleValues(input: {
  examDate: string;
  startTime: string;
  endTime: string;
  deadlineDate: string;
}): string | null {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  const examDate = new Date(input.examDate);
  const deadlineDate = new Date(input.deadlineDate);
  if ((!datePattern.test(input.examDate) && Number.isNaN(examDate.getTime())) || Number.isNaN(examDate.getTime())) {
    return 'รูปแบบวันสอบไม่ถูกต้อง';
  }
  if ((!datePattern.test(input.deadlineDate) && Number.isNaN(deadlineDate.getTime())) || Number.isNaN(deadlineDate.getTime())) {
    return 'รูปแบบ Deadline ไม่ถูกต้อง';
  }
  if (!timePattern.test(input.startTime) || !timePattern.test(input.endTime)) {
    return 'รูปแบบเวลาเริ่มหรือเวลาสิ้นสุดไม่ถูกต้อง';
  }
  if (input.startTime >= input.endTime) {
    return 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม';
  }
  if (deadlineDate.getTime() >= examDate.getTime()) {
    return 'Deadline ต้องอยู่ก่อนวันสอบ';
  }
  return null;
}

// Helper to format schedule object for frontend
function formatSchedule(es: any) {
  return {
    id: es.id,
    course_id: es.courseId,
    course_code: es.course ? es.course.courseCode : undefined,
    course_name: es.course ? es.course.courseName : undefined,
    instructor_id: es.course ? es.course.instructorId : undefined,
    instructor_name: es.course?.instructor ? es.course.instructor.fullName : undefined,
    exam_type: es.examType,
    exam_date: es.examDate,
    start_time: es.startTime,
    end_time: es.endTime,
    room: es.room,
    coordinator_id: es.coordinatorId,
    coordinator_name: es.coordinator ? es.coordinator.fullName : undefined,
    deadline_date: es.deadlineDate,
    status: es.status,
    created_at: es.createdAt instanceof Date ? es.createdAt.toISOString() : es.createdAt,
    updated_at: es.updatedAt instanceof Date ? es.updatedAt.toISOString() : es.updatedAt,
  };
}

// Get exam schedules
router.get(
  '/',
  authenticateToken,
  requireRole(UserRole.INSTRUCTOR, UserRole.COORDINATOR, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
  const { course_id, status, exam_date } = req.query;

  try {
    const where: Prisma.ExamScheduleWhereInput = {};

    if (course_id) {
      where.courseId = Number(course_id);
    }

    if (status && Object.values(ScheduleStatus).includes(status as ScheduleStatus)) {
      where.status = status as ScheduleStatus;
    }

    if (exam_date) {
      where.examDate = String(exam_date);
    }

    // If instructor, show only schedules for their courses
    if (req.user?.role === UserRole.INSTRUCTOR && req.query.all !== 'true') {
      where.course = {
        instructorId: req.user.id,
      };
    }

    const schedules = await prisma.examSchedule.findMany({
      where,
      include: {
        course: {
          include: {
            instructor: true,
          },
        },
        coordinator: true,
      },
      orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }],
    });

    res.json({ success: true, data: schedules.map(formatSchedule) });
  } catch (error) {
    console.error('[Schedule List Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตารางสอบ' });
  }
  }
);

// Create exam schedule (REQ-0003)
router.post(
  '/',
  authenticateToken,
  requireRole(UserRole.COORDINATOR, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { course_id, exam_type, exam_date, start_time, end_time, room, coordinator_id, deadline_date } = req.body;

    if (!course_id || !exam_date || !start_time || !end_time || !room || !deadline_date) {
      res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลกำหนดการสอบให้ครบถ้วน (Course, Date, Time, Room, Deadline)',
      });
      return;
    }

    try {
      const course = await prisma.course.findUnique({ where: { id: Number(course_id) } });
      if (!course) {
        res.status(404).json({ success: false, message: 'ไม่พบรายวิชาที่ระบุ' });
        return;
      }

      if (!Object.values(ExamType).includes((exam_type || ExamType.FINAL) as ExamType)) {
        res.status(400).json({ success: false, message: 'ประเภทการสอบไม่ถูกต้อง' });
        return;
      }

      const validationError = validateScheduleValues({
        examDate: String(exam_date),
        startTime: String(start_time),
        endTime: String(end_time),
        deadlineDate: String(deadline_date),
      });
      if (validationError) {
        res.status(400).json({ success: false, message: validationError });
        return;
      }

      const duplicate = await prisma.examSchedule.findFirst({
        where: {
          courseId: Number(course_id),
          examType: (exam_type as ExamType) || ExamType.FINAL,
          examDate: String(exam_date),
          status: { not: ScheduleStatus.CANCELLED },
        },
      });
      if (duplicate) {
        res.status(409).json({ success: false, message: 'รายวิชานี้มีตารางสอบประเภทและวันเดียวกันอยู่แล้ว' });
        return;
      }

      const coordinatorId = coordinator_id ? Number(coordinator_id) : req.user!.id;
      const coordinator = await prisma.user.findUnique({ where: { id: coordinatorId } });
      if (!coordinator || coordinator.role !== UserRole.COORDINATOR || !coordinator.isActive) {
        res.status(400).json({ success: false, message: 'ผู้ประสานงานสอบไม่ถูกต้องหรือไม่ได้เปิดใช้งาน' });
        return;
      }

      const newSchedule = await prisma.examSchedule.create({
        data: {
          courseId: Number(course_id),
          examType: (exam_type as ExamType) || ExamType.FINAL,
          examDate: String(exam_date),
          startTime: String(start_time),
          endTime: String(end_time),
          room: String(room),
          coordinatorId,
          deadlineDate: String(deadline_date),
          status: ScheduleStatus.SCHEDULED,
        },
        include: {
          course: {
            include: {
              instructor: true,
            },
          },
          coordinator: true,
        },
      });

      await recordAuditLog(
        req.user!.id,
        req.user!.full_name,
        req.user!.role,
        'CREATE_SCHEDULE',
        'SCHEDULE',
        newSchedule.id.toString(),
        req.ip || '127.0.0.1',
        {
          course_id,
          exam_date,
          room,
        }
      );

      res.status(201).json({ success: true, message: 'สร้างกำหนดการสอบเรียบร้อยแล้ว', data: formatSchedule(newSchedule) });
    } catch (error) {
      console.error('[Create Schedule Error]', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้างกำหนดการสอบ' });
    }
  }
);

// Update exam schedule
router.put(
  '/:id',
  authenticateToken,
  requireRole(UserRole.COORDINATOR, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { exam_type, exam_date, start_time, end_time, room, coordinator_id, deadline_date, status } = req.body;
    const scheduleId = Number(id);

    try {
      const current = await prisma.examSchedule.findUnique({ where: { id: scheduleId } });
      if (!current) {
        res.status(404).json({ success: false, message: 'ไม่พบกำหนดการสอบที่ระบุ' });
        return;
      }

      const nextExamType = exam_type !== undefined ? String(exam_type) : current.examType;
      const nextExamDate = exam_date !== undefined ? String(exam_date) : current.examDate;
      const nextStartTime = start_time !== undefined ? String(start_time) : current.startTime;
      const nextEndTime = end_time !== undefined ? String(end_time) : current.endTime;
      const nextDeadline = deadline_date !== undefined ? String(deadline_date) : current.deadlineDate;
      if (!Object.values(ExamType).includes(nextExamType as ExamType)) {
        res.status(400).json({ success: false, message: 'ประเภทการสอบไม่ถูกต้อง' });
        return;
      }
      const validationError = validateScheduleValues({
        examDate: nextExamDate,
        startTime: nextStartTime,
        endTime: nextEndTime,
        deadlineDate: nextDeadline,
      });
      if (validationError) {
        res.status(400).json({ success: false, message: validationError });
        return;
      }

      if (coordinator_id !== undefined) {
        const coordinatorId = coordinator_id ? Number(coordinator_id) : null;
        if (coordinatorId !== null) {
          const coordinator = await prisma.user.findUnique({ where: { id: coordinatorId } });
          if (!coordinator || coordinator.role !== UserRole.COORDINATOR || !coordinator.isActive) {
            res.status(400).json({ success: false, message: 'ผู้ประสานงานสอบไม่ถูกต้องหรือไม่ได้เปิดใช้งาน' });
            return;
          }
        }
      }

      const duplicate = await prisma.examSchedule.findFirst({
        where: {
          courseId: current.courseId,
          examType: nextExamType as ExamType,
          examDate: nextExamDate,
          status: { not: ScheduleStatus.CANCELLED },
          NOT: { id: scheduleId },
        },
      });
      if (duplicate) {
        res.status(409).json({ success: false, message: 'รายวิชานี้มีตารางสอบประเภทและวันเดียวกันอยู่แล้ว' });
        return;
      }

      if (status === ScheduleStatus.SCHEDULED && current.status !== ScheduleStatus.SCHEDULED) {
        res.status(409).json({ success: false, message: 'ไม่สามารถย้อนสถานะกำหนดการสอบกลับเป็น SCHEDULED ได้' });
        return;
      }

      const updated = await prisma.examSchedule.update({
        where: { id: scheduleId },
        data: {
          examType: nextExamType as ExamType,
          examDate: exam_date !== undefined ? String(exam_date) : undefined,
          startTime: start_time !== undefined ? String(start_time) : undefined,
          endTime: end_time !== undefined ? String(end_time) : undefined,
          room: room !== undefined ? String(room) : undefined,
          coordinatorId: coordinator_id !== undefined ? (coordinator_id ? Number(coordinator_id) : null) : undefined,
          deadlineDate: deadline_date !== undefined ? String(deadline_date) : undefined,
          status: status && Object.values(ScheduleStatus).includes(status) ? (status as ScheduleStatus) : undefined,
        },
        include: {
          course: {
            include: {
              instructor: true,
            },
          },
          coordinator: true,
        },
      });

      await recordAuditLog(
        req.user!.id,
        req.user!.full_name,
        req.user!.role,
        'UPDATE_SCHEDULE',
        'SCHEDULE',
        id,
        req.ip || '127.0.0.1',
        {
          exam_date,
          room,
          status,
        }
      );

      res.json({ success: true, message: 'อัปเดตกำหนดการสอบสำเร็จ', data: formatSchedule(updated) });
    } catch (error) {
      console.error('[Update Schedule Error]', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขกำหนดการสอบ' });
    }
  }
);

// Confirm exam schedule (REQ-0003)
router.patch(
  '/:id/confirm',
  authenticateToken,
  requireRole(UserRole.COORDINATOR, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const scheduleId = Number(id);

    try {
      const current = await prisma.examSchedule.findUnique({ where: { id: scheduleId } });
      if (!current) {
        res.status(404).json({ success: false, message: 'ไม่พบกำหนดการสอบที่ระบุ' });
        return;
      }
      if (current.status !== ScheduleStatus.SCHEDULED) {
        res.status(409).json({ success: false, message: 'ยืนยันได้เฉพาะกำหนดการที่อยู่ในสถานะ SCHEDULED' });
        return;
      }

      await prisma.examSchedule.update({
        where: { id: scheduleId },
        data: { status: ScheduleStatus.CONFIRMED },
      });

      await recordAuditLog(
        req.user!.id,
        req.user!.full_name,
        req.user!.role,
        'CONFIRM_SCHEDULE',
        'SCHEDULE',
        id,
        req.ip || '127.0.0.1',
        {
          status: 'CONFIRMED',
        }
      );

      res.json({ success: true, message: 'ยืนยันกำหนดการสอบเรียบร้อยแล้ว' });
    } catch (error) {
      console.error('[Confirm Schedule Error]', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการยืนยันกำหนดการสอบ' });
    }
  }
);

// Delete schedule
router.delete(
  '/:id',
  authenticateToken,
  requireRole(UserRole.COORDINATOR, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const scheduleId = Number(id);

    try {
      const examsCount = await prisma.exam.count({ where: { scheduleId } });
      if (examsCount > 0) {
        res.status(400).json({ success: false, message: 'ไม่สามารถลบกำหนดการที่มีข้อสอบผูกอยู่แล้ว' });
        return;
      }

      await prisma.examSchedule.delete({
        where: { id: scheduleId },
      });

      await recordAuditLog(
        req.user!.id,
        req.user!.full_name,
        req.user!.role,
        'DELETE_SCHEDULE',
        'SCHEDULE',
        id,
        req.ip || '127.0.0.1',
        {
          deleted_id: id,
        }
      );

      res.json({ success: true, message: 'ลบกำหนดการสอบเรียบร้อยแล้ว' });
    } catch (error) {
      console.error('[Delete Schedule Error]', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบกำหนดการสอบ' });
    }
  }
);

export default router;
