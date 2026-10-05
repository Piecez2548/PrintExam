import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { recordAuditLog } from '../middleware/audit';
import { UserRole, Prisma } from '../../generated/prisma';
import { setAuthCookie, signAccessToken } from '../services/authTokenService';
import { validatePassword } from '../utils/passwordPolicy';

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
    office_room: u.officeRoom,
    is_active: u.isActive,
    must_change_password: u.mustChangePassword,
    created_at: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
    updated_at: u.updatedAt instanceof Date ? u.updatedAt.toISOString() : u.updatedAt,
  };
}

router.get('/password-reset-requests', authenticateToken, requireRole(UserRole.ADMIN), async (_req: AuthRequest, res: Response): Promise<void> => {
  const requests = await prisma.passwordResetRequest.findMany({
    where: { status: 'PENDING' },
    include: { user: true },
    orderBy: { requestedAt: 'asc' },
    take: 100,
  });
  res.json({
    success: true,
    data: requests.map((request) => ({
      id: request.id,
      user_id: request.userId,
      username: request.user.username,
      full_name: request.user.fullName,
      email: request.user.email,
      role: request.user.role,
      requested_at: request.requestedAt.toISOString(),
    })),
  });
});

// List users with search and filter (Admin and Coordinator can list users)
router.get(
  '/',
  authenticateToken,
  requireRole(UserRole.ADMIN, UserRole.COORDINATOR),
  async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, role, status } = req.query;

  try {
    const where: Prisma.UserWhereInput = {};
    if (req.user?.role === UserRole.COORDINATOR) where.role = UserRole.INSTRUCTOR;

    if (search) {
      const s = String(search);
      where.OR = [
        { fullName: { contains: s, mode: 'insensitive' } },
        { username: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { department: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (req.user?.role === UserRole.ADMIN && role && Object.values(UserRole).includes(role as UserRole)) {
      where.role = role as UserRole;
    }

    if (status !== undefined && status !== '') {
      where.isActive = status === 'active' || status === '1' || status === 'true';
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { id: 'desc' },
      take: 500,
    });

    const data = users.map((user) => {
      const formatted = formatUser(user);
      if (req.user?.role === UserRole.ADMIN) return formatted;
      return {
        id: formatted.id,
        full_name: formatted.full_name,
        role: formatted.role,
        department: formatted.department,
        is_active: formatted.is_active,
      };
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('[User List Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งาน' });
  }
  }
);

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

  const initialPasswordError = validatePassword(String(password));
  if (initialPasswordError) {
    res.status(400).json({ success: false, message: initialPasswordError });
    return;
  }

  if (!Object.values(UserRole).includes(role as UserRole)) {
    res.status(400).json({ success: false, message: 'บทบาทผู้ใช้ไม่ถูกต้อง' });
    return;
  }

  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: String(username).trim(), mode: 'insensitive' } },
          { email: { equals: String(email).trim(), mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      res.status(409).json({ success: false, message: 'ชื่อผู้ใช้หรืออีเมลนี้มีอยู่ในระบบแล้ว' });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 12);
    const newUser = await prisma.user.create({
      data: {
        username: String(username).trim(),
        passwordHash,
        fullName: String(full_name).trim(),
        email: String(email).trim().toLowerCase(),
        role: role as UserRole,
        department: department || null,
        phone: phone || null,
        isActive: true,
        mustChangePassword: true,
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

// Update the signed-in user's profile and optionally change their password.
router.put('/me/profile', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const { username, full_name, email, department, phone, office_room, current_password, new_password } = req.body;
  const normalizedUsername = String(username || '').trim();
  const normalizedName = String(full_name || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedDepartment = String(department || '').trim();
  const normalizedPhone = String(phone || '').trim();
  const normalizedOfficeRoom = String(office_room || '').trim();

  if (!normalizedUsername || !normalizedName || !normalizedEmail || !normalizedDepartment || !normalizedPhone || !normalizedOfficeRoom) {
    res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลโปรไฟล์ทุกช่องให้ครบถ้วน' });
    return;
  }
  if (!/^\S{3,64}$/.test(normalizedUsername)) {
    res.status(400).json({ success: false, message: 'ชื่อผู้ใช้ต้องมี 3-64 ตัวอักษรและห้ามมีช่องว่าง' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    res.status(400).json({ success: false, message: 'รูปแบบอีเมลไม่ถูกต้อง' });
    return;
  }
  if (normalizedName.length > 150 || normalizedEmail.length > 254 || normalizedDepartment.length > 150 || normalizedOfficeRoom.length > 100) {
    res.status(400).json({ success: false, message: 'ข้อมูลโปรไฟล์บางช่องยาวเกินกว่าที่ระบบกำหนด' });
    return;
  }
  const phoneDigits = normalizedPhone.replace(/\D/g, '');
  if (phoneDigits.length < 8 || phoneDigits.length > 15 || normalizedPhone.length > 30) {
    res.status(400).json({ success: false, message: 'เบอร์โทรศัพท์ต้องมีตัวเลข 8-15 หลัก' });
    return;
  }
  const newPasswordError = new_password ? validatePassword(String(new_password)) : null;
  if (newPasswordError) {
    res.status(400).json({ success: false, message: newPasswordError });
    return;
  }

  try {
    const current = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!current) {
      res.status(404).json({ success: false, message: 'ไม่พบบัญชีผู้ใช้' });
      return;
    }
    if (new_password) {
      if (!current_password || !bcrypt.compareSync(String(current_password), current.passwordHash)) {
        res.status(400).json({ success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
        return;
      }
      if (bcrypt.compareSync(String(new_password), current.passwordHash)) {
        res.status(400).json({ success: false, message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน' });
        return;
      }
    }

    const duplicate = await prisma.user.findFirst({
      where: {
        id: { not: current.id },
        OR: [{ username: normalizedUsername }, { email: normalizedEmail }],
      },
      select: { id: true },
    });
    if (duplicate) {
      res.status(409).json({ success: false, message: 'ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้งานแล้ว' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: current.id },
      data: {
        username: normalizedUsername,
        fullName: normalizedName,
        email: normalizedEmail,
        department: normalizedDepartment,
        phone: normalizedPhone,
        officeRoom: normalizedOfficeRoom,
        passwordHash: new_password ? bcrypt.hashSync(String(new_password), 12) : undefined,
        mustChangePassword: new_password ? false : undefined,
        sessionVersion: new_password ? { increment: 1 } : undefined,
        twoFactorTempCode: new_password ? null : undefined,
        twoFactorExpiresAt: new_password ? null : undefined,
        twoFactorFailedAttempts: new_password ? 0 : undefined,
      },
    });

    await recordAuditLog(
      current.id,
      updated.fullName,
      updated.role,
      'UPDATE_OWN_PROFILE',
      'USER',
      current.id.toString(),
      req.ip || '127.0.0.1',
      { username_changed: current.username !== updated.username, password_changed: Boolean(new_password) }
    );

    if (new_password) {
      setAuthCookie(res, signAccessToken({
        id: updated.id,
        username: updated.username,
        role: updated.role,
        sessionVersion: updated.sessionVersion,
      }));
    }
    res.json({ success: true, message: 'บันทึกโปรไฟล์เรียบร้อยแล้ว', data: formatUser(updated) });
  } catch (error) {
    console.error('[Update Own Profile Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกโปรไฟล์' });
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
    if (req.user!.id === userId && role && role !== user.role) {
      res.status(400).json({ success: false, message: 'ไม่สามารถเปลี่ยนบทบาทบัญชีของตนเองได้' });
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
        sessionVersion: role && role !== user.role ? { increment: 1 } : undefined,
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
  if (req.user!.id === userId) {
    res.status(400).json({ success: false, message: 'ไม่สามารถระงับบัญชีของตนเองได้' });
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

    const newStatus = !user.isActive;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: newStatus, sessionVersion: { increment: 1 } },
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

// Set a temporary password for a user who cannot sign in. The user must replace
// it from their profile after the next successful login.
router.patch('/:id/reset-password', authenticateToken, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = Number(req.params.id);
  const newPassword = String(req.body?.new_password || '');
  const adminPassword = String(req.body?.admin_password || '');

  if (!Number.isInteger(userId)) {
    res.status(400).json({ success: false, message: 'รหัสผู้ใช้งานไม่ถูกต้อง' });
    return;
  }
  const temporaryPasswordError = validatePassword(newPassword);
  if (temporaryPasswordError) {
    res.status(400).json({ success: false, message: temporaryPasswordError });
    return;
  }
  if (req.user?.id === userId) {
    res.status(400).json({ success: false, message: 'กรุณาเปลี่ยนรหัสผ่านของตนเองจากหน้าโปรไฟล์' });
    return;
  }

  try {
    const actingAdmin = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!actingAdmin || !adminPassword || !bcrypt.compareSync(adminPassword, actingAdmin.passwordHash)) {
      res.status(403).json({ success: false, message: 'รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง' });
      return;
    }
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: bcrypt.hashSync(newPassword, 12),
        mustChangePassword: true,
        twoFactorTempCode: null,
        twoFactorExpiresAt: null,
        twoFactorFailedAttempts: 0,
        sessionVersion: { increment: 1 },
      },
    });
    await prisma.passwordResetRequest.updateMany({
      where: { userId, status: 'PENDING' },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedById: req.user!.id },
    });

    await recordAuditLog(
      req.user!.id,
      req.user!.full_name,
      req.user!.role,
      'ADMIN_RESET_PASSWORD',
      'USER',
      String(userId),
      req.ip || '127.0.0.1',
      { target_username: target.username, force_change_on_next_login: true }
    );

    res.json({
      success: true,
      message: `ตั้งรหัสผ่านชั่วคราวให้ ${target.fullName} แล้ว ผู้ใช้ต้องเปลี่ยนรหัสผ่านหลังเข้าสู่ระบบ`,
    });
  } catch (error) {
    console.error('[Admin Reset Password Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการตั้งรหัสผ่านใหม่' });
  }
});

// Change role (Admin only - REQ-0002)
router.patch('/:id/role', authenticateToken, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { role } = req.body;
  const userId = Number(id);
  if (req.user!.id === userId) {
    res.status(400).json({ success: false, message: 'ไม่สามารถเปลี่ยนบทบาทบัญชีของตนเองได้' });
    return;
  }

  if (!role || !Object.values(UserRole).includes(role as UserRole)) {
    res.status(400).json({ success: false, message: 'บทบาทผู้ใช้ไม่ถูกต้อง' });
    return;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: role as UserRole, sessionVersion: { increment: 1 } },
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

  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ success: false, code: 'INVALID_USER_ID', message: 'รหัสผู้ใช้งานไม่ถูกต้อง' });
    return;
  }

  // Prevent deleting self
  if (req.user?.id === userId) {
    res.status(400).json({ success: false, message: 'ไม่สามารถลบบัญชีผู้ใช้ของตนเองได้' });
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!user) return { kind: 'not_found' as const };

      // These relations represent retained workflow, business, or audit history.
      // A deletion is eligible only when none of them still references this user.
      const retainedReferenceChecks = await Promise.all([
        tx.course.count({ where: { instructorId: userId } }),
        tx.exam.count({ where: { createdById: userId } }),
        tx.examStatusHistory.count({ where: { actionById: userId } }),
        tx.envelopeLabel.count({ where: { generatedById: userId } }),
        tx.printRecord.count({ where: { printedById: userId } }),
        tx.packingRecord.count({ where: { packedById: userId } }),
        tx.deliveryRecord.count({ where: { OR: [{ handedOverById: userId }, { receivedById: userId }] } }),
        tx.examSchedule.count({ where: { coordinatorId: userId } }),
        tx.passwordResetRequest.count({ where: { OR: [{ userId }, { resolvedById: userId }] } }),
        tx.auditLog.count({ where: { userId } }),
      ]);

      if (retainedReferenceChecks.some((count) => count > 0)) {
        return { kind: 'retained_history' as const };
      }

      // Notifications are account-owned disposable data (the FK also cascades).
      await tx.notification.deleteMany({ where: { userId } });

      await tx.user.delete({ where: { id: userId } });

      return { kind: 'deleted' as const };
    });

    if (result.kind === 'not_found') {
      res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' });
      return;
    }
    if (result.kind === 'retained_history') {
      res.status(409).json({
        success: false,
        code: 'USER_HAS_RETAINED_HISTORY',
        message: 'ไม่สามารถลบบัญชีนี้ได้ เนื่องจากมีประวัติการใช้งานหรือข้อมูลในกระบวนการสอบที่ต้องเก็บรักษา',
      });
      return;
    }

    await recordAuditLog(
      req.user!.id,
      req.user!.full_name,
      req.user!.role,
      'DELETE_USER',
      'USER',
      id,
      req.ip || '127.0.0.1',
      { permanent_deletion: true }
    );

    res.json({ success: true, message: 'ลบบัญชีถาวรแล้ว' });
  } catch (error) {
    // A concurrent retained record can still win the race after the reference
    // checks. The FK rejects the delete and the transaction rolls back.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      res.status(409).json({
        success: false,
        code: 'USER_HAS_RETAINED_HISTORY',
        message: 'ไม่สามารถลบบัญชีนี้ได้ เนื่องจากมีประวัติการใช้งานหรือข้อมูลในกระบวนการสอบที่ต้องเก็บรักษา',
      });
      return;
    }
    console.error('[Delete User Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบผู้ใช้งาน' });
  }
});

export default router;
