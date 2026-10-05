import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/constants';
import { prisma } from '../database/prisma';
import { UserRole } from '../../generated/prisma';
import { AUTH_COOKIE_NAME, readCookie } from '../services/authTokenService';

export interface UserDTO {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  department?: string | null;
  phone?: string | null;
  office_room?: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_at?: string;
}

export interface AuthRequest extends Request {
  user?: UserDTO;
  auditHandledAtomically?: boolean;
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.split(' ')[1];
  const token = bearerToken || readCookie(req.headers.cookie, AUTH_COOKIE_NAME);

  if (!token) {
    res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ (Authentication required)' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as {
      id: number;
      username: string;
      pending2FA?: boolean;
      sessionVersion?: number;
    };
    if (decoded.pending2FA) {
      res.status(403).json({ success: false, message: 'กรุณายืนยัน OTP ให้เสร็จก่อนใช้งานระบบ' });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        department: true,
        phone: true,
        officeRoom: true,
        isActive: true,
        mustChangePassword: true,
        sessionVersion: true,
        deletedAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'ไม่พบบัญชีผู้ใช้ในระบบ' });
      return;
    }

    if (user.deletedAt) {
      res.status(403).json({ success: false, message: 'บัญชีผู้ใช้นี้ถูกลบแล้ว' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'บัญชีผู้ใช้นี้ถูกระงับการใช้งานชั่วคราว' });
      return;
    }

    if (decoded.sessionVersion !== user.sessionVersion) {
      res.status(401).json({ success: false, message: 'เซสชันนี้ถูกยกเลิกแล้ว กรุณาเข้าสู่ระบบใหม่' });
      return;
    }

    req.user = {
      id: user.id,
      username: user.username,
      full_name: user.fullName,
      email: user.email,
      role: user.role,
      department: user.department,
      phone: user.phone,
      office_room: user.officeRoom,
      is_active: user.isActive,
      must_change_password: user.mustChangePassword,
      created_at: user.createdAt.toISOString(),
    };

    next();
  } catch (err) {
    res.status(403).json({ success: false, message: 'Token ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่' });
  }
}
