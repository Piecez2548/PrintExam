import { apiClient } from './client';
import { User, UserRole } from '../types';

export interface LoginResponse {
  success: boolean;
  message: string;
  requires2FA: boolean;
  tempToken: string;
  expiresAt: string;
  deliveryHint: string;
}

export interface Verify2FAResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const res = await apiClient.post<LoginResponse>('/auth/login', { username, password });
    return res.data;
  },

  verify2FA: async (tempToken: string, otpCode: string): Promise<Verify2FAResponse> => {
    const res = await apiClient.post<Verify2FAResponse>('/auth/verify-2fa', { tempToken, otpCode });
    return res.data;
  },

  quickLogin: async (role: UserRole): Promise<Verify2FAResponse> => {
    const res = await apiClient.post<Verify2FAResponse>('/auth/quick-login', { role });
    return res.data;
  },

  getMe: async (): Promise<{ success: boolean; user: User }> => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },
};
