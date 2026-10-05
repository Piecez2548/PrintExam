import { Router, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { recordAuditLog } from '../middleware/audit';
import { broadcastEvent } from '../services/wsService';
import { createNotification } from '../services/notificationService';
import { generateEnvelopeLabelPdf } from '../services/pdfService';
import { createPaperPrintSpecification } from '../data/paperPrintSpecification';
import { ExamStatus, UserRole } from '../../generated/prisma';

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
      const exam = await prisma.exam.findFirst({
        where: { id: examId, deletedAt: null },
        include: {
          course: true,
        },
      });

      if (!exam) {
        res.status(404).json({ success: false, message: 'ไม่พบข้อสอบ' });
        return;
      }

      if (exam.status !== ExamStatus.SUBMITTED) {
        res.status(409).json({ success: false, message: `อนุมัติได้เฉพาะข้อสอบสถานะ SUBMITTED (ปัจจุบัน: ${exam.status})` });
        return;
      }

      // Automatic file completeness check (REQ-0006)
      if (!exam.fileUrl) {
        res.status(400).json({ success: false, message: 'ไม่พบไฟล์ข้อสอบในระบบ กรุณาให้อาจารย์อัปโหลดไฟล์ก่อน' });
        return;
      }

      const previousStatus = exam.status;
      const newStatus = ExamStatus.APPROVED;

      await prisma.$transaction([
        prisma.exam.update({
          where: { id: examId, deletedAt: null },
          data: { status: newStatus, rejectionReason: null },
        }),
        prisma.examStatusHistory.create({
          data: {
            examId,
            fromStatus: previousStatus,
            toStatus: newStatus,
            actionById: user.id,
            actionName: user.full_name,
            note: notes || 'ตรวจสอบไฟล์ถูกต้อง อนุมัติและตัดข้อสอบเรียบร้อย',
          },
        }),
      ]);
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
      const exam = await prisma.exam.findFirst({
        where: { id: examId, deletedAt: null },
        include: {
          course: true,
        },
      });

      if (!exam) {
        res.status(404).json({ success: false, message: 'ไม่พบข้อสอบ' });
        return;
      }

      if (exam.status !== ExamStatus.SUBMITTED) {
        res.status(409).json({ success: false, message: `ส่งกลับแก้ไขได้เฉพาะข้อสอบสถานะ SUBMITTED (ปัจจุบัน: ${exam.status})` });
        return;
      }

      const previousStatus = exam.status;
      const newStatus = ExamStatus.REJECTED;

      await prisma.$transaction([
        prisma.exam.update({
          where: { id: examId, deletedAt: null },
          data: { status: newStatus, rejectionReason: reason.trim().slice(0, 1000) },
        }),
        prisma.examStatusHistory.create({
          data: {
            examId,
            fromStatus: previousStatus,
            toStatus: newStatus,
            actionById: user.id,
            actionName: user.full_name,
            note: `ส่งกลับเพื่อแก้ไข: ${reason.trim().slice(0, 1000)}`,
          },
        }),
      ]);

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
    const { printed_copies, paper_weight, notes, mark_completed } = req.body;
    const user = req.user!;
    const examId = Number(id);

    try {
      const exam = await prisma.exam.findFirst({
        where: { id: examId, deletedAt: null },
        include: {
          course: true,
        },
      });

      if (!exam) {
        res.status(404).json({ success: false, message: 'ไม่พบข้อสอบ' });
        return;
      }

      if (exam.status !== ExamStatus.APPROVED && exam.status !== ExamStatus.PRINTING) {
        res.status(409).json({ success: false, message: `เริ่มหรือบันทึกการพิมพ์ไม่ได้จากสถานะ ${exam.status}` });
        return;
      }

      const paperSpecification = createPaperPrintSpecification(exam.paperSize, exam.isDoubleSided, paper_weight);
      if (!paperSpecification.ok) {
        res.status(400).json({
          success: false,
          code: 'UNSUPPORTED_PRINT_SPEC',
          message: 'ขนาดหรือชนิดกระดาษที่เลือกไม่รองรับ',
        });
        return;
      }
      // Keep successful request audit entries canonical even if an old or malicious client sends paper_type.
      req.body.paper_type = paperSpecification.paperType;

      const copies = Number(printed_copies || exam.numCopies);
      if (!Number.isInteger(copies) || copies < 1 || copies > 100000) {
        res.status(400).json({ success: false, message: 'จำนวนชุดที่พิมพ์ไม่ถูกต้อง' });
        return;
      }

      const previousStatus = exam.status;
      const newStatus = mark_completed ? ExamStatus.PRINTED : ExamStatus.PRINTING;
      await prisma.$transaction([
        prisma.printRecord.create({
          data: {
            examId,
            printedById: user.id,
            printedCopies: copies,
            paperType: paperSpecification.paperType,
            notes: notes ? String(notes).slice(0, 1000) : null,
          },
        }),
        prisma.exam.update({ where: { id: examId, deletedAt: null }, data: { status: newStatus } }),
        prisma.examStatusHistory.create({
          data: {
            examId,
            fromStatus: previousStatus,
            toStatus: newStatus,
            actionById: user.id,
            actionName: user.full_name,
            note: `จัดพิมพ์จำนวน ${copies} ชุด (${paperSpecification.paperType}) ${mark_completed ? '[พิมพ์เสร็จสมบูรณ์]' : '[กำลังจัดพิมพ์]'}`,
          },
        }),
      ]);

      broadcastEvent('EXAM_STATUS_CHANGED', { examId, fromStatus: previousStatus, toStatus: newStatus });

      await recordAuditLog(user.id, user.full_name, user.role, 'PRINT_EXAM', 'EXAM', id, req.ip || '127.0.0.1', {
        printed_copies: copies,
        paper_type: paperSpecification.paperType,
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

// 4. Generate & Download Envelope Label PDF (REQ-0010: เจ้าหน้าที่หน่วยโสต, ผู้ดูแลระบบ)
router.get(
  '/:id/envelope-label',
  authenticateToken,
  requireRole(UserRole.AV_STAFF, UserRole.ADMIN, UserRole.COORDINATOR),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const user = req.user!;
    const examId = Number(id);

    try {
      const exam = await prisma.exam.findFirst({
        where: { id: examId, deletedAt: null },
        include: {
          course: {
            include: {
              instructor: true,
            },
          },
          schedule: true,
        },
      });

      if (!exam) {
        res.status(404).json({ success: false, message: 'ไม่พบข้อสอบ' });
        return;
      }

      if (
        exam.status !== ExamStatus.PRINTED &&
        exam.status !== ExamStatus.PACKED &&
        exam.status !== ExamStatus.READY_FOR_PICKUP &&
        exam.status !== ExamStatus.DELIVERED
      ) {
        res.status(409).json({ success: false, message: `สร้างใบปะหน้าไม่ได้จากสถานะ ${exam.status}` });
        return;
      }

      const labelCode = `ENV-${exam.course.courseCode}-${exam.id}`;
      const labelSnapshot = {
        examId: exam.id,
        courseCode: exam.course.courseCode,
        courseName: exam.course.courseName,
        instructorName: exam.course.instructor?.fullName || null,
        instructorPhone: exam.course.instructor?.phone || null,
        officeRoom: exam.course.instructor?.officeRoom || null,
        examDate: exam.schedule?.examDate || null,
        startTime: exam.schedule?.startTime || null,
        endTime: exam.schedule?.endTime || null,
        room: exam.schedule?.room || null,
        section: exam.section || exam.schedule?.section || null,
        studentCount: exam.studentCount,
        reserveCopies: exam.reserveCopies,
        numCopies: exam.numCopies,
      };

      // Save envelope label record
      await prisma.envelopeLabel.upsert({
        where: { examId },
        update: {
          labelCode,
          generatedById: user.id,
          generatedAt: new Date(),
          detailsJson: JSON.stringify(labelSnapshot),
        },
        create: {
          examId,
          labelCode,
          generatedById: user.id,
          detailsJson: JSON.stringify(labelSnapshot),
        },
      });

      const pdfBuffer = await generateEnvelopeLabelPdf({
        examId,
        labelCode,
        courseCode: exam.course.courseCode,
        courseName: exam.course.courseName,
        instructorName: exam.course.instructor?.fullName || 'ไม่ระบุอาจารย์',
        instructorPhone: exam.course.instructor?.phone || undefined,
        officeRoom: exam.course.instructor?.officeRoom || undefined,
        facultyName: exam.course.department || exam.course.instructor?.department || 'วิทยาศาสตร์',
        examType: exam.schedule?.examType === 'MIDTERM' ? 'สอบกลางภาค (Midterm)' : 'สอบไล่ปลายภาค (Final Exam)',
        examDate: exam.schedule?.examDate || 'ตามตารางสอบ',
        examTime:
          exam.schedule?.startTime && exam.schedule?.endTime
            ? `${exam.schedule.startTime} - ${exam.schedule.endTime}`
            : 'ตามตารางสอบ',
        room: exam.schedule?.room || 'ห้องสอบตามประกาศ',
        section: exam.section || exam.schedule?.section || undefined,
        studentCount: exam.studentCount,
        reserveCopies: exam.reserveCopies,
        numCopies: exam.numCopies,
        numPages: exam.numPages || 1,
        paperSize: exam.paperSize || 'A4',
        printFormat: exam.printFormat,
        examLanguage: exam.examLanguage,
        allowedMaterials: exam.allowedMaterials || undefined,
        requiresAnswerSheet: exam.requiresAnswerSheet,
        specialInstructions: exam.specialInstructions || undefined,
        semester: exam.course.semester || 1,
        academicYear: exam.course.academicYear || '2569',
        generatedBy: user.full_name,
        generatedAt: new Date().toISOString(),
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Envelope_Label_${exam.course.courseCode}_${id}.pdf"`);
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
      const exam = await prisma.exam.findFirst({
        where: { id: examId, deletedAt: null },
        include: {
          course: true,
        },
      });

      if (!exam) {
        res.status(404).json({ success: false, message: 'ไม่พบข้อสอบ' });
        return;
      }

      if (exam.status !== ExamStatus.PRINTED) {
        res.status(409).json({ success: false, message: `บรรจุซองได้เฉพาะข้อสอบที่พิมพ์เสร็จแล้ว (ปัจจุบัน: ${exam.status})` });
        return;
      }

      const envCount = Number(envelope_count || 1);
      if (!Number.isInteger(envCount) || envCount < 1 || envCount > 10000) {
        res.status(400).json({ success: false, message: 'จำนวนซองไม่ถูกต้อง' });
        return;
      }

      const previousStatus = exam.status;
      const newStatus = ExamStatus.PACKED;
      await prisma.$transaction([
        prisma.packingRecord.create({
          data: {
            examId,
            packedById: user.id,
            envelopeCount: envCount,
            notes: notes ? String(notes).slice(0, 1000) : null,
          },
        }),
        prisma.exam.update({ where: { id: examId, deletedAt: null }, data: { status: newStatus } }),
        prisma.examStatusHistory.create({
          data: {
            examId,
            fromStatus: previousStatus,
            toStatus: newStatus,
            actionById: user.id,
            actionName: user.full_name,
            note: `บรรจุข้อสอบลงซองเรียบร้อย (${envCount} ซอง) ${notes ? `[${String(notes).slice(0, 500)}]` : ''}`,
          },
        }),
      ]);

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
