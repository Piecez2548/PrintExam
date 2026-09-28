import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { authApi, LoginResponse, Verify2FAResponse } from '../api/auth';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<LoginResponse>;
  verify2FA: (tempToken: string, otpCode: string) => Promise<Verify2FAResponse>;
  quickSwitchRole: (role: UserRole) => Promise<void>;
  logout: () => void;
  // Role helpers
  isInstructor: boolean;
  isAvStaff: boolean;
  isCoordinator: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('print_exam_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('print_exam_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const toast = useToast();

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('print_exam_token');
      if (savedToken) {
        try {
          const res = await authApi.getMe();
          setUser(res.user);
          localStorage.setItem('print_exam_user', JSON.stringify(res.user));
        } catch (err) {
          console.error('Session validation error:', err);
          setUser(null);
          setToken(null);
          localStorage.removeItem('print_exam_token');
          localStorage.removeItem('print_exam_user');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string): Promise<LoginResponse> => {
    return await authApi.login(username, password);
  };

  const verify2FA = async (tempToken: string, otpCode: string): Promise<Verify2FAResponse> => {
    const res = await authApi.verify2FA(tempToken, otpCode);
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('print_exam_token', res.token);
    localStorage.setItem('print_exam_user', JSON.stringify(res.user));
    toast.success('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับ ${res.user.full_name}`);
    return res;
  };

  const quickSwitchRole = async (role: UserRole): Promise<void> => {
    try {
      const res = await authApi.quickLogin(role);
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('print_exam_token', res.token);
      localStorage.setItem('print_exam_user', JSON.stringify(res.user));
      toast.success('สลับบทบาทสำเร็จ', `เปลี่ยนเป็น ${res.user.full_name} (${role})`);
    } catch (err: any) {
      toast.error('สลับบทบาทล้มเหลว', err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('print_exam_token');
    localStorage.removeItem('print_exam_user');
    toast.info('ออกจากระบบเรียบร้อย');
  };

  const isInstructor = user?.role === UserRole.INSTRUCTOR;
  const isAvStaff = user?.role === UserRole.AV_STAFF;
  const isCoordinator = user?.role === UserRole.COORDINATOR;
  const isAdmin = user?.role === UserRole.ADMIN;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        verify2FA,
        quickSwitchRole,
        logout,
        isInstructor,
        isAvStaff,
        isCoordinator,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
