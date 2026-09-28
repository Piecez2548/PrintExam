import { apiClient } from './client';
import { NotificationItem } from '../types';

export const notificationsApi = {
  getNotifications: async (): Promise<{ notifications: NotificationItem[]; unreadCount: number }> => {
    const res = await apiClient.get('/notifications');
    return {
      notifications: res.data.data,
      unreadCount: res.data.unreadCount,
    };
  },

  markRead: async (id: number | string): Promise<{ success: boolean }> => {
    const res = await apiClient.patch(`/notifications/${id}/read`);
    return res.data;
  },

  markAllRead: async (): Promise<{ success: boolean }> => {
    const res = await apiClient.post('/notifications/mark-all-read');
    return res.data;
  },
};
