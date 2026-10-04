import React, { useState } from 'react';
import { KeyRound, Save, ShieldCheck, UserRound } from 'lucide-react';
import { profileApi } from '../../api/profile';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const ProfilePage: React.FC = () => {
  const { user, updateCurrentUser } = useAuth();
  const toast = useToast();
  const [username, setUsername] = useState(user?.username || '');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [officeRoom, setOfficeRoom] = useState(user?.office_room || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const requiredProfileFields = [username, fullName, email, department, phone, officeRoom];
    if (requiredProfileFields.some((value) => !value.trim())) {
      toast.warning('กรุณากรอกข้อมูลโปรไฟล์ทุกช่องให้ครบถ้วน');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.warning('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน');
      return;
    }
    if (user.must_change_password && !newPassword) {
      toast.warning('กรุณาตั้งรหัสผ่านส่วนตัวก่อนใช้งานระบบ');
      return;
    }
    try {
      setSaving(true);
      const result = await profileApi.update({
        username: username.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
        department: department.trim(),
        phone: phone.trim(),
        office_room: officeRoom.trim(),
        current_password: newPassword ? currentPassword : undefined,
        new_password: newPassword || undefined,
      });
      updateCurrentUser(result.data);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('บันทึกโปรไฟล์เรียบร้อยแล้ว');
    } catch (error: any) {
      toast.error('บันทึกไม่สำเร็จ', error.response?.data?.message || 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="max-w-4xl mx-auto p-5 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2"><UserRound className="w-6 h-6" /> โปรไฟล์ของฉัน</h1>
        <p className="text-sm text-slate-500 mt-1">กรอกข้อมูลส่วนตัวทุกช่องให้ครบถ้วน ข้อมูลติดต่อจะใช้ในเอกสารและใบปะหน้าซองข้อสอบ</p>
      </div>

      {user.must_change_password && (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-200 flex gap-3">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <div><strong>ตั้งค่าบัญชีครั้งแรก</strong><div className="mt-0.5">บัญชีนี้สร้างโดยผู้ดูแลระบบ กรุณาตรวจข้อมูลและเปลี่ยนรหัสผ่านก่อนเข้าเมนูอื่น</div></div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 grid sm:grid-cols-2 gap-4">
          <label htmlFor="profile-username" className="text-sm font-semibold text-slate-700 dark:text-slate-200">ชื่อผู้ใช้ <span className="text-rose-500">*</span><input id="profile-username" name="username" autoComplete="username" className={`${inputClass} mt-1.5`} value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={64} /></label>
          <label htmlFor="profile-full-name" className="text-sm font-semibold text-slate-700 dark:text-slate-200">ชื่อ-นามสกุล <span className="text-rose-500">*</span><input id="profile-full-name" name="full_name" autoComplete="name" className={`${inputClass} mt-1.5`} value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={150} /></label>
          <label htmlFor="profile-email" className="text-sm font-semibold text-slate-700 dark:text-slate-200">อีเมล <span className="text-rose-500">*</span><input id="profile-email" name="email" type="email" autoComplete="email" className={`${inputClass} mt-1.5`} value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} /></label>
          <label htmlFor="profile-phone" className="text-sm font-semibold text-slate-700 dark:text-slate-200">เบอร์โทรศัพท์ <span className="text-rose-500">*</span><input id="profile-phone" name="phone" type="tel" autoComplete="tel" className={`${inputClass} mt-1.5`} value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={30} placeholder="เช่น 081-234-5678" /></label>
          <label htmlFor="profile-office-room" className="text-sm font-semibold text-slate-700 dark:text-slate-200">ห้องทำงาน <span className="text-rose-500">*</span><input id="profile-office-room" name="office_room" autoComplete="off" className={`${inputClass} mt-1.5`} value={officeRoom} onChange={(e) => setOfficeRoom(e.target.value)} placeholder="เช่น วท. 204" required maxLength={100} /></label>
          <label htmlFor="profile-department" className="text-sm font-semibold text-slate-700 dark:text-slate-200">ภาควิชา/หน่วยงาน <span className="text-rose-500">*</span><input id="profile-department" name="department" autoComplete="organization" className={`${inputClass} mt-1.5`} value={department} onChange={(e) => setDepartment(e.target.value)} required maxLength={150} /></label>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4"><KeyRound className="w-5 h-5" /> เปลี่ยนรหัสผ่าน</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <label htmlFor="profile-current-password" className="text-sm font-semibold text-slate-700 dark:text-slate-200">รหัสผ่านที่แอดมินให้/ปัจจุบัน<input id="profile-current-password" name="current_password" type="password" autoComplete="current-password" className={`${inputClass} mt-1.5`} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required={user.must_change_password || Boolean(newPassword)} /></label>
            <label htmlFor="profile-new-password" className="text-sm font-semibold text-slate-700 dark:text-slate-200">รหัสผ่านใหม่<input id="profile-new-password" name="new_password" type="password" autoComplete="new-password" className={`${inputClass} mt-1.5`} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required={user.must_change_password} minLength={12} placeholder="12+ ตัว: A-Z, a-z, 0-9 และอักขระพิเศษ" /></label>
            <label htmlFor="profile-confirm-password" className="text-sm font-semibold text-slate-700 dark:text-slate-200">ยืนยันรหัสผ่านใหม่<input id="profile-confirm-password" name="confirm_password" type="password" autoComplete="new-password" className={`${inputClass} mt-1.5`} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required={Boolean(newPassword)} minLength={12} /></label>
          </div>
        </section>

        <div className="flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-5 py-2.5 text-sm font-bold"><Save className="w-4 h-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์'}</button></div>
      </form>
    </div>
  );
};
