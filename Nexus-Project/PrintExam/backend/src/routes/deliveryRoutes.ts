import { Router, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { recordAuditLog } from '../middleware/audit';
import { broadcastEvent } from '../services/wsService';
import { createNotification, notifyRole } from '../services/notificationService';
import { ExamStatus, UserRole } from '../../generated/prisma';
import { canTransitionExamStatus, transitionErrorMessage } from '../security/examStatus';

const router = Router();

// Mark Ready for Pickup (REQ-0012: เจ้าหน้าที่หน่วยโสต, ผู้ดูแลระบบ)
router.post(
  '/:id/ready-for-pickup',
  authenticateToken,
  requireRole(UserRole.AV_STAFF, UserRole.ADMIN),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { pickup_location, notes } = req.body;
    const user = req.user!;
    const examId = Number(id);

    try {
      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: {
          course: true,
          schedule: true,
        },
      });

      if (!exam) {
        res.status(404).json({ success: false, message: 'ไม่พบข้อสอบ' });
        return;
      }

      const previousStatus = exam.status;
      const newStatus = ExamStatus.READY_FOR_PICKUP;

      if (!canTransitionExamStatus(previousStatus, newStatus)) {
        res.status(409).json({ success: false, message: transitionErrorMessage(previousStatus, newStatus) });
        return;
      }

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
          note: `ข้อสอบพร้อมส่งมอบ ณ ${pickup_location || 'ศูนย์พิมพ์/หน่วยโสต'} ${notes ? `(${notes})` : ''}`,
        },
      });

      // Notify Exam Coordinator (REQ-0012)
      if (exam.schedule?.coordinatorId) {
        await createNotification(
          exam.schedule.coordinatorId,
          'READY_FOR_PICKUP',
          `ข้อสอบวิชา ${exam.course.courseCode} พร้อมรับมอบแล้ว`,
          `ข้อสอบวิชา ${exam.course.courseCode} สำหรับห้องสอบ ${exam.schedule.room || 'ตามตาราง'} บรรจุซองเรียบร้อย พร้อมให้มารับที่ ${pickup_location || 'หน่วยโสต'}`,
          `/coordinator/receive`
        );
      } else {
        await notifyRole(
          UserRole.COORDINATOR,
          'READY_FOR_PICKUP',
          `ข้อสอบวิชา ${exam.course.courseCode} พร้อมรับมอบแล้ว`,
          `ข้อสอบวิชา ${exam.course.courseCode} บรรจุซองเรียบร้อย พร้อมให้มารับที่ ${pickup_location || 'หน่วยโสต'}`,
          `/coordinator/receive`
        );
      }

      broadcastEvent('EXAM_STATUS_CHANGED', { examId, fromStatus: previousStatus, toStatus: newStatus });

      await recordAuditLog(user.id, user.full_name, user.role, 'READY_FOR_PICKUP', 'EXAM', id, req.ip || '127.0.0.1', {
        course_code: exam.course.courseCode,
        pickup_location,
      });

      res.json({
        success: true,
        message: 'แจ้งเตือนพร้อมส่งมอบข้อสอบเรียบร้อยแล้ว (แจ้งเตือนไปยังเจ้าหน้าที่ดำเนินการสอบแล้ว)',
        data: { id: examId, status: newStatus },
      });
    } catch (error) {
      console.error('[Ready for Pickup Error]', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการตั้งสถานะพร้อมรับมอบ' });
    }
  }
);

// Confirm Handover / Delivery (REQ-0012: เจ้าหน้าที่ดำเนินการสอบ เป็นผู้ลงนามรับมอบ)
router.post(
  '/:id/deliver',
  authenticateToken,
  requireRole(UserRole.COORDINATOR),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { handed_over_by_id, received_by_id, receiver_signature_note } = req.body;
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

      if (!canTransitionExamStatus(exam.status, ExamStatus.DELIVERED)) {
        res.status(409).json({ success: false, message: transitionErrorMessage(exam.status, ExamStatus.DELIVERED) });
        return;
      }

      const handoverId = handed_over_by_id ? Number(handed_over_by_id) : user.id;
      const receiverId = received_by_id ? Number(received_by_id) : user.id;

      if (!Number.isInteger(handoverId) || !Number.isInteger(receiverId)) {
        res.status(400).json({ success: false, message: 'ข้อมูลผู้ส่งมอบหรือผู้รับมอบไม่ถูกต้อง' });
        return;
      }

      // Insert delivery record
      await prisma.deliveryRecord.create({
        data: {
          examId,
          handedOverById: handoverId,
          receivedById: receiverId,
          receiverSignatureNote: receiver_signature_note || 'ลงนามรับมอบข้อสอบเรียบร้อย ซีลสมบูรณ์',
        },
      });

      const previousStatus = exam.status;
      const newStatus = ExamStatus.DELIVERED;

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
          note: `ส่งมอบและรับมอบข้อสอบเรียบร้อย [${receiver_signature_note || 'ซีลสมบูรณ์'}]`,
        },
      });

      // Notify instructor that exam has been delivered to exam center
      await createNotification(
        exam.createdById,
        'EXAM_DELIVERED',
        `ข้อสอบวิชา ${exam.course.courseCode} ส่งมอบถึงศูนย์สอบแล้ว`,
        `ข้อสอบวิชา ${exam.course.courseCode} ได้รับการส่งมอบให้ฝ่ายดำเนินการสอบเรียบร้อยแล้ว`,
        `/instructor/exams/${id}`
      );

      broadcastEvent('EXAM_STATUS_CHANGED', { examId, fromStatus: previousStatus, toStatus: newStatus });

      await recordAuditLog(user.id, user.full_name, user.role, 'DELIVER_EXAM', 'EXAM', id, req.ip || '127.0.0.1', {
        course_code: exam.course.courseCode,
        receiver_signature_note,
      });

      res.json({
        success: true,
        message: 'บันทึกการส่งมอบ-รับมอบข้อสอบเรียบร้อยแล้ว (สถานะ: ส่งมอบแล้ว)',
        data: { id: examId, status: newStatus },
      });
    } catch (error) {
      console.error('[Delivery Error]', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกการส่งมอบ' });
    }
  }
);

export default router;
