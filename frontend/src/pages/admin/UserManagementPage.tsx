import React, { useState, useEffect } from 'react';
import { usersApi } from '../../api/users';
import { User, UserRole, ROLE_LABELS_TH } from '../../types';
import { RoleBadge } from '../../components/common/RoleBadge';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Edit,
  Power,
  Trash2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await usersApi.getUsers({
        search: searchQuery || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });
      setUsers(data);
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
      toast.warning('กรุณากรอกข้อมูลให้ครบถ้วน');
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
        toast.success('อัปเดตข้อมูลผู้ใช้งานสำเร็จ');
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
        toast.success('สร้างบัญชีผู้ใช้ใหม่เรียบร้อยแล้ว');
      }
      setIsModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      toast.error('ไม่สามารถบันทึกได้', err.response?.data?.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSuspend = async (user: User) => {
    try {
      const res = await usersApi.toggleSuspend(user.id);
      toast.success(res.message);
      fetchUsers();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาด', err.response?.data?.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await usersApi.deleteUser(userToDelete.id);
      toast.success(res.message);
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err: any) {
      toast.error('ไม่สามารถลบได้', err.response?.data?.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-purple-600" />
            <span>จัดการผู้ใช้งานและกำหนดสิทธิ์</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            เพิ่ม, แก้ไข, ระงับการใช้งาน, ลบ และกำหนดบทบาทผู้ใช้งานในระบบ (Admin Role)
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
          เพิ่มผู้ใช้งานใหม่
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ, Username, อีเมล หรือสังกัด..."
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
            <option value="">ทุกบทบาท (All Roles)</option>
            <option value={UserRole.INSTRUCTOR}>อาจารย์ผู้สอน</option>
            <option value={UserRole.AV_STAFF}>เจ้าหน้าที่หน่วยโสต</option>
            <option value={UserRole.COORDINATOR}>จนท.ดำเนินการสอบ</option>
            <option value={UserRole.ADMIN}>ผู้ดูแลระบบ</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
          >
            <option value="">ทุกสถานะ</option>
            <option value="active">เปิดใช้งาน (Active)</option>
            <option value="0">ระงับใช้งาน (Suspended)</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">ชื่อ-สกุล & Username</th>
                <th className="py-3.5 px-4">บทบาท (Role)</th>
                <th className="py-3.5 px-4">อีเมล & เบอร์โทร</th>
                <th className="py-3.5 px-4">สังกัด / ภาควิชา</th>
                <th className="py-3.5 px-4">สถานะ</th>
                <th className="py-3.5 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    กำลังโหลดข้อมูลผู้ใช้...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    ไม่พบข้อมูลผู้ใช้งาน
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {u.full_name}
                      </div>
                      <div className="text-[11px] text-slate-400">Username: {u.username}</div>
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
                          <CheckCircle2 className="w-3 h-3" /> เปิดใช้งาน
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-semibold text-[11px]">
                          <XCircle className="w-3 h-3" /> ระงับการใช้งาน
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => {
                          setEditingUserId(u.id);
                          setUsername(u.username);
                          setFullName(u.full_name);
                          setEmail(u.email);
                          setRole(u.role);
                          setDepartment(u.department || '');
                          setPhone(u.phone || '');
                          setIsModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
                      >
                        แก้ไข
                      </button>
                      <button
                        onClick={() => handleToggleSuspend(u)}
                        className={`px-2.5 py-1 rounded-lg font-medium ${
                          u.is_active
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {u.is_active ? 'ระงับ' : 'เปิดใช้งาน'}
                      </button>
                      <button
                        onClick={() => {
                          setUserToDelete(u);
                          setIsDeleteModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-medium"
                      >
                        ลบ
                      </button>
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
        title={editingUserId ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}
      >
        <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
          {!editingUserId && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อผู้ใช้ (Username) *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="เช่น somchai.j"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  รหัสผ่านเริ่มต้น (Default Password) *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              ชื่อ-นามสกุล (Full Name) *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="เช่น รศ.ดร.สมชาย ใจดี"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                อีเมล (Email) *
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
                เบอร์โทรศัพท์
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
                บทบาทในระบบ (Role) *
              </label>
              <select
                value={role}
                onChange={(e: any) => setRole(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
              >
                <option value={UserRole.INSTRUCTOR}>อาจารย์ผู้สอน (Instructor)</option>
                <option value={UserRole.AV_STAFF}>เจ้าหน้าที่หน่วยโสต (AV Staff)</option>
                <option value={UserRole.COORDINATOR}>จนท.ดำเนินการสอบ (Coordinator)</option>
                <option value={UserRole.ADMIN}>ผู้ดูแลระบบ (Admin)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                สังกัด / คณะ / ภาควิชา
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="เช่น วิศวกรรมคอมพิวเตอร์"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="ยืนยันการลบผู้ใช้งาน"
        maxWidth="md"
      >
        {userToDelete && (
          <div className="space-y-4 text-xs">
            <div className="bg-rose-50 dark:bg-rose-950/40 p-4 rounded-2xl border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200">
              <div className="font-bold text-sm">
                คุณต้องการลบผู้ใช้งาน "{userToDelete.full_name}" ({userToDelete.username}) หรือไม่?
              </div>
              <div className="mt-1 text-xs text-rose-800 dark:text-rose-300">
                อีเมล: {userToDelete.email} | บทบาท: {userToDelete.role} | สังกัด: {userToDelete.department || '-'}
              </div>
              <p className="mt-2 text-[11px] text-rose-700 dark:text-rose-400">
                ⚠️ การดำเนินการนี้จะลบบัญชีผู้ใช้งานและข้อมูลที่เกี่ยวข้องทั้งหมดออกจากระบบอย่างถาวร
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors shadow-sm disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบผู้ใช้งาน'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
