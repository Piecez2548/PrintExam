import { apiClient } from './client';
import { Course } from '../types';

export const coursesApi = {
  getCourses: async (params?: { instructor_id?: number; semester?: number; academic_year?: string; search?: string; all?: boolean }): Promise<Course[]> => {
    const res = await apiClient.get('/courses', { params });
    return res.data.data;
  },

  createCourse: async (data: Partial<Course>): Promise<{ success: boolean; message: string; data: Course }> => {
    const res = await apiClient.post('/courses', data);
    return res.data;
  },

  updateCourse: async (id: number | string, data: Partial<Course>): Promise<{ success: boolean; message: string; data: Course }> => {
    const res = await apiClient.put(`/courses/${id}`, data);
    return res.data;
  },

  deleteCourse: async (id: number | string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/courses/${id}`);
    return res.data;
  },
};
