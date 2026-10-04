import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { recordAuditLog } from '../middleware/audit';
import { UserRole, Prisma } from '../../generated/prisma';
import { validateNewUsername } from '../security/usernameValidation';

const router = Router();

// Helper to format user for frontend response
function formatUser(u: any) {
  return {
    id: u.id,
    username: u.username,
    full_name: u.fullName,
    email: u.email,
    role: u.role,
    department: u.department,
    phone: u.phone,
    is_active: u.isActive,
    created_at: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
    updated_at: u.updatedAt instanceof Date ? u.updatedAt.toISOString() : u.updatedAt,
  };
}

// List users with search and filter (Admin and Coordinator can list users)
router.get('/', authenticateToken, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, role, status } = req.query;

  try {
    const where: Prisma.UserWhereInput = {};

    if (search) {
      const s = String(search);
      where.OR = [
        { fullName: { contains: s, mode: 'insensitive' } },
        { username: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { department: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (role && Object.values(UserRole).includes(role as UserRole)) {
      where.role = role as UserRole;
    }

    if (status !== undefined && status !== '') {
      where.isActive = status === 'active' || status === '1' || status === 'true';
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { id: 'desc' },
    });

    res.json({ success: true, data: users.map(formatUser) });
  } catch (error) {
    console.error('[User List Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งาน' });
  }
});

// Create new user (Admin only - REQ-0002)
router.post('/', authenticateToken, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  const { username, password, full_name, email, role, department, phone } = req.body;

  if (!username || !password || !full_name || !email || !role) {
    res.status(400).json({
      success: false,
      message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (Username, Password, Name, Email, Role)',
    });
    return;
  }

  if (!Object.values(UserRole).includes(role as UserRole)) {
    res.status(400).json({ success: false, message: 'บทบาทผู้ใช้ไม่ถูกต้อง' });
    return;
  }

  if (String(password).length < 8) {
    res.status(400).json({ success: false, message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร' });
    return;
  }

  const usernameValidation = validateNewUsername(username);
  if (!usernameValidation.ok) {
    res.status(400).json({ success: false, message: usernameValidation.message });
    return;
  }

  if (String(full_name).trim().length < 2) {
    res.status(400).json({ success: false, message: 'ชื่อผู้ใช้สั้นเกินไป' });
    return;
  }

  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existing) {
      res.status(409).json({ success: false, message: 'ชื่อผู้ใช้หรืออีเมลนี้มีอยู่ในระบบแล้ว' });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const newUser = await prisma.user.create({
      data: {
        username,
        passwordHash,
        fullName: full_name,
        email,
        role: role as UserRole,
        department: department || null,
        phone: phone || null,
        isActive: true,
      },
    });

    await recordAuditLog(
      req.user!.id,
      req.user!.full_name,
      req.user!.role,
      'CREATE_USER',
      'USER',
      newUser.id.toString(),
      req.ip || '127.0.0.1',
      {
        created_username: username,
        role,
        full_name,
      }
    );

    res.status(201).json({ success: true, message: 'สร้างผู้ใช้งานสำเร็จ', data: formatUser(newUser) });
  } catch (error) {
    console.error('[Create User Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้งาน' });
  }
});

// Update user details (Admin only - REQ-0002)
router.put('/:id', authenticateToken, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { full_name, email, department, phone, role } = req.body;
  const userId = Number(id);

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งานที่ระบุ' });
      return;
    }

    if (email !== undefined) {
      const duplicate = await prisma.user.findFirst({
        where: { email: String(email), NOT: { id: userId } },
      });
      if (duplicate) {
        res.status(409).json({ success: false, message: 'อีเมลนี้มีผู้ใช้งานอื่นใช้อยู่แล้ว' });
        return;
      }
    }

    if (role !== undefined && !Object.values(UserRole).includes(role as UserRole)) {
      res.status(400).json({ success: false, message: 'บทบาทผู้ใช้ไม่ถูกต้อง' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: full_name !== undefined ? full_name : undefined,
        email: email !== undefined ? email : undefined,
        department: department !== undefined ? department : undefined,
        phone: phone !== undefined ? phone : undefined,
        role: role && Object.values(UserRole).includes(role) ? (role as UserRole) : undefined,
      },
    });

    await recordAuditLog(
      req.user!.id,
      req.user!.full_name,
      req.user!.role,
      'UPDATE_USER',
      'USER',
      id,
      req.ip || '127.0.0.1',
      {
        updated_fields: { full_name, email, department, phone, role },
      }
    );

    res.json({ success: true, message: 'อัปเดตข้อมูลผู้ใช้งานสำเร็จ', data: formatUser(updated) });
  } catch (error) {
    console.error('[Update User Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลผู้ใช้' });
  }
});

// Toggle suspend / active (Admin only - REQ-0002)
router.patch('/:id/suspend', authenticateToken, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = Number(id);

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' });
      return;
    }

    const newStatus = !user.isActive;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: newStatus },
    });

    await recordAuditLog(
      req.user!.id,
      req.user!.full_name,
      req.user!.role,
      newStatus ? 'ACTIVATE_USER' : 'SUSPEND_USER',
      'USER',
      id,
      req.ip || '127.0.0.1',
      {
        previous_status: user.isActive,
        new_status: newStatus,
      }
    );

    res.json({
      success: true,
      message: newStatus ? 'เปิดใช้งานบัญชีผู้ใช้เรียบร้อยแล้ว' : 'ระงับการใช้งานบัญชีเรียบร้อยแล้ว',
      data: { id: userId, is_active: newStatus },
    });
  } catch (error) {
    console.error('[Suspend User Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะบัญชี' });
  }
});

// Change role (Admin only - REQ-0002)
router.patch('/:id/role', authenticateToken, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { role } = req.body;
  const userId = Number(id);

  if (!role || !Object.values(UserRole).includes(role as UserRole)) {
    res.status(400).json({ success: false, message: 'บทบาทผู้ใช้ไม่ถูกต้อง' });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: role as UserRole },
    });

    await recordAuditLog(
      req.user!.id,
      req.user!.full_name,
      req.user!.role,
      'CHANGE_USER_ROLE',
      'USER',
      id,
      req.ip || '127.0.0.1',
      {
        new_role: role,
      }
    );

    res.json({ success: true, message: `เปลี่ยนบทบาทผู้ใช้เป็น ${role} สำเร็จ`, data: { id: userId, role } });
  } catch (error) {
    console.error('[Change Role Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเปลี่ยนบทบาท' });
  }
});

// Delete user (Admin only - REQ-0002)
router.delete('/:id', authenticateToken, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = Number(id);

  // Prevent deleting self
  if (req.user?.id === userId) {
    res.status(400).json({ success: false, message: 'ไม่สามารถลบบัญชีผู้ใช้ของตนเองได้' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Clean up user's notifications and audit logs
      await tx.notification.deleteMany({ where: { userId } });
      await tx.auditLog.deleteMany({ where: { userId } });

      // Clean up records where user was actor
      await tx.examStatusHistory.deleteMany({ where: { actionById: userId } });
      await tx.printRecord.deleteMany({ where: { printedById: userId } });
      await tx.packingRecord.deleteMany({ where: { packedById: userId } });
      await tx.deliveryRecord.deleteMany({
        where: {
          OR: [{ handedOverById: userId }, { receivedById: userId }],
        },
      });
      await tx.envelopeLabel.deleteMany({ where: { generatedById: userId } });

      // Clean up exams created by user or linked to user courses
      const linkedCourses = await tx.course.findMany({
        where: { instructorId: userId },
        select: { id: true },
      });
      const courseIds = linkedCourses.map((c) => c.id);

      await tx.exam.deleteMany({
        where: {
          OR: [{ createdById: userId }, { courseId: { in: courseIds } }],
        },
      });

      await tx.examSchedule.deleteMany({
        where: { courseId: { in: courseIds } },
      });

      await tx.examSchedule.updateMany({
        where: { coordinatorId: userId },
        data: { coordinatorId: null },
      });

      await tx.course.deleteMany({
        where: { instructorId: userId },
      });

      await tx.user.delete({
        where: { id: userId },
      });
    });

    await recordAuditLog(
      req.user!.id,
      req.user!.full_name,
      req.user!.role,
      'DELETE_USER',
      'USER',
      id,
      req.ip || '127.0.0.1',
      {
        deleted_username: user.username,
        deleted_full_name: user.fullName,
      }
    );

    res.json({ success: true, message: `ลบผู้ใช้งาน "${user.fullName}" (${user.username}) เรียบร้อยแล้ว` });
  } catch (error) {
    console.error('[Delete User Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบผู้ใช้งาน' });
  }
});

export default router;
