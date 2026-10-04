import { apiClient } from './client';
import { User } from '../types';

export interface ProfileUpdatePayload {
  username: string;
  full_name: string;
  email: string;
  department: string;
  phone: string;
  office_room: string;
  current_password?: string;
  new_password?: string;
}

export const profileApi = {
  update: async (data: ProfileUpdatePayload): Promise<{ success: boolean; message: string; data: User }> => {
    const response = await apiClient.put('/users/me/profile', data);
    return response.data;
  },
};
