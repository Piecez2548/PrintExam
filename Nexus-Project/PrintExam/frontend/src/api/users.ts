import { apiClient } from './client';
import { User, UserRole } from '../types';

export const usersApi = {
  getUsers: async (params?: { search?: string; role?: string; status?: string }): Promise<User[]> => {
    const res = await apiClient.get('/users', { params });
    return res.data.data;
  },

  createUser: async (data: any): Promise<{ success: boolean; message: string; data: User }> => {
    const res = await apiClient.post('/users', data);
    return res.data;
  },

  updateUser: async (id: number | string, data: any): Promise<{ success: boolean; message: string; data: User }> => {
    const res = await apiClient.put(`/users/${id}`, data);
    return res.data;
  },

  toggleSuspend: async (id: number | string): Promise<{ success: boolean; message: string; data: { id: number; is_active: boolean } }> => {
    const res = await apiClient.patch(`/users/${id}/suspend`);
    return res.data;
  },

  changeRole: async (id: number | string, role: UserRole): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.patch(`/users/${id}/role`, { role });
    return res.data;
  },

  deleteUser: async (id: number | string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/users/${id}`);
    return res.data;
  },
};
