import { Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';
import { AuthRequest } from './auth';

export async function recordAuditLog(
  userId: number | null,
  userName: string | null,
  userRole: string | null,
  action: string,
  entityType: string,
  entityId: string | string[] | null | undefined,
  ipAddress: string,
  details: any
): Promise<void> {
  try {
    const cleanEntityId = entityId
      ? Array.isArray(entityId)
        ? entityId.join(',')
        : String(entityId)
      : null;

    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        userName: userName || 'System/Anonymous',
        userRole: userRole || 'SYSTEM',
        action,
        entityType,
        entityId: cleanEntityId,
        ipAddress,
        detailJson: typeof details === 'string' ? details : JSON.stringify(details),
      },
    });
  } catch (err) {
    console.error('[AuditLog] Error recording log:', err);
  }
}

export function auditMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  // Only log state-mutating HTTP methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '')) {
    const originalSend = res.json;
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';

    res.json = function (body: any): Response {
      // If the operation succeeded, record in audit logs
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const action = `${req.method}_${(req.baseUrl || '').replace('/api/', '').toUpperCase()}`;
        const user = req.user;
        const targetId = req.params?.id || body?.data?.id || null;
        recordAuditLog(
          user ? user.id : null,
          user ? user.full_name : null,
          user ? user.role : null,
          action,
          (req.baseUrl || '').split('/')[2] || 'SYSTEM',
          targetId ? String(targetId) : null,
          ip,
          {
            path: req.originalUrl,
            params: req.params,
            body: req.body ? { ...req.body, password: req.body.password ? '***' : undefined } : null,
            responseSummary: body?.message || 'Success',
          }
        ).catch((err) => console.error('[AuditLog] Middleware async recording error:', err));
      }
      return originalSend.call(this, body);
    };
  }
  next();
}
