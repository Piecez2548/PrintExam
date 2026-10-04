import React, { useEffect, useState } from 'react';
import { SelfProfileUpdate } from '../../api/auth';
import { User } from '../../types';
import { Modal } from '../common/Modal';

interface ProfileEditModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SelfProfileUpdate) => Promise<void>;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ user, isOpen, onClose, onSubmit }) => {
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email);
  const [department, setDepartment] = useState(user.department || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFullName(user.full_name);
    setEmail(user.email);
    setDepartment(user.department || '');
    setPhone(user.phone || '');
    setError('');
  }, [isOpen, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit({
        full_name: fullName,
        email,
        department: department || null,
        phone: phone || null,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลส่วนตัวได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="แก้ไขข้อมูลส่วนตัว" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-300">
          ชื่อผู้ใช้และบทบาทเป็นข้อมูลความปลอดภัย ไม่สามารถแก้ไขจากหน้านี้ได้
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">ชื่อผู้ใช้</label>
          <input value={user.username} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">ชื่อ-นามสกุล *</label>
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} maxLength={200} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">อีเมล *</label>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">หน่วยงาน / ภาควิชา</label>
            <input value={department} onChange={(event) => setDepartment(event.target.value)} maxLength={200} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">เบอร์โทรศัพท์</label>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={50} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </div>
        </div>

        {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}

        <div data-testid="profile-edit-actions" className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">ยกเลิก</button>
          <button type="submit" disabled={isSubmitting} className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50">{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</button>
        </div>
      </form>
    </Modal>
  );
};
