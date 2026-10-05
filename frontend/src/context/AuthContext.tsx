import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { authApi, LoginResponse, Verify2FAResponse } from '../api/auth';
import { useToast } from './ToastContext';
import { useTranslation } from 'react-i18next';
import { localizedApiError } from '../api/localizedError';

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
  const { t } = useTranslation("common");

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
    toast.success(t("เข้าสู่ระบบสำเร็จ"), t("ยินดีต้อนรับ {{v0}}", { v0: res.user.full_name }));
    return res;
  };

  const quickSwitchRole = async (role: UserRole): Promise<void> => {
    try {
      const res = await authApi.quickLogin(role);
      setUser(res.user);
      const roleLabel = t(`role.${role}`, { ns: 'statuses', defaultValue: role });
      toast.success(t("สลับบทบาทสำเร็จ"), t("เปลี่ยนเป็น {{v0}} ({{v1}})", { v0: res.user.full_name, v1: roleLabel }));
    } catch (err: any) {
      toast.error(t("สลับบทบาทล้มเหลว"), localizedApiError(err, t('An unexpected error occurred.')));
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Local sign-out still succeeds if the server session already expired.
    }
    setUser(null);
    toast.info(t("ออกจากระบบเรียบร้อย"));
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
