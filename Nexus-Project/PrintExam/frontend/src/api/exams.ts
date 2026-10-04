import { API_BASE_URL, apiClient } from './client';
import { Exam } from '../types';

export const examsApi = {
  getExams: async (params?: { status?: string; course_id?: number; instructor_id?: number; search?: string }): Promise<Exam[]> => {
    const res = await apiClient.get('/exams', { params });
    return res.data.data;
  },

  getExamById: async (id: number | string): Promise<Exam> => {
    const res = await apiClient.get(`/exams/${id}`);
    return res.data.data;
  },

  createExam: async (formData: FormData): Promise<{ success: boolean; message: string; data: { id: number; status: string } }> => {
    const res = await apiClient.post('/exams', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  updateExam: async (id: number | string, formData: FormData): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.put(`/exams/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  deleteExam: async (id: number | string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/exams/${id}`);
    return res.data;
  },

  // AV Staff Operations (REQ-0006, REQ-0007, REQ-0009, REQ-0010, REQ-0011)
  validateExam: async (id: number | string, notes?: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post(`/exams/${id}/validate`, { notes });
    return res.data;
  },

  rejectExam: async (id: number | string, reason: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post(`/exams/${id}/reject`, { reason });
    return res.data;
  },

  printExam: async (
    id: number | string,
    data: { printed_copies?: number; paper_type?: string; notes?: string; mark_completed?: boolean }
  ): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post(`/exams/${id}/print`, data);
    return res.data;
  },

  packExam: async (
    id: number | string,
    data: { envelope_count?: number; notes?: string }
  ): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post(`/exams/${id}/pack`, data);
    return res.data;
  },

  getEnvelopeLabelUrl: (id: number | string): string => {
    return `${API_BASE_URL}/exams/${id}/envelope-label`;
  },

  // Delivery (REQ-0012)
  readyForPickup: async (
    id: number | string,
    data?: { pickup_location?: string; notes?: string }
  ): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post(`/exams/${id}/ready-for-pickup`, data || {});
    return res.data;
  },

  deliverExam: async (
    id: number | string,
    data?: { receiver_signature_note?: string; handed_over_by_id?: number; received_by_id?: number }
  ): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post(`/exams/${id}/deliver`, data || {});
    return res.data;
  },
};
