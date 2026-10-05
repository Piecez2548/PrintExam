import { Router, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { UserRole, ExamType, ScheduleStatus, Prisma } from '../../generated/prisma';
import { recordAuditLog } from '../middleware/audit';
import { createNotification } from '../services/notificationService';
import { isDeadlineAtLeastTwoDaysBeforeExam, normalizeStoredCalendarDate } from '../data/examScheduleDeadline';
import { buildAuditChanges } from '../data/auditTrail';

const router = Router();

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
    section: es.section || es.course?.section,
    student_count: es.course?.studentCount,
    coordinator_id: es.coordinatorId,
    coordinator_name: es.coordinator ? es.coordinator.fullName : undefined,
    coordinator_phone: es.coordinator ? es.coordinator.phone : undefined,
    deadline_date: es.deadlineDate,
    status: es.status,
    submission_id: es.exams?.[0]?.id,
    created_at: es.createdAt instanceof Date ? es.createdAt.toISOString() : es.createdAt,
    updated_at: es.updatedAt instanceof Date ? es.updatedAt.toISOString() : es.updatedAt,
  };
}

async function findScheduleConflict(input: {
  courseId: number;
  instructorId: number;
  examType: ExamType;
  examDate: string;
  startTime: string;
  endTime: string;
  room: string;
  excludeId?: number;
}) {
  const overlapping = {
    examDate: input.examDate,
    startTime: { lt: input.endTime },
    endTime: { gt: input.startTime },
    ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
  };

  const [duplicate, roomConflict, instructorConflict] = await Promise.all([
    prisma.examSchedule.findFirst({
      where: {
        status: { not: ScheduleStatus.CANCELLED },
        courseId: input.courseId,
        examType: input.examType,
        examDate: input.examDate,
        startTime: input.startTime,
        endTime: input.endTime,
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      },
    }),
    prisma.examSchedule.findFirst({
      where: { ...overlapping, status: { not: ScheduleStatus.CANCELLED }, room: { equals: input.room.trim(), mode: 'insensitive' } },
      include: { course: true },
    }),
    prisma.examSchedule.findFirst({
      where: { ...overlapping, status: { not: ScheduleStatus.CANCELLED }, course: { instructorId: input.instructorId } },
      include: { course: true },
    }),
  ]);

  if (duplicate) return 'มีตารางสอบรายวิชาและประเภทสอบนี้ในช่วงเวลาเดียวกันแล้ว';
  if (roomConflict) return `ห้อง ${input.room.trim()} ถูกใช้โดยวิชา ${roomConflict.course.courseCode} ในช่วงเวลานี้แล้ว`;
  if (instructorConflict) return `อาจารย์มีตารางสอบวิชา ${instructorConflict.course.courseCode} ซ้อนในช่วงเวลานี้`;
  return null;
}

// Get exam schedules
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
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
    if (req.user?.role === UserRole.INSTRUCTOR) {
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
        exams: { where: { status: { not: 'CANCELLED' } }, select: { id: true }, take: 1 },
      },
      orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }],
      take: 500,
    });

    res.json({ success: true, data: schedules.map(formatSchedule) });
  } catch (error) {
    console.error('[Schedule List Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตารางสอบ' });
  }
});

// Create exam schedule (REQ-0003)
router.post(
  '/',
  authenticateToken,
  requireRole(UserRole.COORDINATOR, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { course_id, exam_type, exam_date, start_time, end_time, room, section, coordinator_id, deadline_date } = req.body;

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
        res.status(404).json({ success: false, message: 'ไม่พบรายวิชาที่เลือก' });
        return;
      }
      if (exam_type && !Object.values(ExamType).includes(exam_type as ExamType)) {
        res.status(400).json({ success: false, message: 'ประเภทการสอบไม่ถูกต้อง' });
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(exam_date)) || !/^\d{2}:\d{2}$/.test(String(start_time)) || !/^\d{2}:\d{2}$/.test(String(end_time))) {
        res.status(400).json({ success: false, message: 'รูปแบบวันที่หรือเวลาสอบไม่ถูกต้อง' });
        return;
      }
      if (String(start_time) >= String(end_time)) {
        res.status(400).json({ success: false, message: 'เวลาสิ้นสุดการสอบต้องอยู่หลังเวลาเริ่มสอบ' });
        return;
      }
      if (!isDeadlineAtLeastTwoDaysBeforeExam(deadline_date, exam_date)) {
        res.status(400).json({ success: false, message: 'กำหนดส่งต้องอยู่ก่อนวันสอบอย่างน้อย 2 วัน' });
        return;
      }
      const existingSchedule = await prisma.examSchedule.findFirst({
        where: { courseId: course.id, status: { not: ScheduleStatus.CANCELLED } },
        select: { id: true },
      });
      if (existingSchedule) {
        res.status(409).json({ success: false, message: 'รายวิชานี้กำหนดรอบสอบแล้ว กรุณาแก้ไขตารางเดิมแทนการเพิ่มรอบใหม่' });
        return;
      }
      const scheduleConflict = await findScheduleConflict({
        courseId: course.id,
        instructorId: course.instructorId,
        examType: (exam_type as ExamType) || ExamType.FINAL,
        examDate: String(exam_date),
        startTime: String(start_time),
        endTime: String(end_time),
        room: String(room),
      });
      if (scheduleConflict) {
        res.status(409).json({ success: false, message: scheduleConflict });
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
          section: section ? String(section).trim() : course.section,
          coordinatorId: coordinator_id ? Number(coordinator_id) : req.user!.id,
          deadlineDate: String(deadline_date),
          // The coordinator owns this decision, so saving makes the schedule ready immediately.
          status: ScheduleStatus.CONFIRMED,
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

      await createNotification(
        newSchedule.course.instructorId,
        'SCHEDULE_READY',
        `ตารางสอบ ${newSchedule.course.courseCode} พร้อมส่งข้อสอบแล้ว`,
        `วันที่ ${newSchedule.examDate} เวลา ${newSchedule.startTime}-${newSchedule.endTime} ห้อง ${newSchedule.room} กรุณาส่งภายใน ${newSchedule.deadlineDate}`,
        '/instructor/exams/new'
      );

      res.status(201).json({ success: true, message: 'บันทึกตารางสอบและแจ้งอาจารย์เรียบร้อยแล้ว', data: formatSchedule(newSchedule) });
    } catch (error) {
      console.error('[Create Schedule Error]', error);
      if ((error as { code?: string }).code === 'P2002') {
        res.status(409).json({ success: false, message: 'รายวิชานี้มีรอบสอบที่ใช้งานอยู่แล้ว กรุณาแก้ไขรอบเดิม' });
        return;
      }
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
    const { course_id, exam_type, exam_date, start_time, end_time, room, section, coordinator_id, deadline_date, status } = req.body;
    const scheduleId = Number(id);

    try {
      const current = await prisma.examSchedule.findUnique({ where: { id: scheduleId }, include: { course: true } });
      if (!current) {
        res.status(404).json({ success: false, message: 'ไม่พบกำหนดการสอบ' });
        return;
      }
      const nextCourse = course_id !== undefined
        ? await prisma.course.findUnique({ where: { id: Number(course_id) } })
        : current.course;
      if (!nextCourse) {
        res.status(404).json({ success: false, message: 'ไม่พบรายวิชาที่เลือก' });
        return;
      }
      if (nextCourse.id !== current.courseId) {
        const existingSchedule = await prisma.examSchedule.findFirst({
          where: { courseId: nextCourse.id, id: { not: scheduleId } },
          select: { id: true },
        });
        if (existingSchedule) {
          res.status(409).json({ success: false, message: 'รายวิชาปลายทางมีรอบสอบแล้ว ไม่สามารถย้ายตารางไปทับได้' });
          return;
        }
      }
      const nextExamDate = exam_date !== undefined
        ? String(exam_date)
        : normalizeStoredCalendarDate(current.examDate) ?? current.examDate;
      const nextStartTime = start_time !== undefined ? String(start_time) : current.startTime;
      const nextEndTime = end_time !== undefined ? String(end_time) : current.endTime;
      const nextDeadline = deadline_date !== undefined
        ? String(deadline_date)
        : normalizeStoredCalendarDate(current.deadlineDate) ?? current.deadlineDate;
      const nextRoom = room !== undefined ? String(room) : current.room;
      const nextExamType = exam_type && Object.values(ExamType).includes(exam_type) ? (exam_type as ExamType) : current.examType;

      if (exam_type !== undefined && !Object.values(ExamType).includes(exam_type)) {
        res.status(400).json({ success: false, message: 'ประเภทการสอบไม่ถูกต้อง' });
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextExamDate) || !/^\d{2}:\d{2}$/.test(nextStartTime) || !/^\d{2}:\d{2}$/.test(nextEndTime)) {
        res.status(400).json({ success: false, message: 'รูปแบบวันที่หรือเวลาสอบไม่ถูกต้อง' });
        return;
      }

      if (nextStartTime >= nextEndTime) {
        res.status(400).json({ success: false, message: 'เวลาสิ้นสุดการสอบต้องอยู่หลังเวลาเริ่มสอบ' });
        return;
      }
      if (!isDeadlineAtLeastTwoDaysBeforeExam(nextDeadline, nextExamDate)) {
        res.status(400).json({ success: false, message: 'กำหนดส่งต้องอยู่ก่อนวันสอบอย่างน้อย 2 วัน' });
        return;
      }
      const scheduleConflict = await findScheduleConflict({
        courseId: nextCourse.id,
        instructorId: nextCourse.instructorId,
        examType: nextExamType,
        examDate: nextExamDate,
        startTime: nextStartTime,
        endTime: nextEndTime,
        room: nextRoom,
        excludeId: scheduleId,
      });
      if (scheduleConflict) {
        res.status(409).json({ success: false, message: scheduleConflict });
        return;
      }
      const updated = await prisma.$transaction(async (tx) => {
        const transactionCurrent = await tx.examSchedule.findUnique({ where: { id: scheduleId } });
        if (!transactionCurrent) throw new Error('Schedule not found');
        const relatedExams = await tx.exam.findMany({ where: { scheduleId }, select: { id: true } });
        const saved = await tx.examSchedule.update({
          where: { id: scheduleId },
          data: {
            courseId: course_id !== undefined ? Number(course_id) : undefined,
            examType: exam_type && Object.values(ExamType).includes(exam_type) ? (exam_type as ExamType) : undefined,
            examDate: exam_date !== undefined ? String(exam_date) : undefined,
            startTime: start_time !== undefined ? String(start_time) : undefined,
            endTime: end_time !== undefined ? String(end_time) : undefined,
            room: room !== undefined ? String(room).trim() : undefined,
            section: section !== undefined ? String(section).trim() || null : undefined,
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
        if (deadline_date !== undefined) {
          await tx.exam.updateMany({
            where: { scheduleId },
            data: { deadlineAt: new Date(`${nextDeadline}T23:59:59.999+07:00`) },
          });
        }
        const scheduleAuditBefore: Record<string, unknown> = {
          course_id: transactionCurrent.courseId,
          exam_type: transactionCurrent.examType,
          exam_date: normalizeStoredCalendarDate(transactionCurrent.examDate) ?? transactionCurrent.examDate,
          start_time: transactionCurrent.startTime,
          end_time: transactionCurrent.endTime,
          room: transactionCurrent.room,
          section: transactionCurrent.section,
          coordinator_id: transactionCurrent.coordinatorId,
          deadline_date: normalizeStoredCalendarDate(transactionCurrent.deadlineDate) ?? transactionCurrent.deadlineDate,
        };
        const scheduleAuditAfter: Record<string, unknown> = {
          course_id: saved.courseId,
          exam_type: saved.examType,
          exam_date: normalizeStoredCalendarDate(saved.examDate) ?? saved.examDate,
          start_time: saved.startTime,
          end_time: saved.endTime,
          room: saved.room,
          section: saved.section,
          coordinator_id: saved.coordinatorId,
          deadline_date: normalizeStoredCalendarDate(saved.deadlineDate) ?? saved.deadlineDate,
        };
        const scheduleChanges = buildAuditChanges(scheduleAuditBefore, scheduleAuditAfter, Object.keys(scheduleAuditBefore));
        const changedScheduleData = Object.keys(scheduleChanges).length > 0;
        const scheduleStatusChanged = saved.status !== transactionCurrent.status;
        if (changedScheduleData || scheduleStatusChanged) {
          await tx.auditLog.create({
            data: {
              userId: req.user!.id,
              userName: req.user!.full_name,
              userRole: req.user!.role,
              action: 'UPDATE_SCHEDULE',
              entityType: 'SCHEDULE',
              entityId: String(scheduleId),
              ipAddress: req.ip || '127.0.0.1',
              detailJson: JSON.stringify({
                audit_version: 1,
                updated_fields: { exam_date, room, status },
                related_exam_ids: relatedExams.map((entry) => entry.id),
                related_entity_type: 'SCHEDULE',
                related_entity_id: scheduleId,
                changes: scheduleChanges,
              }),
            },
          });
        }
        return saved;
      });
      req.auditHandledAtomically = true;

      res.json({ success: true, message: 'อัปเดตกำหนดการสอบสำเร็จ', data: formatSchedule(updated) });
    } catch (error) {
      console.error('[Update Schedule Error]', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขกำหนดการสอบ' });
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
      const schedule = await prisma.examSchedule.findUnique({ where: { id: scheduleId }, include: { course: true } });
      if (!schedule) {
        res.status(404).json({ success: false, message: 'ไม่พบกำหนดการสอบ' });
        return;
      }
      await prisma.examSchedule.update({
        where: { id: scheduleId },
        data: { status: ScheduleStatus.CANCELLED },
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

      res.json({ success: true, message: 'ยกเลิกกำหนดการสอบเรียบร้อยแล้ว โดยยังเก็บประวัติไว้ในระบบ' });
    } catch (error) {
      console.error('[Delete Schedule Error]', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบกำหนดการสอบ' });
    }
  }
);

export default router;
