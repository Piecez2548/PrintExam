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
import { MyCoursesPage } from './pages/instructor/MyCoursesPage';
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
import { useTranslation } from 'react-i18next';

// Role-based root redirect helper
const RootRedirect: React.FC = () => {
  const { t } = useTranslation("common");

  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary text-foreground text-sm">

        {t("กำลังโหลดระบบ...")}
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/reports" replace />;
};

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation("common");

  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary text-foreground text-sm">

        {t("กำลังโหลดข้อมูล...")}
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const RoleRoute: React.FC<{ roles: UserRole[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
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
                <Route path="instructor/dashboard" element={<RoleRoute roles={[UserRole.INSTRUCTOR]}><InstructorDashboard /></RoleRoute>} />
                <Route path="instructor/courses" element={<RoleRoute roles={[UserRole.INSTRUCTOR]}><MyCoursesPage /></RoleRoute>} />
                <Route path="instructor/exams/new" element={<RoleRoute roles={[UserRole.INSTRUCTOR]}><ExamCreatePage /></RoleRoute>} />
                <Route path="instructor/exams/:id" element={<RoleRoute roles={[UserRole.INSTRUCTOR]}><ExamDetailPage /></RoleRoute>} />

                {/* Media/AV Staff Routes */}
                <Route path="av-staff/queue" element={<RoleRoute roles={[UserRole.AV_STAFF]}><AvQueuePage /></RoleRoute>} />
                <Route path="av-staff/exams/:id/review" element={<RoleRoute roles={[UserRole.AV_STAFF]}><ExamReviewPage /></RoleRoute>} />
                <Route path="av-staff/exams/:id/print" element={<RoleRoute roles={[UserRole.AV_STAFF]}><ExamPrintPage /></RoleRoute>} />
                <Route path="av-staff/exams/:id/pack" element={<RoleRoute roles={[UserRole.AV_STAFF]}><ExamPackPage /></RoleRoute>} />

                {/* Exam Coordinator Routes */}
                <Route path="coordinator/courses" element={<RoleRoute roles={[UserRole.COORDINATOR]}><CourseSchedulePage /></RoleRoute>} />
                <Route path="coordinator/receive" element={<RoleRoute roles={[UserRole.COORDINATOR]}><ReceiveExamPage /></RoleRoute>} />

                {/* Admin Routes */}
                <Route path="admin/users" element={<RoleRoute roles={[UserRole.ADMIN]}><UserManagementPage /></RoleRoute>} />
                <Route path="admin/reports" element={<Navigate to="/reports" replace />} />
                <Route path="admin/audit-log" element={<RoleRoute roles={[UserRole.ADMIN]}><AuditLogPage /></RoleRoute>} />

                {/* Shared */}
                <Route path="reports" element={<ReportsPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="notifications" element={<NotificationsPage />} />
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
