import { apiClient } from './client';
import { DashboardSummaryData, AuditLogItem, NotificationItem } from '../types';

export const dashboardApi = {
  getSummary: async (params?: any): Promise<DashboardSummaryData> => {
    const res = await apiClient.get('/dashboard/summary', { params });
    return res.data.data;
  },
};

export const auditApi = {
  getAuditLogs: async (params?: any): Promise<{ logs: AuditLogItem[]; total: number }> => {
    const res = await apiClient.get('/audit-logs', { params });
    return {
      logs: res.data.data,
      total: res.data.pagination?.total || res.data.data.length,
    };
  },
};

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
