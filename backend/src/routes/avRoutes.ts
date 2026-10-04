import { Router, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { recordAuditLog } from '../middleware/audit';
import { broadcastEvent } from '../services/wsService';
import { createNotification } from '../services/notificationService';
import { generateEnvelopeLabelPdf } from '../services/pdfService';
import { ExamStatus, UserRole } from '../../generated/prisma';
import { canTransitionExamStatus, transitionErrorMessage } from '../security/examStatus';
import { canAccessExamEnvelope } from '../security/examAccess';

const router = Router();

// 1. File Validation & Approval (REQ-0006: เปลี่ยนสถานะเป็น "ตัดข้อสอบ" / APPROVED)
router.post(
  '/:id/validate',
  authenticateToken,
  requireRole(UserRole.AV_STAFF, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { notes } = req.body;
    const user = req.user!;
    const examId = Number(id);

    try {
      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: {
          course: true,
        },
      });

      if (!exam) {
        res.status(404).json({ success: false, message: 'ไม่พบข้อสอบ' });
        return;
      }

      // Automatic file completeness check (REQ-0006)
      if (!exam.fileUrl) {
        res.status(400).json({ success: false, message: 'ไม่พบไฟล์ข้อสอบในระบบ กรุณาให้อาจารย์อัปโหลดไฟล์ก่อน' });
        return;
      }

      const previousStatus = exam.status;
      const newStatus = ExamStatus.APPROVED;

      if (!canTransitionExamStatus(previousStatus, newStatus)) {
        res.status(409).json({ success: false, message: transitionErrorMessage(previousStatus, newStatus) });
        return;
      }

      await prisma.exam.update({
        where: { id: examId },
        data: {
          status: newStatus,
          rejectionReason: null,
        },
      });

      await prisma.examStatusHistory.create({
        data: {
          examId,
          fromStatus: previousStatus,
          toStatus: newStatus,
          actionById: user.id,
          actionName: user.full_name,
          note: notes || 'ตรวจสอบไฟล์ถูกต้อง อนุมัติและตัดข้อสอบเรียบร้อย',
        },
      });

      // Notify instructor (REQ-0006, REQ-0008)
      await createNotification(
        exam.createdById,
        'EXAM_APPROVED',
        `ข้อสอบวิชา ${exam.course.courseCode} ได้รับการอนุมัติ (ตัดข้อสอบแล้ว)`,
        `เจ้าหน้าที่หน่วยโสตได้ตรวจสอบและตัดข้อสอบวิชา ${exam.course.courseCode} เรียบร้อยแล้ว พร้อมเข้าสู่กระบวนการพิมพ์`,
        `/instructor/exams/${id}`
      );

      broadcastEvent('EXAM_STATUS_CHANGED', { examId, fromStatus: previousStatus, toStatus: newStatus });

      await recordAuditLog(user.id, user.full_name, user.role, 'APPROVE_EXAM', 'EXAM', id, req.ip || '127.0.0.1', {
        course_code: exam.course.courseCode,
        from_status: previousStatus,
        to_status: newStatus,
        notes,
      });

      res.json({
        success: true,
        message: 'อนุมัติตัดข้อสอบเรียบร้อยแล้ว สถานะเปลี่ยนเป็น "อนุมัติ / ตัดข้อสอบแล้ว"',
        data: { id: examId, status: newStatus },
      });
    } catch (error) {
      console.error('[Approve Exam Error]', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอนุมัติตัดข้อสอบ' });
    }
  }
);

// 2. Reject File with Reason (REQ-0007)
router.post(
  '/:id/reject',
  authenticateToken,
  requireRole(UserRole.AV_STAFF, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user!;
    const examId = Number(id);

    if (!reason || !reason.trim()) {
      res.status(400).json({
        success: false,
        message: 'กรุณาระบุสาเหตุที่ข้อสอบไม่ผ่านการตรวจสอบ (เพื่อให้ผู้สอนแก้ไข)',
      });
      return;
    }

    try {
      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: {
          course: true,
        },
      });

      if (!exam) {
        res.status(404).json({ success: false, message: 'ไม่พบข้อสอบ' });
        return;
      }

      const previousStatus = exam.status;
      const newStatus = ExamStatus.REJECTED;

      if (!canTransitionExamStatus(previousStatus, newStatus)) {
        res.status(409).json({ success: false, message: transitionErrorMessage(previousStatus, newStatus) });
        return;
      }

      await prisma.exam.update({
        where: { id: examId },
        data: {
          status: newStatus,
          rejectionReason: reason,
        },
      });

      await prisma.examStatusHistory.create({
        data: {
          examId,
          fromStatus: previousStatus,
          toStatus: newStatus,
          actionById: user.id,
          actionName: user.full_name,
          note: `ส่งกลับเพื่อแก้ไข: ${reason}`,
        },
      });

      // Notify instructor with reason (REQ-0007)
      await createNotification(
        exam.createdById,
        'EXAM_REJECTED',
        `ข้อสอบวิชา ${exam.course.courseCode} ไม่ผ่านการตรวจสอบ`,
        `สาเหตุ: ${reason} (กรุณาแก้ไขไฟล์และส่งใหม่เข้าระบบ)`,
        `/instructor/exams/${id}`
      );

      broadcastEvent('EXAM_STATUS_CHANGED', {
        examId,
        fromStatus: previousStatus,
        toStatus: newStatus,
        rejectionReason: reason,
      });

      await recordAuditLog(user.id, user.full_name, user.role, 'REJECT_EXAM', 'EXAM', id, req.ip || '127.0.0.1', {
        course_code: exam.course.courseCode,
        reason,
      });

      res.json({
        success: true,
        message: 'ส่งกลับแก้ไขข้อสอบเรียบร้อยแล้ว ระบบได้แจ้งเตือนผู้สอนทันที',
        data: { id: examId, status: newStatus, reason },
      });
    } catch (error) {
      console.error('[Reject Exam Error]', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการส่งกลับแก้ไขข้อสอบ' });
    }
  }
);

// 3. Print Exam & Record Copies (REQ-0009)
router.post(
  '/:id/print',
  authenticateToken,
  requireRole(UserRole.AV_STAFF, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { printed_copies, paper_type, notes, mark_completed } = req.body;
    const user = req.user!;
    const examId = Number(id);

    try {
      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: {
          course: true,
        },
      });

      if (!exam) {
        res.status(404).json({ success: false, message: 'ไม่พบข้อสอบ' });
        return;
      }

      const copies = Number(printed_copies || exam.numCopies);

      if (!Number.isInteger(copies) || copies < 1) {
        res.status(400).json({ success: false, message: 'จำนวนชุดที่พิมพ์ต้องเป็นจำนวนเต็มอย่างน้อย 1 ชุด' });
        return;
      }

      const previousStatus = exam.status;
      const newStatus = mark_completed ? ExamStatus.PRINTED : ExamStatus.PRINTING;

      if (!canTransitionExamStatus(previousStatus, newStatus)) {
        res.status(409).json({ success: false, message: transitionErrorMessage(previousStatus, newStatus) });
        return;
      }

      // Insert print record
      await prisma.printRecord.create({
        data: {
          examId,
          printedById: user.id,
          printedCopies: copies,
          paperType: paper_type || 'A4 80gsm',
          notes: notes || null,
        },
      });

      await prisma.exam.update({
        where: { id: examId },
        data: { status: newStatus },
      });

      await prisma.examStatusHistory.create({
        data: {
          examId,
          fromStatus: previousStatus,
          toStatus: newStatus,
          actionById: user.id,
          actionName: user.full_name,
          note: `จัดพิมพ์จำนวน ${copies} ชุด (${paper_type || 'A4 80gsm'}) ${mark_completed ? '[พิมพ์เสร็จสมบูรณ์]' : '[กำลังจัดพิมพ์]'}`,
        },
      });

      broadcastEvent('EXAM_STATUS_CHANGED', { examId, fromStatus: previousStatus, toStatus: newStatus });

      await recordAuditLog(user.id, user.full_name, user.role, 'PRINT_EXAM', 'EXAM', id, req.ip || '127.0.0.1', {
        printed_copies: copies,
        paper_type,
        status: newStatus,
      });

      res.json({
        success: true,
        message: mark_completed ? 'บันทึกการพิมพ์ข้อสอบเสร็จสมบูรณ์' : 'เริ่มกระบวนการพิมพ์ข้อสอบ',
        data: { id: examId, status: newStatus, printed_copies: copies },
      });
    } catch (error) {
      console.error('[Print Exam Error]', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกการพิมพ์' });
    }
  }
);

// 4. Generate & Download Envelope Label PDF (REQ-0010: owner/instructor and operational roles)
// GET is intentionally side-effect free: viewing/downloading a document must not
// create or update an EnvelopeLabel record.
router.get(
  '/:id/envelope-label',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
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
          printRecords: {
            orderBy: { printedAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!exam) {
        res.status(404).json({ success: false, message: 'ไม่พบข้อสอบ' });
        return;
      }

      if (!canAccessExamEnvelope(user, exam)) {
        res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงใบปะหน้าซองข้อสอบนี้' });
        return;
      }

      const labelCode = `ENV-${exam.course.courseCode}-${exam.id}-${exam.course.academicYear || '2569'}`;

      const pdfBuffer = await generateEnvelopeLabelPdf({
        examId,
        labelCode,
        courseCode: exam.course.courseCode,
        courseName: exam.course.courseName,
        instructorName: exam.course.instructor?.fullName || 'ไม่ระบุอาจารย์',
        examType: exam.schedule?.examType === 'MIDTERM' ? 'สอบกลางภาค (Midterm)' : 'สอบไล่ปลายภาค (Final Exam)',
        examDate: exam.schedule?.examDate || 'ตามตารางสอบ',
        examTime:
          exam.schedule?.startTime && exam.schedule?.endTime
            ? `${exam.schedule.startTime} - ${exam.schedule.endTime}`
            : 'ตามตารางสอบ',
        room: exam.schedule?.room || 'ห้องสอบตามประกาศ',
        deadlineDate: exam.schedule?.deadlineDate || undefined,
        coordinatorName: exam.schedule?.coordinator?.fullName || undefined,
        numCopies: exam.printRecords?.[0]?.printedCopies ?? exam.numCopies,
        numPages: exam.numPages || 1,
        paperSize: exam.paperSize || 'A4',
        isDoubleSided: exam.isDoubleSided,
        specialInstructions: exam.specialInstructions || undefined,
        semester: exam.course.semester || 1,
        academicYear: exam.course.academicYear || '2569',
        generatedBy: user.full_name,
        generatedAt: new Date().toISOString(),
      });

      res.setHeader('Content-Type', 'application/pdf');
      const safeCourseCode = exam.course.courseCode.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || `exam-${id}`;
      res.setHeader('Content-Disposition', `inline; filename="cover-sheet-${safeCourseCode}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[Error generating PDF]', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้างไฟล์ PDF ใบปะหน้าซองข้อสอบ' });
    }
  }
);

// 5. Envelope Packing Confirmation (REQ-0011: เจ้าหน้าที่หน่วยโสต)
router.post(
  '/:id/pack',
  authenticateToken,
  requireRole(UserRole.AV_STAFF, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { envelope_count, notes } = req.body;
    const user = req.user!;
    const examId = Number(id);

    try {
      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: {
          course: true,
        },
      });

      if (!exam) {
        res.status(404).json({ success: false, message: 'ไม่พบข้อสอบ' });
        return;
      }

      const envCount = Number(envelope_count || 1);

      if (!Number.isInteger(envCount) || envCount < 1) {
        res.status(400).json({ success: false, message: 'จำนวนซองต้องเป็นจำนวนเต็มอย่างน้อย 1 ซอง' });
        return;
      }

      const previousStatus = exam.status;
      const newStatus = ExamStatus.PACKED;

      if (!canTransitionExamStatus(previousStatus, newStatus)) {
        res.status(409).json({ success: false, message: transitionErrorMessage(previousStatus, newStatus) });
        return;
      }

      // Insert packing record
      await prisma.packingRecord.create({
        data: {
          examId,
          packedById: user.id,
          envelopeCount: envCount,
          notes: notes || null,
        },
      });

      await prisma.exam.update({
        where: { id: examId },
        data: { status: newStatus },
      });

      await prisma.examStatusHistory.create({
        data: {
          examId,
          fromStatus: previousStatus,
          toStatus: newStatus,
          actionById: user.id,
          actionName: user.full_name,
          note: `บรรจุข้อสอบลงซองเรียบร้อย (${envCount} ซอง) ${notes ? `[${notes}]` : ''}`,
        },
      });

      broadcastEvent('EXAM_STATUS_CHANGED', { examId, fromStatus: previousStatus, toStatus: newStatus });

      await recordAuditLog(user.id, user.full_name, user.role, 'PACK_EXAM', 'EXAM', id, req.ip || '127.0.0.1', {
        envelope_count: envCount,
        notes,
      });

      res.json({
        success: true,
        message: 'ยืนยันการบรรจุซองข้อสอบเรียบร้อยแล้ว',
        data: { id: examId, status: newStatus, envelope_count: envCount },
      });
    } catch (error) {
      console.error('[Pack Exam Error]', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการยืนยันบรรจุซอง' });
    }
  }
);

export default router;
