import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { authApi, LoginResponse, Verify2FAResponse } from '../api/auth';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<LoginResponse>;
  verify2FA: (tempToken: string, otpCode: string) => Promise<Verify2FAResponse>;
  quickSwitchRole: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  updateCurrentUser: (user: User) => void;
  // Role helpers
  isInstructor: boolean;
  isAvStaff: boolean;
  isCoordinator: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    const initAuth = async () => {
      try {
        const res = await authApi.getMe();
        if (!cancelled) setUser(res.user);
      } catch {
        if (!cancelled) setUser(null);
      }
      if (!cancelled) setIsLoading(false);
    };

    void initAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (username: string, password: string): Promise<LoginResponse> => {
    return await authApi.login(username, password);
  };

  const verify2FA = async (tempToken: string, otpCode: string): Promise<Verify2FAResponse> => {
    const res = await authApi.verify2FA(tempToken, otpCode);
    setUser(res.user);
    toast.success('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับ ${res.user.full_name}`);
    return res;
  };

  const quickSwitchRole = async (role: UserRole): Promise<void> => {
    try {
      const res = await authApi.quickLogin(role);
      setUser(res.user);
      toast.success('สลับบทบาทสำเร็จ', `เปลี่ยนเป็น ${res.user.full_name} (${role})`);
    } catch (err: any) {
      toast.error('สลับบทบาทล้มเหลว', err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Local sign-out still succeeds if the server session already expired.
    }
    setUser(null);
    toast.info('ออกจากระบบเรียบร้อย');
  };

  const updateCurrentUser = (nextUser: User) => {
    setUser(nextUser);
  };

  const isInstructor = user?.role === UserRole.INSTRUCTOR;
  const isAvStaff = user?.role === UserRole.AV_STAFF;
  const isCoordinator = user?.role === UserRole.COORDINATOR;
  const isAdmin = user?.role === UserRole.ADMIN;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        verify2FA,
        quickSwitchRole,
        logout,
        updateCurrentUser,
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
