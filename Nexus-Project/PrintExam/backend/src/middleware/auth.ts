import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/constants';
import { prisma } from '../database/prisma';
import { UserRole } from '../../generated/prisma';

export interface UserDTO {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  department?: string | null;
  phone?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface AuthRequest extends Request {
  user?: UserDTO;
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ (Authentication required)' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string };
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
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'ไม่พบบัญชีผู้ใช้ในระบบ' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'บัญชีผู้ใช้นี้ถูกระงับการใช้งานชั่วคราว' });
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
      is_active: user.isActive,
      created_at: user.createdAt.toISOString(),
    };

    next();
  } catch (err) {
    res.status(403).json({ success: false, message: 'Token ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่' });
  }
}
