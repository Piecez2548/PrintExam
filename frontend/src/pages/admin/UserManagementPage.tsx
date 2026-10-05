import React, { useState, useEffect } from 'react';
import { PasswordResetRequestItem, usersApi } from '../../api/users';
import { User, UserRole } from '../../types';
import { RoleBadge } from '../../components/common/RoleBadge';
import { Modal } from '../../components/common/Modal';
import { UserActionsMenu, type UserAction } from '../../components/common/UserActionsMenu';
import { useToast } from '../../context/ToastContext';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Trash2,
  CheckCircle2,
  XCircle,
  KeyRound,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { localizedApiError } from '../../api/localizedError';
import i18n from '../../i18n';

export const UserManagementPage: React.FC = () => {
  const { t } = useTranslation("admin");

  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [openActionsUserId, setOpenActionsUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [passwordResetRequests, setPasswordResetRequests] = useState<PasswordResetRequestItem[]>([]);

  // Add/Edit User Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.INSTRUCTOR);
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Admin temporary-password reset
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [confirmTemporaryPassword, setConfirmTemporaryPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const [data, resetRequests] = await Promise.all([
        usersApi.getUsers({
          search: searchQuery || undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
        }),
        usersApi.getPasswordResetRequests(),
      ]);
      setUsers(data);
      setPasswordResetRequests(resetRequests);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [searchQuery, roleFilter, statusFilter]);

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setFullName('');
    setEmail('');
    setRole(UserRole.INSTRUCTOR);
    setDepartment('');
    setPhone('');
    setEditingUserId(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !fullName || !email) {
      toast.warning(t("กรุณากรอกข้อมูลให้ครบถ้วน"));
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingUserId) {
        await usersApi.updateUser(editingUserId, {
          full_name: fullName,
          email,
          role,
          department,
          phone,
        });
        toast.success(t("อัปเดตข้อมูลผู้ใช้งานสำเร็จ"));
      } else {
        await usersApi.createUser({
          username,
          password,
          full_name: fullName,
          email,
          role,
          department,
          phone,
        });
        toast.success(t("สร้างบัญชีผู้ใช้ใหม่เรียบร้อยแล้ว"));
      }
      setIsModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      toast.error(t("ไม่สามารถบันทึกได้"), localizedApiError(err, t('An unexpected error occurred.')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSuspend = async (user: User) => {
    try {
      const res = await usersApi.toggleSuspend(user.id);
      toast.success(t(user.is_active ? 'Account suspended.' : 'Account enabled.'));
      fetchUsers();
    } catch (err: any) {
      toast.error(t("เกิดข้อผิดพลาด"), localizedApiError(err, t('An unexpected error occurred.')));
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await usersApi.deleteUser(userToDelete.id);
      toast.success(t('Account deactivated.'));
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(t("ไม่สามารถปิดใช้งานบัญชีได้"), localizedApiError(err, t('An unexpected error occurred.')));
    } finally {
      setIsDeleting(false);
    }
  };

  const generateTemporaryPassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const values = new Uint32Array(12);
    window.crypto.getRandomValues(values);
    const generated = `Tmp!7${Array.from(values, (value) => alphabet[value % alphabet.length]).join('')}`;
    setTemporaryPassword(generated);
    setConfirmTemporaryPassword(generated);
    setShowTemporaryPassword(true);
  };

  const openResetPasswordModal = (target: User) => {
    setResetPasswordUser(target);
    setTemporaryPassword('');
    setConfirmTemporaryPassword('');
    setAdminPassword('');
    setShowTemporaryPassword(false);
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetPasswordUser) return;
    if (temporaryPassword.length < 12) {
      toast.warning(t("รหัสผ่านต้องยาวอย่างน้อย 12 ตัว และมีตัวพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และอักขระพิเศษ"));
      return;
    }
    if (temporaryPassword !== confirmTemporaryPassword) {
      toast.warning(t("รหัสผ่านชั่วคราวและการยืนยันไม่ตรงกัน"));
      return;
    }
    try {
      setIsResettingPassword(true);
      const result = await usersApi.resetPassword(resetPasswordUser.id, temporaryPassword, adminPassword);
      toast.success(t("ตั้งรหัสผ่านชั่วคราวแล้ว"));
      setResetPasswordUser(null);
      setTemporaryPassword('');
      setConfirmTemporaryPassword('');
      setAdminPassword('');
      fetchUsers();
    } catch (error: any) {
      toast.error(t("ตั้งรหัสผ่านไม่สำเร็จ"), localizedApiError(error, t('An unexpected error occurred.')));
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-purple-600" />
            <span>{t("จัดการผู้ใช้งานและกำหนดสิทธิ์")}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">

            {t("เพิ่ม แก้ไข ปิดใช้งาน และกำหนดบทบาทผู้ใช้งาน โดยเก็บประวัติการทำงานไว้")}
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/25 transition-all"
        >
          <UserPlus className="w-4 h-4" />

          {t("เพิ่มผู้ใช้งานใหม่")}
        </button>
      </div>

      {passwordResetRequests.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
            <KeyRound className="h-5 w-5" />  {t("คำขอลืมรหัสผ่านที่รอดำเนินการ (")}{passwordResetRequests.length})
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {passwordResetRequests.map((request) => {
              const target = users.find((item) => item.id === request.user_id);
              return (
                <div key={request.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3 text-xs dark:border-amber-900 dark:bg-slate-900">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{request.full_name} ({request.username})</div>
                    <div className="mt-1 text-slate-500 dark:text-slate-400">{t("ขอเมื่อ")} {new Date(request.requested_at).toLocaleString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'th-TH')}</div>
                  </div>
                  <button
                    type="button"
                    disabled={!target}
                    onClick={() => target && openResetPasswordModal(target)}
                    className="shrink-0 rounded-lg bg-amber-600 px-3 py-2 font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                  >{t("ตั้งรหัสชั่วคราว")}</button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t("ค้นหาชื่อ, Username, อีเมล หรือสังกัด...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
          >
            <option value="">{t("ทุกบทบาท (All Roles)")}</option>
            <option value={UserRole.INSTRUCTOR}>{t("อาจารย์ผู้สอน")}</option>
            <option value={UserRole.AV_STAFF}>{t("เจ้าหน้าที่หน่วยโสต")}</option>
            <option value={UserRole.COORDINATOR}>{t("จนท.ดำเนินการสอบ")}</option>
            <option value={UserRole.ADMIN}>{t("ผู้ดูแลระบบ")}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
          >
            <option value="">{t("ทุกสถานะ")}</option>
            <option value="active">{t("เปิดใช้งาน (Active)")}</option>
            <option value="0">{t("ระงับใช้งาน (Suspended)")}</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">{t("ชื่อ-สกุล & Username")}</th>
                <th className="py-3.5 px-4">{t("บทบาท (Role)")}</th>
                <th className="py-3.5 px-4">{t("อีเมล & เบอร์โทร")}</th>
                <th className="py-3.5 px-4">{t("สังกัด / ภาควิชา")}</th>
                <th className="py-3.5 px-4">{t("สถานะ")}</th>
                <th className="py-3.5 px-4 text-right">{t("การจัดการ")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">

                    {t("กำลังโหลดข้อมูลผู้ใช้...")}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">

                    {t("ไม่พบข้อมูลผู้ใช้งาน")}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {u.full_name}
                      </div>
                      <div className="text-[11px] text-slate-400">{t('Username:')} {u.username}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{u.email}</div>
                      <div className="text-[11px] text-slate-400">{u.phone || '-'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {u.department || '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold text-[11px]">
                          <CheckCircle2 className="w-3 h-3" />  {t("เปิดใช้งาน")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-semibold text-[11px]">
                          <XCircle className="w-3 h-3" />  {t("ระงับการใช้งาน")}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <UserActionsMenu
                        isOpen={openActionsUserId === u.id}
                        isActive={u.is_active}
                        onOpenChange={(open) => setOpenActionsUserId(open ? u.id : null)}
                        onSelect={(action: UserAction) => {
                          if (action === 'edit') {
                            setEditingUserId(u.id);
                            setUsername(u.username);
                            setFullName(u.full_name);
                            setEmail(u.email);
                            setRole(u.role);
                            setDepartment(u.department || '');
                            setPhone(u.phone || '');
                            setIsModalOpen(true);
                          } else if (action === 'resetPassword') {
                            openResetPasswordModal(u);
                          } else if (action === 'toggleStatus') {
                            handleToggleSuspend(u);
                          } else {
                            setUserToDelete(u);
                            setIsDeleteModalOpen(true);
                          }
                        }}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUserId ? t("แก้ไขข้อมูลผู้ใช้งาน") : t("เพิ่มผู้ใช้งานใหม่")}
      >
        <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
          {!editingUserId && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">

                  {t("ชื่อผู้ใช้ (Username) *")}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder={t("เช่น somchai.j")}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">

                  {t("รหัสผ่านเริ่มต้น (Default Password) *")}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  placeholder={t("12+ ตัว: A-Z, a-z, 0-9 และอักขระพิเศษ")}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">

              {t("ชื่อ-นามสกุล (Full Name) *")}
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder={t("เช่น รศ.ดร.สมชาย ใจดี")}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">

                {t("อีเมล (Email) *")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="somchai@university.ac.th"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">

                {t("เบอร์โทรศัพท์")}
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="081-234-5678"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">

                {t("บทบาทในระบบ (Role) *")}
              </label>
              <select
                value={role}
                onChange={(e: any) => setRole(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
              >
                <option value={UserRole.INSTRUCTOR}>{t("อาจารย์ผู้สอน (Instructor)")}</option>
                <option value={UserRole.AV_STAFF}>{t("เจ้าหน้าที่หน่วยโสต (AV Staff)")}</option>
                <option value={UserRole.COORDINATOR}>{t("จนท.ดำเนินการสอบ (Coordinator)")}</option>
                <option value={UserRole.ADMIN}>{t("ผู้ดูแลระบบ (Admin)")}</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">

                {t("สังกัด / คณะ / ภาควิชา")}
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder={t("เช่น วิศวกรรมคอมพิวเตอร์")}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 dark:text-slate-300 font-semibold"
            >

              {t("ยกเลิก")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? t("กำลังบันทึก...") : t("บันทึกข้อมูล")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Admin password reset modal */}
      <Modal
        isOpen={Boolean(resetPasswordUser)}
        onClose={() => setResetPasswordUser(null)}
        title={t("ตั้งรหัสผ่านชั่วคราว")}
        maxWidth="md"
      >
        {resetPasswordUser && (
          <form onSubmit={handleResetPassword} className="space-y-4 text-sm">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="font-bold">{resetPasswordUser.full_name}</div>
              <div className="mt-1 text-xs">{t('Username:')} {resetPasswordUser.username}</div>
              <p className="mt-2 text-xs">{t("โปรดตรวจสอบตัวตนของผู้ใช้ก่อนตั้งรหัสใหม่ และส่งรหัสผ่านชั่วคราวผ่านช่องทางที่ปลอดภัย ผู้ใช้จะถูกบังคับให้เปลี่ยนรหัสหลังเข้าสู่ระบบ")}</p>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="font-semibold text-slate-700 dark:text-slate-200">{t("รหัสผ่านชั่วคราว")}</label>
                <button type="button" onClick={generateTemporaryPassword} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                  <RefreshCw className="h-3.5 w-3.5" />  {t("สร้างรหัสให้อัตโนมัติ")}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showTemporaryPassword ? 'text' : 'password'}
                  value={temporaryPassword}
                  onChange={(event) => setTemporaryPassword(event.target.value)}
                  minLength={12}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-20 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
                  placeholder={t("12+ ตัว: A-Z, a-z, 0-9 และอักขระพิเศษ")}
                />
                <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
                  <button type="button" onClick={() => setShowTemporaryPassword((value) => !value)} className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={showTemporaryPassword ? t("ซ่อนรหัสผ่าน") : t("แสดงรหัสผ่าน")}>
                    {showTemporaryPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button type="button" disabled={!temporaryPassword} onClick={() => void navigator.clipboard.writeText(temporaryPassword).then(() => toast.success(t("คัดลอกรหัสผ่านแล้ว")))} className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800" aria-label={t("คัดลอกรหัสผ่าน")}>
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <label className="block font-semibold text-slate-700 dark:text-slate-200">

              {t("ยืนยันรหัสผ่านชั่วคราว")}
              <input type="password" value={confirmTemporaryPassword} onChange={(event) => setConfirmTemporaryPassword(event.target.value)} minLength={12} required autoComplete="new-password" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
            </label>

            <label className="block font-semibold text-slate-700 dark:text-slate-200">

              {t("รหัสผ่านของผู้ดูแลระบบเพื่อยืนยันการดำเนินการ")}
              <input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} required autoComplete="current-password" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
            </label>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button type="button" onClick={() => setResetPasswordUser(null)} className="rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{t("ยกเลิก")}</button>
              <button disabled={isResettingPassword} className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                {isResettingPassword ? t("กำลังตั้งรหัส...") : t("ยืนยันตั้งรหัสผ่านชั่วคราว")}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t("ยืนยันการปิดใช้งานบัญชี")}
        maxWidth="md"
      >
        {userToDelete && (
          <div className="space-y-4 text-xs">
            <div className="bg-rose-50 dark:bg-rose-950/40 p-4 rounded-2xl border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200">
              <div className="font-bold text-sm">

                {t("คุณต้องการปิดใช้งานบัญชี \"")}{userToDelete.full_name}" ({userToDelete.username}{t(") หรือไม่?")}
              </div>
              <div className="mt-1 text-xs text-rose-800 dark:text-rose-300">

                {t("อีเมล:")} {userToDelete.email}  {t("| บทบาท:")} {t(`role.${userToDelete.role}`, { ns: 'statuses', defaultValue: userToDelete.role })}  {t("| สังกัด:")} {userToDelete.department || '-'}
              </div>
              <p className="mt-2 text-[11px] text-rose-700 dark:text-rose-400">

                {t("การดำเนินการนี้จะปิดใช้งานบัญชีและยกเลิก session ปัจจุบัน โดยยังเก็บรายวิชา ข้อสอบ และ Audit Log ไว้เป็นหลักฐาน")}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 dark:text-slate-300 font-semibold"
              >

                {t("ยกเลิก")}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors shadow-sm disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? t("กำลังปิดบัญชี...") : t("ยืนยันปิดใช้งาน")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
