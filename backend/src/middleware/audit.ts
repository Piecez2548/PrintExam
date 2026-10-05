import { Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';
import { AuthRequest } from './auth';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'temptoken',
  'otp',
  'otpcode',
  'authorization',
  'secret',
  'twofactortempcode',
  'identifier',
  'new_password',
  'current_password',
  'confirm_password',
  'password_confirmation',
]);
const SENSITIVE_KEY_PATTERN = /(password|token|secret|otp|authorization)/i;

/** Recursively redact credentials before request data is persisted in the audit trail. */
function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.has(key.toLowerCase()) || SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : redactSensitive(item),
    ])
  );
}

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
      if (res.statusCode >= 200 && res.statusCode < 300 && !req.auditHandledAtomically) {
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
            body: req.body ? redactSensitive(req.body) : null,
            responseSummary: body?.message || 'Success',
          }
        ).catch((err) => console.error('[AuditLog] Middleware async recording error:', err));
      }
      return originalSend.call(this, body);
    };
  }
  next();
}
