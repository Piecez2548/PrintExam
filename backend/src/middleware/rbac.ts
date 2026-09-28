import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { UserRole } from '../config/constants';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `คุณไม่มีสิทธิ์เข้าถึงฟังก์ชันนี้ (สำหรับบทบาท: ${allowedRoles.join(', ')} เท่านั้น)`,
      });
      return;
    }

    next();
  };
}

/**
 * Explicit alias for endpoints that accept more than one role.
 * Keeping this in one middleware module avoids ad-hoc role checks in routes.
 */
export function requireAnyRole(...allowedRoles: UserRole[]) {
  return requireRole(...allowedRoles);
}
