import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { uploadExamFile, validateUploadedFileMagic } from '../middleware/upload';
import { DEADLINE_EDIT_LOCK_DAYS } from '../config/constants';
import { recordAuditLog } from '../middleware/audit';
import { broadcastEvent } from '../services/wsService';
import { createNotification, notifyRole } from '../services/notificationService';
import { ExamStatus, UserRole, Prisma } from '../../generated/prisma';
import { canAccessExamFile as canAccessExamFileByRole } from '../security/examAccess';

const router = Router();

function resolveExamFilePath(fileUrl: string | null): string | null {
  const uploadPrefix = '/uploads/';
  if (!fileUrl || !fileUrl.startsWith(uploadPrefix)) return null;

  const filename = path.basename(fileUrl.slice(uploadPrefix.length));
  if (!filename || filename === '.' || filename === '..') return null;

  const uploadDir = path.resolve(__dirname, '../../uploads');
  const filePath = path.resolve(uploadDir, filename);
  if (filePath !== uploadDir && !filePath.startsWith(`${uploadDir}${path.sep}`)) return null;
  return filePath;
}

/** ตรวจสิทธิ์แก้ไข/ยกเลิก: ต้องยังไม่ตัดข้อสอบ และเหลือเวลาก่อน deadline มากกว่า 2 วัน */
export function checkCanEditOrCancel(exam: any): { allowed: boolean; reason?: string } {
  // 1. A rejected exam must remain editable so the instructor can correct and resubmit it.
  const editableStatuses: ExamStatus[] = [ExamStatus.DRAFT, ExamStatus.SUBMITTED, ExamStatus.REJECTED];
  if (!editableStatuses.includes(exam.status)) {
    return {
      allowed: false,
      reason: `ไม่สามารถแก้ไขหรือยกเลิกข้อสอบได้ เนื่องจากสถานะปัจจุบันคือ "${exam.status}" (ผ่านการตัดข้อสอบ/อนุมัติไปแล้ว)`,
    };
  }

  // 2. Must be at least 2 days before deadline
  const now = new Date();
  const deadline = new Date(exam.deadlineAt || exam.deadline_at);
  const lockTime = new Date(deadline.getTime() - DEADLINE_EDIT_LOCK_DAYS * 24 * 60 * 60 * 1000);

  if (now > lockTime) {
    const diffHours = Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));
    return {
      allowed: false,
      reason: `ไม่สามารถแก้ไขหรือยกเลิกข้อสอบได้ เนื่องจากเลยกำหนดล่วงหน้าอย่างน้อย 2 วันก่อน Deadline (เหลือเวลาเพียง ${diffHours} ชั่วโมงก่อนหมดเวลา)`,
    };
  }

  return { allowed: true };
}

/** แปลงชื่อ field แบบ Prisma/camelCase เป็น response แบบ snake_case ที่ frontend ใช้อยู่ */
export function formatExam(e: any) {
  return {
    id: e.id,
    course_id: e.courseId,
    schedule_id: e.scheduleId,
    file_url: e.fileUrl,
    original_filename: e.originalFilename,
    file_type: e.fileType,
    file_size: e.fileSize,
    num_copies: e.numCopies,
    printed_copies: e.printRecords?.[0]?.printedCopies,
    num_pages: e.numPages,
    special_instructions: e.specialInstructions,
    is_double_sided: e.isDoubleSided ? 1 : 0,
    paper_size: e.paperSize,
    status: e.status,
    rejection_reason: e.rejectionReason,
    created_by: e.createdById,
    creator_name: e.createdBy?.fullName || undefined,
    submitted_at: e.submittedAt instanceof Date ? e.submittedAt.toISOString() : e.submittedAt,
    deadline_at: e.deadlineAt instanceof Date ? e.deadlineAt.toISOString() : e.deadlineAt,
    created_at: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
    updated_at: e.updatedAt instanceof Date ? e.updatedAt.toISOString() : e.updatedAt,
    // Course relations
    course_code: e.course ? e.course.courseCode : undefined,
    course_name: e.course ? e.course.courseName : undefined,
    semester: e.course ? e.course.semester : undefined,
    academic_year: e.course ? e.course.academicYear : undefined,
    instructor_id: e.course ? e.course.instructorId : undefined,
    instructor_name: e.course?.instructor ? e.course.instructor.fullName : undefined,
    instructor_email: e.course?.instructor ? e.course.instructor.email : undefined,
    instructor_phone: e.course?.instructor ? e.course.instructor.phone : undefined,
    // Schedule relations
    exam_date: e.schedule ? e.schedule.examDate : undefined,
    start_time: e.schedule ? e.schedule.startTime : undefined,
    end_time: e.schedule ? e.schedule.endTime : undefined,
    room: e.schedule ? e.schedule.room : undefined,
    exam_type: e.schedule ? e.schedule.examType : undefined,
    coordinator_name: e.schedule?.coordinator ? e.schedule.coordinator.fullName : undefined,
  };
}

// Get exams list with role filtering (REQ-0004, REQ-0008, REQ-0014)
router.get(
  '/',
  authenticateToken,
  requireRole(UserRole.INSTRUCTOR, UserRole.AV_STAFF, UserRole.COORDINATOR, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, course_id, instructor_id, search } = req.query;
  const user = req.user!;

  try {
    const where: Prisma.ExamWhereInput = {};

    // Instructors can only view exams of their own courses (REQ-0004)
    if (user.role === UserRole.INSTRUCTOR) {
      const instructorFilter = {
        OR: [
          { course: { instructorId: user.id } },
          { createdById: user.id },
        ],
      };

      if (search) {
        // M-4: ใช้ AND เพื่อรวม instructor filter + search ป้องกัน search override สิทธิ์
        const s = String(search);
        where.AND = [
          instructorFilter,
          {
            OR: [
              { course: { courseCode: { contains: s, mode: 'insensitive' } } },
              { course: { courseName: { contains: s, mode: 'insensitive' } } },
              { originalFilename: { contains: s, mode: 'insensitive' } },
            ],
          },
        ];
      } else {
        where.OR = instructorFilter.OR;
      }
    } else {
      if (instructor_id) {
        where.course = { instructorId: Number(instructor_id) };
      }

      if (search) {
        const s = String(search);
        where.OR = [
          { course: { courseCode: { contains: s, mode: 'insensitive' } } },
          { course: { courseName: { contains: s, mode: 'insensitive' } } },
          { originalFilename: { contains: s, mode: 'insensitive' } },
        ];
      }
    }

    if (status && Object.values(ExamStatus).includes(status as ExamStatus)) {
      where.status = status as ExamStatus;
    }

    if (course_id) {
      where.courseId = Number(course_id);
    }

    const exams = await prisma.exam.findMany({
      where,
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
        createdBy: true,
        printRecords: {
          orderBy: { printedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: exams.map(formatExam) });
  } catch (error) {
    console.error('[Exam List Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงรายการข้อสอบ' });
  }
  }
);

// Authenticated exam-file retrieval. Raw /uploads URLs are intentionally not used
// because they cannot carry the bearer token and would make ownership checks easy to bypass.
router.get('/:id/file', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const examId = Number(req.params.id);

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: {
        fileUrl: true,
        createdById: true,
        course: { select: { instructorId: true } },
      },
    });

    if (!exam) {
      res.status(404).json({ success: false, message: 'ไม่พบข้อสอบ' });
      return;
    }

    if (!canAccessExamFileByRole(req.user, exam)) {
      res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงไฟล์ข้อสอบนี้' });
      return;
    }

    const filePath = resolveExamFilePath(exam.fileUrl);
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: 'ไม่พบไฟล์ข้อสอบ' });
      return;
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('[Exam File Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์ข้อสอบ' });
  }
});

// Get single exam details + status timeline
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user!;
  const examId = Number(id);

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
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
        createdBy: true,
        statusHistory: {
          orderBy: { actionAt: 'asc' },
        },
        printRecords: {
          include: { printedBy: true },
          orderBy: { printedAt: 'desc' },
        },
        packingRecords: {
          include: { packedBy: true },
        },
        deliveryRecords: {
          include: { handedOverBy: true, receivedBy: true },
        },
      },
    });

    if (!exam) {
      res.status(404).json({ success: false, message: 'ไม่พบข้อมูลข้อสอบ' });
      return;
    }

    // Security check: Instructor can only view own exam
    if (user.role === UserRole.INSTRUCTOR && exam.course?.instructorId !== user.id && exam.createdById !== user.id) {
      res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลข้อสอบของรายวิชานี้' });
      return;
    }

    const editability = checkCanEditOrCancel(exam);

    const formattedHistory = exam.statusHistory.map((h) => ({
      id: h.id,
      exam_id: h.examId,
      from_status: h.fromStatus,
      to_status: h.toStatus,
      action_by: h.actionById,
      action_name: h.actionName,
      action_at: h.actionAt.toISOString(),
      note: h.note,
    }));

    const formattedPrintRecords = exam.printRecords.map((p) => ({
      id: p.id,
      exam_id: p.examId,
      printed_by: p.printedById,
      printer_name: p.printedBy?.fullName,
      printed_copies: p.printedCopies,
      paper_type: p.paperType,
      printed_at: p.printedAt.toISOString(),
      notes: p.notes,
    }));

    const formattedPackingRecords = exam.packingRecords.map((pk) => ({
      id: pk.id,
      exam_id: pk.examId,
      packed_by: pk.packedById,
      packer_name: pk.packedBy?.fullName,
      packed_at: pk.packedAt.toISOString(),
      envelope_count: pk.envelopeCount,
      notes: pk.notes,
    }));

    const formattedDeliveryRecords = exam.deliveryRecords.map((d) => ({
      id: d.id,
      exam_id: d.examId,
      handed_over_by: d.handedOverById,
      handover_name: d.handedOverBy?.fullName,
      received_by: d.receivedById,
      receiver_name: d.receivedBy?.fullName,
      delivered_at: d.deliveredAt.toISOString(),
      receiver_signature_note: d.receiverSignatureNote,
    }));

    res.json({
      success: true,
      data: {
        ...formatExam(exam),
        status_history: formattedHistory,
        print_records: formattedPrintRecords,
        packing_records: formattedPackingRecords,
        delivery_records: formattedDeliveryRecords,
        can_edit_or_cancel: editability.allowed,
        edit_restriction_reason: editability.reason,
      },
    });
  } catch (error) {
    console.error('[Exam Detail Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลข้อสอบ' });
  }
});

// Submit / Create new exam (REQ-0004: อาจารย์กรอกข้อมูลรายวิชาและอัปโหลดไฟล์ข้อสอบ)
router.post(
  '/',
  authenticateToken,
  requireRole(UserRole.INSTRUCTOR),
  uploadExamFile.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
  let {
    course_id,
    course_code,
    course_name,
    semester,
    academic_year,
    department,
    schedule_id,
    num_copies,
    num_pages,
    special_instructions,
    is_double_sided,
    paper_size,
    is_draft,
    deadline_at,
  } = req.body;

  const user = req.user!;

  try {
    // If instructor typed course_code / course_name directly instead of choosing existing course_id
    let finalCourseId = course_id ? Number(course_id) : undefined;
    if (!finalCourseId && course_code) {
      const existingCourse = await prisma.course.findFirst({
        where: {
          courseCode: { equals: course_code.trim(), mode: 'insensitive' },
          instructorId: user.id,
        },
      });

      if (existingCourse) {
        finalCourseId = existingCourse.id;
      } else {
        const insCourse = await prisma.course.create({
          data: {
            courseCode: course_code.trim().toUpperCase(),
            courseName: course_name ? course_name.trim() : course_code.trim().toUpperCase(),
            instructorId: user.id,
            department: department || user.department || 'มหาวิทยาลัย',
            semester: Number(semester || 1),
            academicYear: academic_year || '2569',
          },
        });
        finalCourseId = insCourse.id;
      }
    }

    if (!finalCourseId) {
      res.status(400).json({ success: false, message: 'กรุณากรอกรหัสวิชาและชื่อวิชาที่สอน' });
      return;
    }

    const course = await prisma.course.findUnique({
      where: { id: finalCourseId },
    });

    if (!course) {
      res.status(404).json({ success: false, message: 'ไม่พบข้อมูลรายวิชา' });
      return;
    }

    // Check instructor authorization
    if (user.role === UserRole.INSTRUCTOR && course.instructorId !== user.id) {
      res.status(403).json({ success: false, message: 'คุณสามารถส่งข้อสอบเฉพาะวิชาที่คุณเป็นผู้สอนเท่านั้น' });
      return;
    }

    // Use the visible deadline supplied by the form. A schedule deadline remains authoritative.
    let deadlineAt = deadline_at ? new Date(deadline_at) : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(deadlineAt.getTime())) {
      res.status(400).json({ success: false, message: 'รูปแบบกำหนดส่งข้อสอบไม่ถูกต้อง' });
      return;
    }
    const schedId = schedule_id ? Number(schedule_id) : null;
    if (schedId) {
      const sched = await prisma.examSchedule.findUnique({ where: { id: schedId }, include: { course: true } });
      if (!sched) {
        res.status(404).json({ success: false, message: 'ไม่พบกำหนดการสอบที่เลือก' });
        return;
      }
      if (sched.courseId !== finalCourseId) {
        res.status(400).json({ success: false, message: 'กำหนดการสอบไม่ตรงกับรายวิชาที่เลือก' });
        return;
      }
      if (sched.status === 'CANCELLED') {
        res.status(400).json({ success: false, message: 'ไม่สามารถส่งข้อสอบตามกำหนดการที่ถูกยกเลิกแล้ว' });
        return;
      }
      if (sched.course.instructorId !== user.id) {
        res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ใช้กำหนดการสอบของรายวิชานี้' });
        return;
      }
      if (sched.deadlineDate) {
        deadlineAt = new Date(sched.deadlineDate);
      }
    }

    let fileUrl: string | null = null;
    let originalFilename: string | null = null;
    let fileType: string | null = null;
    let fileSize = 0;

    if (req.file) {
      // M-3: ตรวจ magic bytes ป้องกันไฟล์ปลอม extension
      const isValid = await validateUploadedFileMagic(req.file.path);
      if (!isValid) {
        const fsMod = await import('fs');
        fsMod.unlinkSync(req.file.path);
        res.status(400).json({ success: false, message: 'ไฟล์ที่อัปโหลดไม่ใช่เอกสารที่รองรับ (.pdf, .docx, .doc) กรุณาตรวจสอบไฟล์อีกครั้ง' });
        return;
      }
      fileUrl = `/uploads/${req.file.filename}`;
      originalFilename = req.file.originalname;
      fileType = req.file.mimetype;
      fileSize = req.file.size;
    }

    const initialStatus = is_draft === 'true' || is_draft === true ? ExamStatus.DRAFT : ExamStatus.SUBMITTED;
    if (initialStatus === ExamStatus.SUBMITTED) {
      const minimumDeadline = Date.now() + DEADLINE_EDIT_LOCK_DAYS * 24 * 60 * 60 * 1000;
      if (deadlineAt.getTime() <= minimumDeadline) {
        res.status(400).json({ success: false, message: 'กำหนดส่งต้องห่างจากเวลาปัจจุบันมากกว่า 2 วัน' });
        return;
      }
    }
    const submittedAt = initialStatus === ExamStatus.SUBMITTED ? new Date() : null;
    const copies = Number(num_copies);
    if (!Number.isInteger(copies) || copies < 1) {
      res.status(400).json({ success: false, message: 'กรุณาระบุจำนวนชุดที่ต้องการพิมพ์อย่างน้อย 1 ชุด' });
      return;
    }
    const pages = Number(num_pages || 1);
    if (!Number.isInteger(pages) || pages < 1) {
      res.status(400).json({ success: false, message: 'จำนวนหน้าต้องเป็นจำนวนเต็มอย่างน้อย 1 หน้า' });
      return;
    }
    if (initialStatus === ExamStatus.SUBMITTED && !fileUrl) {
      res.status(400).json({ success: false, message: 'การส่งข้อสอบต้องแนบไฟล์ .pdf, .docx หรือ .doc' });
      return;
    }

    const newExam = await prisma.exam.create({
      data: {
        courseId: finalCourseId,
        scheduleId: schedId,
        fileUrl,
        originalFilename,
        fileType,
        fileSize,
        numCopies: copies,
        numPages: pages,
        specialInstructions: special_instructions || null,
        isDoubleSided: is_double_sided === 'false' || is_double_sided === 0 ? false : true,
        paperSize: paper_size || 'A4',
        status: initialStatus,
        createdById: user.id,
        submittedAt,
        deadlineAt,
        statusHistory: {
          create: [
            {
              fromStatus: null,
              toStatus: initialStatus,
              actionById: user.id,
              actionName: user.full_name,
              note: initialStatus === ExamStatus.SUBMITTED ? 'ส่งข้อสอบให้เจ้าหน้าที่หน่วยโสตตรวจสอบ' : 'บันทึกแบบร่าง',
            },
          ],
        },
      },
    });

    // Notify AV Staff if submitted
    if (initialStatus === ExamStatus.SUBMITTED) {
      await notifyRole(
        UserRole.AV_STAFF,
        'NEW_EXAM_SUBMISSION',
        `มีข้อสอบใหม่รอตรวจสอบ: ${course.courseCode}`,
        `${user.full_name} ได้ส่งข้อสอบวิชา ${course.courseCode} (${course.courseName}) จำนวน ${copies} ชุด`,
        `/av-staff/exams/${newExam.id}/review`
      );
    }

    // Real-time broadcast
    broadcastEvent('EXAM_CREATED', { examId: newExam.id, courseCode: course.courseCode, status: initialStatus });

    await recordAuditLog(user.id, user.full_name, user.role, 'SUBMIT_EXAM', 'EXAM', newExam.id.toString(), req.ip || '127.0.0.1', {
      course_code: course.courseCode,
      num_copies: copies,
      status: initialStatus,
      filename: originalFilename,
    });

    res.status(201).json({
      success: true,
      message:
        initialStatus === ExamStatus.SUBMITTED
          ? 'ส่งข้อสอบเรียบร้อยแล้ว เจ้าหน้าที่หน่วยโสตจะดำเนินการตรวจสอบไฟล์'
          : 'บันทึกแบบร่างสำเร็จ',
      data: { id: newExam.id, status: initialStatus },
    });
  } catch (error) {
    console.error('[Submit Exam Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการส่งข้อสอบ' });
  }
  }
);

// Update / Edit exam (REQ-0005)
router.put(
  '/:id',
  authenticateToken,
  requireRole(UserRole.INSTRUCTOR, UserRole.ADMIN),
  uploadExamFile.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user!;
  const examId = Number(id);
  const {
    course_id,
    schedule_id,
    num_copies,
    num_pages,
    special_instructions,
    is_double_sided,
    paper_size,
    is_draft,
  } = req.body;

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      res.status(404).json({ success: false, message: 'ไม่พบข้อมูลข้อสอบ' });
      return;
    }

    // Security check: Only owner or admin can edit.
    if (user.role === UserRole.INSTRUCTOR && exam.createdById !== user.id) {
      res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์แก้ไขข้อสอบชุดนี้' });
      return;
    }

    if (user.role === UserRole.INSTRUCTOR && course_id !== undefined) {
      const targetCourse = await prisma.course.findUnique({
        where: { id: Number(course_id) },
        select: { instructorId: true },
      });
      if (!targetCourse || targetCourse.instructorId !== user.id) {
        res.status(403).json({ success: false, message: 'คุณไม่สามารถย้ายข้อสอบไปยังรายวิชาของอาจารย์ท่านอื่นได้' });
        return;
      }
    }

    // REQ-0005 Rule Verification
    if (user.role === UserRole.INSTRUCTOR) {
      const editCheck = checkCanEditOrCancel(exam);
      if (!editCheck.allowed) {
        res.status(403).json({ success: false, message: editCheck.reason });
        return;
      }
    }

    let fileUrl = exam.fileUrl;
    let originalFilename = exam.originalFilename;
    let fileType = exam.fileType;
    let fileSize = exam.fileSize;

    if (req.file) {
      // M-3: ตรวจ magic bytes ป้องกันไฟล์ปลอม extension
      const isValid = await validateUploadedFileMagic(req.file.path);
      if (!isValid) {
        const fsMod = await import('fs');
        fsMod.unlinkSync(req.file.path);
        res.status(400).json({ success: false, message: 'ไฟล์ที่อัปโหลดไม่ใช่เอกสารที่รองรับ (.pdf, .docx, .doc) กรุณาตรวจสอบไฟล์อีกครั้ง' });
        return;
      }
      fileUrl = `/uploads/${req.file.filename}`;
      originalFilename = req.file.originalname;
      fileType = req.file.mimetype;
      fileSize = req.file.size;
    }

    let newStatus = exam.status;
    if (is_draft === 'false' || is_draft === false) {
      if (exam.status === ExamStatus.DRAFT || exam.status === ExamStatus.REJECTED) {
        newStatus = ExamStatus.SUBMITTED;
      }
    }

    let nextDeadlineAt = exam.deadlineAt;
    if (schedule_id !== undefined && schedule_id) {
      const schedule = await prisma.examSchedule.findUnique({
        where: { id: Number(schedule_id) },
        include: { course: true },
      });
      if (!schedule) {
        res.status(404).json({ success: false, message: 'ไม่พบกำหนดการสอบที่เลือก' });
        return;
      }
      if (schedule.course.instructorId !== user.id && user.role === UserRole.INSTRUCTOR) {
        res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ใช้กำหนดการสอบของรายวิชานี้' });
        return;
      }
      if (schedule.status === 'CANCELLED') {
        res.status(400).json({ success: false, message: 'ไม่สามารถใช้กำหนดการสอบที่ถูกยกเลิกแล้ว' });
        return;
      }
      nextDeadlineAt = new Date(schedule.deadlineDate);
    }

    if (num_copies !== undefined && (!Number.isInteger(Number(num_copies)) || Number(num_copies) < 1)) {
      res.status(400).json({ success: false, message: 'จำนวนชุดต้องเป็นจำนวนเต็มอย่างน้อย 1 ชุด' });
      return;
    }
    if (num_pages !== undefined && (!Number.isInteger(Number(num_pages)) || Number(num_pages) < 1)) {
      res.status(400).json({ success: false, message: 'จำนวนหน้าต้องเป็นจำนวนเต็มอย่างน้อย 1 หน้า' });
      return;
    }
    if (newStatus === ExamStatus.SUBMITTED && !fileUrl) {
      res.status(400).json({ success: false, message: 'การส่งข้อสอบต้องแนบไฟล์ .pdf, .docx หรือ .doc' });
      return;
    }
    if (newStatus === ExamStatus.SUBMITTED) {
      const lockTime = nextDeadlineAt.getTime() - DEADLINE_EDIT_LOCK_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() > lockTime) {
        res.status(400).json({ success: false, message: 'ไม่สามารถส่งหรือส่งแก้ไขได้ เนื่องจากเหลือเวลาไม่ถึง 2 วันก่อน Deadline' });
        return;
      }
    }

    const updated = await prisma.exam.update({
      where: { id: examId },
      data: {
        courseId: course_id ? Number(course_id) : undefined,
        scheduleId: schedule_id !== undefined ? (schedule_id ? Number(schedule_id) : null) : undefined,
        fileUrl,
        originalFilename,
        fileType,
        fileSize,
        numCopies:
          num_copies !== undefined && Number.isInteger(Number(num_copies)) && Number(num_copies) >= 1
            ? Number(num_copies)
            : undefined,
        numPages: num_pages !== undefined ? Number(num_pages) : undefined,
        specialInstructions: special_instructions !== undefined ? special_instructions : undefined,
        isDoubleSided:
          is_double_sided !== undefined
            ? is_double_sided === 'false' || is_double_sided === 0 || is_double_sided === false
              ? false
              : true
            : undefined,
        paperSize: paper_size !== undefined ? paper_size : undefined,
        status: newStatus,
        deadlineAt: nextDeadlineAt,
        submittedAt: newStatus === ExamStatus.SUBMITTED ? new Date() : undefined,
      },
    });

    if (newStatus !== exam.status) {
      await prisma.examStatusHistory.create({
        data: {
          examId,
          fromStatus: exam.status,
          toStatus: newStatus,
          actionById: user.id,
          actionName: user.full_name,
          note: 'แก้ไขข้อมูลและส่งข้อสอบใหม่',
        },
      });

      await notifyRole(
        UserRole.AV_STAFF,
        'EXAM_RESUBMITTED',
        `มีการส่งข้อสอบฉบับแก้ไข: ID #${examId}`,
        `${user.full_name} ได้อัปเดตไฟล์ข้อสอบและส่งให้ตรวจสอบใหม่อีกครั้ง`,
        `/av-staff/exams/${examId}/review`
      );

      broadcastEvent('EXAM_STATUS_CHANGED', { examId, fromStatus: exam.status, toStatus: newStatus });
    }

    await recordAuditLog(user.id, user.full_name, user.role, 'UPDATE_EXAM', 'EXAM', id, req.ip || '127.0.0.1', {
      updated_fields: { num_copies, filename: originalFilename, newStatus },
    });

    res.json({ success: true, message: 'แก้ไขข้อมูลข้อสอบเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('[Update Exam Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลข้อสอบ' });
  }
  }
);

// Delete / Cancel exam (REQ-0005)
router.delete(
  '/:id',
  authenticateToken,
  requireRole(UserRole.INSTRUCTOR, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user!;
  const examId = Number(id);

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      res.status(404).json({ success: false, message: 'ไม่พบข้อสอบที่ต้องการยกเลิก' });
      return;
    }

    // Security check: Only owner or admin
    if (user.role === UserRole.INSTRUCTOR && exam.createdById !== user.id) {
      res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ยกเลิกข้อสอบนี้' });
      return;
    }

    // REQ-0005 Rule Verification
    if (user.role === UserRole.INSTRUCTOR) {
      const editCheck = checkCanEditOrCancel(exam);
      if (!editCheck.allowed) {
        res.status(403).json({ success: false, message: editCheck.reason });
        return;
      }
    }

    await prisma.exam.delete({
      where: { id: examId },
    });

    await recordAuditLog(user.id, user.full_name, user.role, 'CANCEL_EXAM', 'EXAM', id, req.ip || '127.0.0.1', {
      deleted_exam_id: id,
      status_at_cancel: exam.status,
    });

    broadcastEvent('EXAM_DELETED', { examId });

    res.json({ success: true, message: 'ยกเลิกรายการข้อสอบเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('[Cancel Exam Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการยกเลิกข้อสอบ' });
  }
  }
);

export default router;
