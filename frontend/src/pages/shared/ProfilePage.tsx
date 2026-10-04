import React, { useEffect, useState } from 'react';
import { ArrowLeft, Mail, Save, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SelfProfileUpdate } from '../../api/auth';
import { RoleBadge } from '../../components/common/RoleBadge';
import { useAuth } from '../../context/AuthContext';

export const ProfilePage: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name);
    setEmail(user.email);
    setDepartment(user.department || '');
    setPhone(user.phone || '');
  }, [user]);

  if (!user) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    const payload: SelfProfileUpdate = {
      full_name: fullName,
      email,
      department: department || null,
      phone: phone || null,
    };

    try {
      const updatedUser = await updateProfile(payload);
      setFullName(updatedUser.full_name);
      setEmail(updatedUser.email);
      setDepartment(updatedUser.department || '');
      setPhone(updatedUser.phone || '');
      setSuccess('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
    } catch (err: any) {
      setError(err.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลส่วนตัวได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">Account settings</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">ข้อมูลส่วนตัว</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">จัดการข้อมูลติดต่อของบัญชีที่กำลังใช้งาน</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับหน้าก่อนหน้า
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex items-start gap-3 border-b border-slate-100 pb-5 dark:border-slate-800">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">บัญชีผู้ใช้งาน</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Username และ Role เป็นข้อมูลความปลอดภัย ไม่สามารถแก้ไขจากหน้านี้</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Username</div>
            <div className="mt-1 break-all text-sm font-bold text-slate-800 dark:text-slate-100">{user.username}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Role</div>
            <div className="mt-2"><RoleBadge role={user.role} size="sm" /></div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5 dark:border-slate-800">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">ข้อมูลที่แก้ไขได้</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ข้อมูลนี้ใช้สำหรับแสดงตัวตนและช่องทางติดต่อในระบบ</p>
          </div>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">ชื่อ-นามสกุล *</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} maxLength={200} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">อีเมล *</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">หน่วยงาน / ภาควิชา</span>
            <input value={department} onChange={(event) => setDepartment(event.target.value)} maxLength={200} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">เบอร์โทรศัพท์</span>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={50} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950" />
          </label>
        </div>

        {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}
        {success && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">{success}</div>}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => navigate(-1)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">ยกเลิก</button>
          <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Save className="h-4 w-4" />
            {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
        </div>
      </form>

      <div className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-xs text-brand-800 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-200">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>การแก้ไขนี้มีผลเฉพาะข้อมูลส่วนตัวของบัญชีปัจจุบัน ไม่สามารถเปลี่ยนสิทธิ์ บทบาท สถานะบัญชี หรือรหัสผ่านได้</p>
      </div>
    </section>
  );
};
