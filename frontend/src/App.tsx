import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { AppLayout } from './components/layout/AppLayout';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { InstructorDashboard } from './pages/instructor/InstructorDashboard';
import { ExamCreatePage } from './pages/instructor/ExamCreatePage';
import { ExamDetailPage } from './pages/instructor/ExamDetailPage';
import { AvQueuePage } from './pages/av-staff/AvQueuePage';
import { ExamReviewPage } from './pages/av-staff/ExamReviewPage';
import { ExamPrintPage } from './pages/av-staff/ExamPrintPage';
import { ExamPackPage } from './pages/av-staff/ExamPackPage';
import { CourseSchedulePage } from './pages/coordinator/CourseSchedulePage';
import { ReceiveExamPage } from './pages/coordinator/ReceiveExamPage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { AuditLogPage } from './pages/admin/AuditLogPage';
import { NotificationsPage } from './pages/shared/NotificationsPage';
import { ProfilePage } from './pages/shared/ProfilePage';
import { NotFoundPage } from './pages/shared/NotFoundPage';
import { UserRole } from './types';

// Role-based root redirect helper
const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white text-sm">
        กำลังโหลดระบบ...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === UserRole.INSTRUCTOR) return <Navigate to="/instructor/dashboard" replace />;
  if (user.role === UserRole.AV_STAFF) return <Navigate to="/av-staff/queue" replace />;
  if (user.role === UserRole.COORDINATOR) return <Navigate to="/coordinator/courses" replace />;
  if (user.role === UserRole.ADMIN) return <Navigate to="/admin/reports" replace />;
  return <Navigate to="/admin/reports" replace />;
};

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white text-sm">
        กำลังโหลดข้อมูล...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AccessDenied: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-xl mx-auto mt-12 bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900 p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold text-rose-700 dark:text-rose-300">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        บัญชี {user?.username || 'ปัจจุบัน'} ไม่มีสิทธิ์สำหรับทรัพยากรนี้
      </p>
      <a
        href="/"
        className="inline-flex mt-6 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
      >
        กลับหน้าหลักตามบทบาท
      </a>
    </div>
  );
};

const RoleGuard: React.FC<{ allowedRoles: UserRole[]; children: React.ReactNode }> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-[30vh] flex items-center justify-center text-slate-500">กำลังตรวจสอบสิทธิ์...</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return allowedRoles.includes(user.role) ? <>{children}</> : <AccessDenied />;
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <WebSocketProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Login Route with 2FA */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Routes within App Shell */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<RootRedirect />} />

                {/* Instructor Routes */}
                <Route path="instructor/dashboard" element={<RoleGuard allowedRoles={[UserRole.INSTRUCTOR]}><InstructorDashboard /></RoleGuard>} />
                <Route path="instructor/exams/new" element={<RoleGuard allowedRoles={[UserRole.INSTRUCTOR]}><ExamCreatePage /></RoleGuard>} />
                <Route path="instructor/exams/:id" element={<RoleGuard allowedRoles={[UserRole.INSTRUCTOR]}><ExamDetailPage /></RoleGuard>} />

                {/* Media/AV Staff Routes */}
                <Route path="av-staff/queue" element={<RoleGuard allowedRoles={[UserRole.AV_STAFF, UserRole.ADMIN]}><AvQueuePage /></RoleGuard>} />
                <Route path="av-staff/exams/:id/review" element={<RoleGuard allowedRoles={[UserRole.AV_STAFF, UserRole.ADMIN]}><ExamReviewPage /></RoleGuard>} />
                <Route path="av-staff/exams/:id/print" element={<RoleGuard allowedRoles={[UserRole.AV_STAFF, UserRole.ADMIN]}><ExamPrintPage /></RoleGuard>} />
                <Route path="av-staff/exams/:id/pack" element={<RoleGuard allowedRoles={[UserRole.AV_STAFF, UserRole.ADMIN]}><ExamPackPage /></RoleGuard>} />

                {/* Exam Coordinator Routes */}
                <Route path="coordinator/courses" element={<RoleGuard allowedRoles={[UserRole.COORDINATOR, UserRole.ADMIN]}><CourseSchedulePage /></RoleGuard>} />
                <Route path="coordinator/receive" element={<RoleGuard allowedRoles={[UserRole.COORDINATOR, UserRole.ADMIN]}><ReceiveExamPage /></RoleGuard>} />

                {/* Admin Routes */}
                <Route path="admin/users" element={<RoleGuard allowedRoles={[UserRole.ADMIN]}><UserManagementPage /></RoleGuard>} />
                <Route path="admin/reports" element={<RoleGuard allowedRoles={[UserRole.INSTRUCTOR, UserRole.AV_STAFF, UserRole.COORDINATOR, UserRole.ADMIN]}><ReportsPage /></RoleGuard>} />
                <Route path="admin/audit-log" element={<RoleGuard allowedRoles={[UserRole.ADMIN]}><AuditLogPage /></RoleGuard>} />

                {/* Shared */}
                <Route path="profile" element={<RoleGuard allowedRoles={[UserRole.INSTRUCTOR, UserRole.AV_STAFF, UserRole.COORDINATOR, UserRole.ADMIN]}><ProfilePage /></RoleGuard>} />
                <Route path="notifications" element={<RoleGuard allowedRoles={[UserRole.INSTRUCTOR, UserRole.AV_STAFF, UserRole.COORDINATOR, UserRole.ADMIN]}><NotificationsPage /></RoleGuard>} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </WebSocketProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
