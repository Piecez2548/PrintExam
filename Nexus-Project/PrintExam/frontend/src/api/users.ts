import { apiClient } from './client';
import { User, UserRole } from '../types';

export interface PasswordResetRequestItem {
  id: number;
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  requested_at: string;
}

export const usersApi = {
  getPasswordResetRequests: async (): Promise<PasswordResetRequestItem[]> => {
    const res = await apiClient.get('/users/password-reset-requests');
    return res.data.data;
  },
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

  resetPassword: async (id: number | string, newPassword: string, adminPassword: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.patch(`/users/${id}/reset-password`, { new_password: newPassword, admin_password: adminPassword });
    return res.data;
  },

  deleteUser: async (id: number | string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/users/${id}`);
    return res.data;
  },
};
