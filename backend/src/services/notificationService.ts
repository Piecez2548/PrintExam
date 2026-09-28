import { prisma } from '../database/prisma';
import { broadcastEvent } from './wsService';
import { UserRole } from '../../generated/prisma';

export interface NotificationResult {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  is_read: boolean | number;
  created_at: string;
}

export async function createNotification(
  userId: number,
  type: string,
  title: string,
  message: string,
  link?: string
): Promise<NotificationResult> {
  const notif = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      link: link || null,
      isRead: false,
    },
  });

  const formatted: NotificationResult = {
    id: notif.id,
    user_id: notif.userId,
    type: notif.type,
    title: notif.title,
    message: notif.message,
    link: notif.link,
    is_read: notif.isRead,
    created_at: notif.createdAt.toISOString(),
  };

  // Broadcast in real-time via WebSocket directly to target user
  broadcastEvent('NEW_NOTIFICATION', formatted, [userId]);

  return formatted;
}

export async function notifyRole(
  role: UserRole | string,
  type: string,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      role: role as UserRole,
      isActive: true,
    },
    select: { id: true },
  });

  for (const u of users) {
    await createNotification(u.id, type, title, message, link);
  }
}
