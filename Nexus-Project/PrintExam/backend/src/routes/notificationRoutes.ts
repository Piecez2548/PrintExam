import { Router, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Get notifications for current user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({
        where: {
          userId: user.id,
          isRead: false,
        },
      }),
    ]);

    const formattedNotifications = notifications.map((n) => ({
      id: n.id,
      user_id: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link,
      is_read: n.isRead ? 1 : 0,
      created_at: n.createdAt.toISOString(),
    }));

    res.json({
      success: true,
      data: formattedNotifications,
      unreadCount,
    });
  } catch (error) {
    console.error('[Notification List Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการแจ้งเตือน' });
  }
});

// Mark single notification as read
router.patch('/:id/read', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user!;
  const notifId = Number(id);

  try {
    await prisma.notification.updateMany({
      where: {
        id: notifId,
        userId: user.id,
      },
      data: {
        isRead: true,
      },
    });

    res.json({ success: true, message: 'ทำเครื่องหมายว่าอ่านแล้ว' });
  } catch (error) {
    console.error('[Mark Read Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตการแจ้งเตือน' });
  }
});

// Mark all as read
router.post('/mark-all-read', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;

  try {
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    res.json({ success: true, message: 'ทำเครื่องหมายว่าอ่านแล้วทั้งหมด' });
  } catch (error) {
    console.error('[Mark All Read Error]', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตการแจ้งเตือน' });
  }
});

export default router;
