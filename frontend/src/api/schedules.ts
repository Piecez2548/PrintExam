import { apiClient } from './client';
import { ExamSchedule } from '../types';

export const schedulesApi = {
  getSchedules: async (params?: { course_id?: number; status?: string; exam_date?: string; all?: boolean }): Promise<ExamSchedule[]> => {
    const res = await apiClient.get('/exam-schedules', { params });
    return res.data.data;
  },

  createSchedule: async (data: Partial<ExamSchedule>): Promise<{ success: boolean; message: string; data: ExamSchedule }> => {
    const res = await apiClient.post('/exam-schedules', data);
    return res.data;
  },

  updateSchedule: async (id: number | string, data: Partial<ExamSchedule>): Promise<{ success: boolean; message: string; data: ExamSchedule }> => {
    const res = await apiClient.put(`/exam-schedules/${id}`, data);
    return res.data;
  },

  confirmSchedule: async (id: number | string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.patch(`/exam-schedules/${id}/confirm`);
    return res.data;
  },

  deleteSchedule: async (id: number | string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/exam-schedules/${id}`);
    return res.data;
  },
};
