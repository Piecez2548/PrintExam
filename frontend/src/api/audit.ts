import { apiClient } from './client';
import { AuditLogItem } from '../types';

export const auditApi = {
  getAuditLogs: async (params?: any): Promise<{ logs: AuditLogItem[]; total: number }> => {
    const res = await apiClient.get('/audit-logs', { params });
    return {
      logs: res.data.data,
      total: res.data.pagination?.total || res.data.data.length,
    };
  },
};
