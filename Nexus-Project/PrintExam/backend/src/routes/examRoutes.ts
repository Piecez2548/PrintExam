import { Router, Response } from 'express';
import fs from 'fs';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { uploadExamFile, validateUploadedFileMagic } from '../middleware/upload';
import { DEADLINE_EDIT_LOCK_DAYS } from '../config/constants';
import { recordAuditLog } from '../middleware/audit';
import { broadcastEvent } from '../services/wsService';
import { createNotification, notifyRole } from '../services/notificationService';
import { ExamStatus, UserRole, Prisma } from '../../generated/prisma';
import { deleteStoredExamFile, persistExamUpload } from '../services/fileStorageService';

const router = Router();

type HistoricalPrintRecord = {
  id: number;
  examId: number;
  printedById: number;
  printedBy?: { fullName: string } | null;
  printedCopies: number;
  paperType: string;
  printedAt: Date;
  notes: string | null;
};

export function formatHistoricalPrintRecord(p: HistoricalPrintRecord) {
  return {
    id: p.id,
    exam_id: p.examId,
    printed_by: p.printedById,
    printer_name: p.printedBy?.fullName,
    printed_copies: p.printedCopies,
    paper_type: p.paperType,
    printed_at: p.printedAt.toISOString(),
    notes: p.notes,
  };
}

function removeUploadedFile(filePath?: string): void {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    console.error('[Upload Cleanup Error]', error);
  }
}

/** A date-only deadline is inclusive until 23:59:59 in Thailand. */
export function parseDeadlineAt(value: string | Date): Date {
  if (value instanceof Date) return value;
  const text = String(value).trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T23:59:59.999+07:00`)
    : new Date(text);
  return parsed;
}

/** ตรวจสิทธิ์แก้ไข/ยกเลิก: ต้องยังไม่ตัดข้อสอบและอยู่ในช่วงเวลาที่อนุญาต */
export function checkCanEditOrCancel(exam: any): { allowed: boolean; reason?: string } {
  // 1. A rejected exam must remain editable so the instructor can correct and resubmit it.
  const editableStatuses: ExamStatus[] = [ExamStatus.DRAFT, ExamStatus.SUBMITTED, ExamStatus.REJECTED];
  if (!editableStatuses.includes(exam.status)) {
    return {
      allowed: false,
      reason: `ไม่สามารถแก้ไขหรือยกเลิกข้อสอบได้ เนื่องจากสถานะปัจจุบันคือ "${exam.status}" (ผ่านการตัดข้อสอบ/อนุมัติไปแล้ว)`,
    };
  }

  // A rejected submission must remain correctable until the actual deadline;
  // otherwise a late review could leave the instructor with no possible action.
  const now = new Date();
  const deadline = parseDeadlineAt(exam.deadlineAt || exam.deadline_at);
  if (exam.status === ExamStatus.REJECTED) {
    return now <= deadline
      ? { allowed: true }
      : { allowed: false, reason: 'ไม่สามารถแก้ไขข้อสอบได้ เนื่องจากเลยกำหนดส่งข้อสอบแล้ว' };
  }

  // Draft/submitted records lock two days before the deadline.
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
    student_count: e.studentCount,
    reserve_copies: e.reserveCopies,
    section: e.section || (e.schedule ? e.schedule.section : undefined),
    printed_copies: e.printRecords?.[0]?.printedCopies,
    num_pages: e.numPages,
    exam_language: e.examLanguage,
    print_format: e.printFormat,
    allowed_materials: e.allowedMaterials,
    requires_answer_sheet: e.requiresAnswerSheet,
    exam_session_type: e.examSessionType,
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
    department: e.course ? e.course.department : undefined,
    semester: e.course ? e.course.semester : undefined,
    academic_year: e.course ? e.course.academicYear : undefined,
    instructor_id: e.course ? e.course.instructorId : undefined,
    instructor_name: e.course?.instructor ? e.course.instructor.fullName : undefined,
    instructor_email: e.course?.instructor ? e.course.instructor.email : undefined,
    instructor_phone: e.course?.instructor ? e.course.instructor.phone : undefined,
    instructor_office_room: e.course?.instructor ? e.course.instructor.officeRoom : undefined,
    // Schedule relations
    exam_date: e.schedule ? e.schedule.examDate : undefined,
    start_time: e.schedule ? e.schedule.startTime : undefined,
    end_time: e.schedule ? e.schedule.endTime : undefined,
    room: e.schedule ? e.schedule.room : undefined,
    exam_type: e.schedule ? e.schedule.examType : undefined,
    coordinator_name: e.schedule?.coordinator ? e.schedule.coordinator.fullName : undefined,
  };
}

function formatExamForUser(e: any, role: UserRole) {
  const formatted = formatExam(e);
  if (role === UserRole.COORDINATOR) {
    formatted.file_url = null;
    formatted.original_filename = null;
    formatted.file_type = null;
    formatted.file_size = null;
    formatted.rejection_reason = null;
  }
  return formatted;
}

// Get exams list with role filtering (REQ-0004, REQ-0008, REQ-0014)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
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
      if (user.role === UserRole.COORDINATOR) {
        where.status = { in: [ExamStatus.PACKED, ExamStatus.READY_FOR_PICKUP, ExamStatus.DELIVERED] };
      }
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
      const requestedStatus = status as ExamStatus;
      const coordinatorStatuses: ExamStatus[] = [ExamStatus.PACKED, ExamStatus.READY_FOR_PICKUP, ExamStatus.DELIVERED];
      if (user.role !== UserRole.COORDINATOR || coordinatorStatuses.includes(requestedStatus)) {
        where.status = requestedStatus;
      }
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
      take: 500,
    });

    res.json({ success: true, data: exams.map((exam) => formatExamForUser(exam, user.role)) });
  } catch (error) {
    console.error('[Exam List Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงรายการข้อสอบ' });
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
    const coordinatorVisibleStatuses: ExamStatus[] = [ExamStatus.PACKED, ExamStatus.READY_FOR_PICKUP, ExamStatus.DELIVERED];
    if (user.role === UserRole.COORDINATOR && !coordinatorVisibleStatuses.includes(exam.status)) {
      res.status(403).json({ success: false, message: 'เจ้าหน้าที่ดำเนินการสอบเข้าถึงรายการได้เมื่อเข้าสู่ขั้นตอนรับมอบแล้ว' });
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

    const formattedPrintRecords = exam.printRecords.map(formatHistoricalPrintRecord);

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
        ...formatExamForUser(exam, user.role),
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
  requireRole(UserRole.INSTRUCTOR, UserRole.ADMIN),
  uploadExamFile.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
  let uploadPersisted = false;
  let pendingStoredFileUrl: string | null = null;
  let {
    course_id,
    course_code,
    course_name,
    semester,
    academic_year,
    department,
    schedule_id,
    num_copies,
    student_count,
    reserve_copies,
    section,
    num_pages,
    exam_language,
    print_format,
    allowed_materials,
    requires_answer_sheet,
    exam_session_type,
    special_instructions,
    is_double_sided,
    paper_size,
    is_draft,
    deadline_at,
  } = req.body;

  const user = req.user!;

  try {
    // A coordinator-owned, non-cancelled schedule is the canonical source for course/date/time/room/deadline.
    const schedId = schedule_id ? Number(schedule_id) : null;
    let selectedSchedule = schedId
      ? await prisma.examSchedule.findUnique({ where: { id: schedId }, include: { course: true } })
      : null;

    if (user.role === UserRole.INSTRUCTOR) {
      if (!selectedSchedule || selectedSchedule.status === 'CANCELLED') {
        removeUploadedFile(req.file?.path);
        res.status(400).json({ success: false, message: 'กรุณาเลือกตารางสอบที่เจ้าหน้าที่ดำเนินการสอบกำหนดไว้' });
        return;
      }
      if (selectedSchedule.course.instructorId !== user.id) {
        removeUploadedFile(req.file?.path);
        res.status(403).json({ success: false, message: 'ตารางสอบนี้ไม่ใช่รายวิชาที่คุณเป็นผู้สอน' });
        return;
      }
      course_id = selectedSchedule.courseId;
    }

    // Admin may still create a course-backed record for correction/migration work.
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
      removeUploadedFile(req.file?.path);
      res.status(400).json({ success: false, message: 'กรุณากรอกรหัสวิชาและชื่อวิชาที่สอน' });
      return;
    }

    const course = await prisma.course.findUnique({
      where: { id: finalCourseId },
    });

    if (!course) {
      removeUploadedFile(req.file?.path);
      res.status(404).json({ success: false, message: 'ไม่พบข้อมูลรายวิชา' });
      return;
    }

    // Check instructor authorization
    if (user.role === UserRole.INSTRUCTOR && course.instructorId !== user.id) {
      removeUploadedFile(req.file?.path);
      res.status(403).json({ success: false, message: 'คุณสามารถส่งข้อสอบเฉพาะวิชาที่คุณเป็นผู้สอนเท่านั้น' });
      return;
    }

    // A schedule deadline remains authoritative; request data is only an admin fallback.
    let deadlineAt = deadline_at ? parseDeadlineAt(deadline_at) : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(deadlineAt.getTime())) {
      removeUploadedFile(req.file?.path);
      res.status(400).json({ success: false, message: 'รูปแบบกำหนดส่งข้อสอบไม่ถูกต้อง' });
      return;
    }
    if (schedId) {
      selectedSchedule = selectedSchedule || await prisma.examSchedule.findUnique({ where: { id: schedId }, include: { course: true } });
      if (!selectedSchedule || selectedSchedule.courseId !== finalCourseId) {
        removeUploadedFile(req.file?.path);
        res.status(400).json({ success: false, message: 'ตารางสอบไม่ตรงกับรายวิชาที่เลือก' });
        return;
      }
      if (selectedSchedule.deadlineDate) deadlineAt = parseDeadlineAt(selectedSchedule.deadlineDate);
      const existingSubmission = await prisma.exam.findFirst({
        where: { scheduleId: schedId, status: { not: ExamStatus.CANCELLED } },
      });
      if (existingSubmission) {
        removeUploadedFile(req.file?.path);
        res.status(409).json({ success: false, message: 'ตารางสอบนี้มีรายการส่งข้อสอบแล้ว กรุณาแก้ไขรายการเดิม' });
        return;
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
    if (initialStatus === ExamStatus.SUBMITTED && !req.file) {
      res.status(400).json({ success: false, message: 'กรุณาแนบไฟล์ข้อสอบก่อนส่งตรวจสอบ' });
      return;
    }
    if (deadlineAt.getTime() < Date.now()) {
        removeUploadedFile(req.file?.path);
        res.status(400).json({ success: false, message: 'พ้นกำหนดส่งข้อสอบแล้ว กรุณาติดต่อเจ้าหน้าที่ดำเนินการสอบ' });
        return;
    }
    const submittedAt = initialStatus === ExamStatus.SUBMITTED ? new Date() : null;
    const students = Number(student_count || num_copies);
    const reserves = Number(reserve_copies ?? 2);
    const copies = students + reserves;
    const normalizedSection = String(section ?? selectedSchedule?.section ?? course.section ?? '').trim();
    if (normalizedSection.length > 20) {
      removeUploadedFile(req.file?.path);
      res.status(400).json({ success: false, message: 'ตอนเรียนต้องมีความยาวไม่เกิน 20 ตัวอักษร' });
      return;
    }
    if (!Number.isInteger(students) || students < 1 || !Number.isInteger(reserves) || reserves < 0 || reserves > 20) {
      removeUploadedFile(req.file?.path);
      res.status(400).json({ success: false, message: 'จำนวนผู้เข้าสอบหรือจำนวนชุดสำรองไม่ถูกต้อง' });
      return;
    }
    const supportedLanguages = ['THAI', 'ENGLISH', 'BILINGUAL'];
    const supportedPrintFormats = ['SINGLE_SIDED', 'DOUBLE_SIDED', 'BOOKLET', 'OTHER'];
    const supportedSessionTypes = ['IN_SCHEDULE', 'OUT_OF_SCHEDULE'];
    if (!supportedLanguages.includes(exam_language || 'THAI') || !supportedPrintFormats.includes(print_format || 'DOUBLE_SIDED') || !supportedSessionTypes.includes(exam_session_type || 'IN_SCHEDULE')) {
      removeUploadedFile(req.file?.path);
      res.status(400).json({ success: false, message: 'รูปแบบภาษา การพิมพ์ หรือประเภทการสอบไม่ถูกต้อง' });
      return;
    }
    if (req.file) {
      fileUrl = await persistExamUpload(req.file);
      pendingStoredFileUrl = fileUrl;
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
        studentCount: students,
        reserveCopies: reserves,
        section: normalizedSection || null,
        numPages: Number(num_pages || 1),
        examLanguage: exam_language || 'THAI',
        printFormat: print_format || 'DOUBLE_SIDED',
        allowedMaterials: allowed_materials || null,
        requiresAnswerSheet: requires_answer_sheet === 'true' || requires_answer_sheet === true,
        examSessionType: exam_session_type || 'IN_SCHEDULE',
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
    uploadPersisted = true;
    pendingStoredFileUrl = null;

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
    if (pendingStoredFileUrl) await deleteStoredExamFile(pendingStoredFileUrl);
    else if (!uploadPersisted) removeUploadedFile(req.file?.path);
    console.error('[Submit Exam Error]', error);
    if ((error as { code?: string }).code === 'P2002') {
      res.status(409).json({ success: false, message: 'รอบสอบนี้มีการส่งข้อสอบแล้ว กรุณาเปิดรายการเดิมแทน' });
      return;
    }
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการส่งข้อสอบ' });
  }
  }
);

// Update / Edit exam (REQ-0005)
router.put('/:id', authenticateToken, uploadExamFile.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user!;
  const examId = Number(id);
  const {
    course_id,
    schedule_id,
    num_copies,
    student_count,
    reserve_copies,
    section,
    num_pages,
    exam_language,
    print_format,
    allowed_materials,
    requires_answer_sheet,
    exam_session_type,
    special_instructions,
    is_double_sided,
    paper_size,
    is_draft,
  } = req.body;
  let uploadPersisted = false;
  let pendingStoredFileUrl: string | null = null;

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      removeUploadedFile(req.file?.path);
      res.status(404).json({ success: false, message: 'ไม่พบข้อมูลข้อสอบ' });
      return;
    }

    // Only the owner or an administrator may edit an exam.
    if (user.role !== UserRole.ADMIN && exam.createdById !== user.id) {
      removeUploadedFile(req.file?.path);
      res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์แก้ไขข้อสอบชุดนี้' });
      return;
    }

    // REQ-0005 Rule Verification
    if (user.role === UserRole.INSTRUCTOR) {
      const editCheck = checkCanEditOrCancel(exam);
      if (!editCheck.allowed) {
        removeUploadedFile(req.file?.path);
        res.status(403).json({ success: false, message: editCheck.reason });
        return;
      }
    }

    if (course_id !== undefined) {
      const nextCourse = await prisma.course.findUnique({ where: { id: Number(course_id) } });
      if (!nextCourse || (user.role === UserRole.INSTRUCTOR && nextCourse.instructorId !== user.id)) {
        removeUploadedFile(req.file?.path);
        res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ย้ายข้อสอบไปยังรายวิชานี้' });
        return;
      }
    }

    const nextCourseId = course_id ? Number(course_id) : exam.courseId;
    let nextScheduleDeadline: Date | undefined;
    if (schedule_id) {
      const nextSchedule = await prisma.examSchedule.findUnique({ where: { id: Number(schedule_id) } });
      if (!nextSchedule || nextSchedule.courseId !== nextCourseId) {
        removeUploadedFile(req.file?.path);
        res.status(400).json({ success: false, message: 'ตารางสอบไม่ตรงกับรายวิชาที่เลือก' });
        return;
      }
      if (user.role === UserRole.INSTRUCTOR && nextSchedule.status === 'CANCELLED') {
        removeUploadedFile(req.file?.path);
        res.status(400).json({ success: false, message: 'ไม่สามารถเลือกตารางสอบที่ถูกยกเลิกได้' });
        return;
      }
      const occupied = await prisma.exam.findFirst({
        where: { scheduleId: nextSchedule.id, id: { not: examId }, status: { not: ExamStatus.CANCELLED } },
        select: { id: true },
      });
      if (occupied) {
        removeUploadedFile(req.file?.path);
        res.status(409).json({ success: false, message: 'ตารางสอบนี้มีรายการส่งข้อสอบแล้ว' });
        return;
      }
      nextScheduleDeadline = parseDeadlineAt(nextSchedule.deadlineDate);
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

    if (newStatus === ExamStatus.SUBMITTED && !fileUrl) {
      removeUploadedFile(req.file?.path);
      res.status(400).json({ success: false, message: 'กรุณาแนบไฟล์ข้อสอบก่อนส่งตรวจสอบ' });
      return;
    }

    const nextReserves = reserve_copies !== undefined ? Number(reserve_copies) : exam.reserveCopies;
    const legacyTotal = num_copies !== undefined ? Number(num_copies) : undefined;
    const nextStudents = student_count !== undefined
      ? Number(student_count)
      : legacyTotal !== undefined && Number.isInteger(legacyTotal)
        ? Math.max(legacyTotal - nextReserves, 1)
        : exam.studentCount;
    if (!Number.isInteger(nextStudents) || nextStudents < 1 || !Number.isInteger(nextReserves) || nextReserves < 0 || nextReserves > 20) {
      removeUploadedFile(req.file?.path);
      res.status(400).json({ success: false, message: 'จำนวนผู้เข้าสอบหรือจำนวนชุดสำรองไม่ถูกต้อง' });
      return;
    }
    if (req.file) {
      fileUrl = await persistExamUpload(req.file);
      pendingStoredFileUrl = fileUrl;
    }

    await prisma.$transaction(async (tx) => {
      await tx.exam.update({
        where: { id: examId },
        data: {
        courseId: course_id ? Number(course_id) : undefined,
        scheduleId: schedule_id !== undefined ? (schedule_id ? Number(schedule_id) : null) : undefined,
        deadlineAt: nextScheduleDeadline,
        fileUrl,
        originalFilename,
        fileType,
        fileSize,
        numCopies: student_count !== undefined || reserve_copies !== undefined || legacyTotal !== undefined ? nextStudents + nextReserves : undefined,
        studentCount: student_count !== undefined || legacyTotal !== undefined ? nextStudents : undefined,
        reserveCopies: reserve_copies !== undefined ? nextReserves : undefined,
        section: section !== undefined ? String(section).trim() || null : undefined,
        numPages: num_pages !== undefined ? Number(num_pages) : undefined,
        examLanguage: exam_language !== undefined ? exam_language : undefined,
        printFormat: print_format !== undefined ? print_format : undefined,
        allowedMaterials: allowed_materials !== undefined ? allowed_materials || null : undefined,
        requiresAnswerSheet: requires_answer_sheet !== undefined ? requires_answer_sheet === 'true' || requires_answer_sheet === true : undefined,
        examSessionType: exam_session_type !== undefined ? exam_session_type : undefined,
        specialInstructions: special_instructions !== undefined ? special_instructions : undefined,
        isDoubleSided:
          is_double_sided !== undefined
            ? is_double_sided === 'false' || is_double_sided === 0 || is_double_sided === false
              ? false
              : true
            : undefined,
        paperSize: paper_size !== undefined ? paper_size : undefined,
        status: newStatus,
        submittedAt: newStatus === ExamStatus.SUBMITTED && !exam.submittedAt ? new Date() : undefined,
        },
      });
      if (newStatus !== exam.status) {
        await tx.examStatusHistory.create({
          data: {
            examId,
            fromStatus: exam.status,
            toStatus: newStatus,
            actionById: user.id,
            actionName: user.full_name,
            note: 'แก้ไขข้อมูลและส่งข้อสอบใหม่',
          },
        });
      }
    });
    uploadPersisted = true;
    pendingStoredFileUrl = null;

    if (req.file && exam.fileUrl && exam.fileUrl !== fileUrl) await deleteStoredExamFile(exam.fileUrl);

    if (newStatus !== exam.status) {
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
    if (pendingStoredFileUrl) await deleteStoredExamFile(pendingStoredFileUrl);
    else if (!uploadPersisted) removeUploadedFile(req.file?.path);
    console.error('[Update Exam Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลข้อสอบ' });
  }
});

// Delete / Cancel exam (REQ-0005)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
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

    // Only the owner or an administrator may cancel an exam.
    if (user.role !== UserRole.ADMIN && exam.createdById !== user.id) {
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

    await prisma.$transaction([
      prisma.exam.update({
        where: { id: examId },
        data: {
          status: ExamStatus.CANCELLED,
          fileUrl: null,
          originalFilename: null,
          fileType: null,
          fileSize: 0,
        },
      }),
      prisma.examStatusHistory.create({
        data: {
          examId,
          fromStatus: exam.status,
          toStatus: ExamStatus.CANCELLED,
          actionById: user.id,
          actionName: user.full_name,
          note: 'ยกเลิกรายการส่งข้อสอบ โดยเก็บข้อมูลและประวัติการดำเนินงานไว้',
        },
      }),
    ]);
    await deleteStoredExamFile(exam.fileUrl);

    await recordAuditLog(user.id, user.full_name, user.role, 'CANCEL_EXAM', 'EXAM', id, req.ip || '127.0.0.1', {
      deleted_exam_id: id,
      status_at_cancel: exam.status,
    });

    broadcastEvent('EXAM_STATUS_CHANGED', { examId, fromStatus: exam.status, toStatus: ExamStatus.CANCELLED });

    res.json({ success: true, message: 'ยกเลิกรายการข้อสอบเรียบร้อยแล้ว และยังเก็บประวัติไว้ในระบบ' });
  } catch (error) {
    console.error('[Cancel Exam Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการยกเลิกข้อสอบ' });
  }
});

export default router;
