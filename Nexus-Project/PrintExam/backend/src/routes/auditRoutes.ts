import { Router, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { UserRole, Prisma } from '../../generated/prisma';

const router = Router();

// Get audit logs (Admin only)
router.get('/', authenticateToken, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  const { action, entity_type, user_id, start_date, end_date, search, limit, offset } = req.query;

  try {
    const where: Prisma.AuditLogWhereInput = {};

    if (action) {
      where.action = String(action);
    }

    if (entity_type) {
      where.entityType = String(entity_type);
    }

    if (user_id) {
      where.userId = Number(user_id);
    }

    if (start_date || end_date) {
      where.createdAt = {};
      if (start_date) {
        where.createdAt.gte = new Date(String(start_date));
      }
      if (end_date) {
        where.createdAt.lte = new Date(String(end_date));
      }
    }

    if (search) {
      const s = String(search);
      where.OR = [
        { userName: { contains: s, mode: 'insensitive' } },
        { action: { contains: s, mode: 'insensitive' } },
        { detailJson: { contains: s, mode: 'insensitive' } },
        { entityId: { contains: s, mode: 'insensitive' } },
      ];
    }

    const pageLimit = Math.min(Number(limit || 100), 500);
    const pageOffset = Number(offset || 0);

    const [logs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageLimit,
        skip: pageOffset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const formattedLogs = logs.map((l) => ({
      id: l.id,
      user_id: l.userId,
      user_name: l.userName,
      user_role: l.userRole,
      action: l.action,
      entity_type: l.entityType,
      entity_id: l.entityId,
      ip_address: l.ipAddress,
      detail_json: l.detailJson,
      created_at: l.createdAt.toISOString(),
    }));

    res.json({
      success: true,
      data: formattedLogs,
      pagination: {
        total: totalCount,
        limit: pageLimit,
        offset: pageOffset,
      },
    });
  } catch (error) {
    console.error('[Audit Logs Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติการใช้งาน' });
  }
});

export default router;
