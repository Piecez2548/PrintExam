import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { prisma } from '../database/prisma';
import { JWT_SECRET, TWO_FACTOR_EXPIRY_MINUTES } from '../config/constants';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { recordAuditLog } from '../middleware/audit';
import { UserRole } from '../../generated/prisma';
import { notifyRole } from '../services/notificationService';
import { deliverOtp } from '../services/otpDeliveryService';
import { clearAuthCookie, setAuthCookie, signAccessToken } from '../services/authTokenService';

const router = Router();

/** H-2: Rate limiting สำหรับ login (10 ครั้ง / 15 นาที) */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'ลองเข้าสู่ระบบมากเกินไป กรุณารอ 15 นาที' },
});

/** H-2: Rate limiting สำหรับ OTP (5 ครั้ง / 3 นาที) */
const otpLimiter = rateLimit({
  windowMs: 3 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'ลองรหัส OTP มากเกินไป กรุณาเข้าสู่ระบบใหม่' },
});

/** จำกัดคำขอช่วยเหลือรหัสผ่าน เพื่อลดการส่งแจ้งเตือนรบกวนผู้ดูแลระบบ */
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'ส่งคำขอหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' },
});

/** C-2: จำนวนครั้งสูงสุดที่อนุญาตให้ลอง OTP ผิดก่อนล้างโค้ด */
const MAX_OTP_ATTEMPTS = 5;

/** ปกปิดปลายทาง OTP เพื่อไม่เปิดเผยข้อมูลส่วนบุคคลเต็มรูปแบบบนหน้าเว็บ */
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return 'อีเมลที่ลงทะเบียนไว้';
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(3, name.length - 1))}@${domain}`;
}

function maskPhone(phone?: string | null): string {
  if (!phone) return 'เบอร์โทรศัพท์ที่ลงทะเบียนไว้';
  const digits = phone.replace(/\D/g, '');
  return `***-***-${digits.slice(-4).padStart(4, '*')}`;
}

// ส่งคำขอให้ผู้ดูแลระบบช่วยตั้งรหัสผ่านชั่วคราว โดยตอบแบบเดียวกันเสมอ
// เพื่อไม่เปิดเผยว่า username หรือ email ใดมีอยู่จริงในระบบ
router.post('/forgot-password', forgotPasswordLimiter, async (req: Request, res: Response): Promise<void> => {
  const identifier = String(req.body?.identifier || '').trim();
  if (!identifier) {
    res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้หรืออีเมล' });
    return;
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: identifier, mode: 'insensitive' } },
          { email: { equals: identifier.toLowerCase(), mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true, fullName: true, email: true, role: true },
    });

    if (user) {
      const previous = await prisma.passwordResetRequest.findUnique({ where: { userId: user.id } });
      const shouldNotify = !previous || previous.status !== 'PENDING' || Date.now() - previous.requestedAt.getTime() > 15 * 60 * 1000;
      await prisma.passwordResetRequest.upsert({
        where: { userId: user.id },
        update: { status: 'PENDING', requestedAt: new Date(), resolvedAt: null, resolvedById: null },
        create: { userId: user.id },
      });
      if (shouldNotify) {
        await notifyRole(
          UserRole.ADMIN,
          'PASSWORD_RESET_REQUEST',
          `คำขอช่วยเหลือรหัสผ่าน: ${user.username}`,
          `${user.fullName} (${user.role}) ขอให้ผู้ดูแลระบบตั้งรหัสผ่านชั่วคราว กรุณาตรวจสอบตัวตนก่อนดำเนินการ`,
          '/admin/users'
        );
      }
      await recordAuditLog(null, null, null, 'REQUEST_PASSWORD_RESET', 'USER', String(user.id), req.ip || '127.0.0.1', {
        channel: 'login_help',
      });
    }

    res.json({
      success: true,
      message: 'หากข้อมูลตรงกับบัญชีในระบบ คำขอจะถูกส่งให้ผู้ดูแลระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อยืนยันตัวตนและรับรหัสผ่านชั่วคราว',
    });
  } catch (error) {
    console.error('[Forgot Password Error]', error);
    res.status(500).json({ success: false, message: 'ไม่สามารถส่งคำขอได้ กรุณาติดต่อผู้ดูแลระบบโดยตรง' });
  }
});

// -----------------------------------------------------------------------------
// ขั้นที่ 1: ตรวจ username/password แล้วสร้าง OTP อายุ 3 นาที (REQ-0001)
// -----------------------------------------------------------------------------
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ success: false, message: 'กรุณากรอก Username และ Password' });
    return;
  }

  try {
    const user = await prisma.user.findFirst({
      where: { username: { equals: String(username).trim(), mode: 'insensitive' } },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }

    const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' });
      return;
    }

    // C-2: Generate 6-digit OTP using cryptographically secure random
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = bcrypt.hashSync(otpCode, 10);
    const expiresAt = new Date(Date.now() + TWO_FACTOR_EXPIRY_MINUTES * 60 * 1000);
    const delivery = await deliverOtp({
      email: user.email,
      fullName: user.fullName,
      otpCode,
      expiresMinutes: TWO_FACTOR_EXPIRY_MINUTES,
    });
    const deliveryHint = delivery.channel === 'demo-log'
      ? 'Render Logs (โหมดสาธิต)'
      : user.email ? maskEmail(user.email) : maskPhone(user.phone);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorTempCode: otpHash,
        twoFactorExpiresAt: expiresAt,
        twoFactorFailedAttempts: 0,
      },
    });

    // Temporary token to identify session during 2FA step
    const tempToken = jwt.sign(
      { id: user.id, username: user.username, pending2FA: true },
      JWT_SECRET,
      { expiresIn: '5m', algorithm: 'HS256' }
    );

    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    await recordAuditLog(user.id, user.fullName, user.role, 'LOGIN_PASSWORD_SUCCESS', 'AUTH', user.id.toString(), ip, {
      message: 'รหัสผ่านถูกต้อง รอการยืนยัน 2FA (OTP 3 นาที)',
    });

    // H-4: ไม่ส่งข้อมูล user กลับมาก่อนยืนยัน 2FA เพื่อป้องกัน user enumeration
    res.json({
      success: true,
      message: delivery.channel === 'demo-log'
        ? 'สร้างรหัส OTP สำหรับการสาธิตแล้ว กรุณาดูรหัสล่าสุดใน Render Logs และกรอกภายใน 3 นาที'
        : `ส่งรหัส OTP ไปยัง ${deliveryHint} แล้ว กรุณากรอกภายใน 3 นาที`,
      requires2FA: true,
      tempToken,
      expiresAt: expiresAt.toISOString(),
      deliveryHint,
    });
  } catch (error) {
    console.error('[Auth Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
  }
});

// -----------------------------------------------------------------------------
// ขั้นที่ 2: ตรวจ OTP แล้วออก JWT สำหรับใช้งาน API (REQ-0001, NFR-5)
// -----------------------------------------------------------------------------
router.post('/verify-2fa', otpLimiter, async (req: Request, res: Response): Promise<void> => {
  const { tempToken, otpCode } = req.body;

  if (!tempToken || !otpCode) {
    res.status(400).json({ success: false, message: 'กรุณาระบุรหัส OTP 6 หลัก' });
    return;
  }

  if (!/^\d{6}$/.test(String(otpCode))) {
    res.status(400).json({ success: false, message: 'รหัส OTP ต้องเป็นตัวเลข 6 หลัก' });
    return;
  }

  try {
    const decoded = jwt.verify(tempToken, JWT_SECRET, { algorithms: ['HS256'] }) as { id: number; pending2FA: boolean };
    if (decoded.pending2FA !== true) {
      res.status(400).json({ success: false, message: 'Token นี้ไม่ใช่เซสชันสำหรับยืนยัน 2FA' });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้งาน' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน' });
      return;
    }

    if (!user.twoFactorExpiresAt || new Date(user.twoFactorExpiresAt) < new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorTempCode: null, twoFactorExpiresAt: null, twoFactorFailedAttempts: 0 },
      });
      res.status(400).json({
        success: false,
        message: 'รหัส 2FA หมดอายุแล้ว (เกิน 3 นาที) กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
        isExpired: true,
      });
      return;
    }

    // C-2: Compare OTP using bcrypt (hashed storage) instead of plain text
    if (!user.twoFactorTempCode || !bcrypt.compareSync(otpCode, user.twoFactorTempCode)) {
      const attempts = user.twoFactorFailedAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: attempts >= MAX_OTP_ATTEMPTS
          ? { twoFactorTempCode: null, twoFactorExpiresAt: null, twoFactorFailedAttempts: 0 }
          : { twoFactorFailedAttempts: attempts },
      });
      if (attempts >= MAX_OTP_ATTEMPTS) {
        res.status(429).json({ success: false, message: 'กรอกรหัส OTP ผิดครบ 5 ครั้ง กรุณาเข้าสู่ระบบใหม่' });
        return;
      }
      res.status(400).json({ success: false, message: 'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' });
      return;
    }

    // Clear 2FA temp code
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorTempCode: null,
        twoFactorExpiresAt: null,
        twoFactorFailedAttempts: 0,
      },
    });

    // Generate full access token
    const token = signAccessToken({
      id: user.id,
      username: user.username,
      role: user.role,
      sessionVersion: user.sessionVersion,
    });
    setAuthCookie(res, token);

    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    await recordAuditLog(user.id, user.fullName, user.role, 'LOGIN_2FA_SUCCESS', 'AUTH', user.id.toString(), ip, {
      message: 'เข้าสู่ระบบสำเร็จผ่าน 2FA',
    });

    res.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      user: {
        id: user.id,
        username: user.username,
        full_name: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department,
        phone: user.phone,
        office_room: user.officeRoom,
        must_change_password: user.mustChangePassword,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: 'เซสชัน 2FA หมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง' });
  }
});

// เครื่องมือทดสอบ: สลับบทบาทโดยไม่ผ่าน OTP ใช้เฉพาะการสาธิตภายใน
router.post('/quick-login', async (req: Request, res: Response): Promise<void> => {
  // ปิดช่องทางข้ามรหัสผ่านเป็นค่าเริ่มต้น และห้ามเปิดเด็ดขาดใน production
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEMO_QUICK_LOGIN !== 'true') {
    res.status(404).json({ success: false, message: 'ไม่พบ endpoint นี้' });
    return;
  }

  const remoteAddress = req.socket.remoteAddress || '';
  const isLoopback = remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1';
  if (!isLoopback) {
    res.status(404).json({ success: false, message: 'ไม่พบ endpoint นี้' });
    return;
  }

  const { role } = req.body;
  if (!role) {
    res.status(400).json({ success: false, message: 'กรุณาระบุ role ที่ต้องการสลับ' });
    return;
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        role: role as UserRole,
        isActive: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: `ไม่พบบัญชีผู้ใช้ที่มีบทบาท ${role}` });
      return;
    }

    const token = signAccessToken({
      id: user.id,
      username: user.username,
      role: user.role,
      sessionVersion: user.sessionVersion,
    });
    setAuthCookie(res, token);

    res.json({
      success: true,
      message: `สลับบทบาทเป็น ${user.fullName} (${user.role}) สำเร็จ`,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department,
        phone: user.phone,
        office_room: user.officeRoom,
        must_change_password: user.mustChangePassword,
      },
    });
  } catch (error) {
    console.error('[QuickLogin Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสลับบทบาท' });
  }
});

router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { sessionVersion: { increment: 1 }, twoFactorTempCode: null, twoFactorExpiresAt: null, twoFactorFailedAttempts: 0 },
  });
  clearAuthCookie(res);
  res.json({ success: true, message: 'ออกจากระบบเรียบร้อยแล้ว' });
});

// คืนข้อมูลผู้ใช้จาก JWT ปัจจุบันสำหรับกู้ session หลัง refresh หน้าเว็บ
router.get('/me', authenticateToken, (req: AuthRequest, res: Response): void => {
  res.json({
    success: true,
    user: req.user,
  });
});

export default router;
