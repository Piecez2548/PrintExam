import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { UserRole } from '../../types';
import {
  Printer,
  Lock,
  User as UserIcon,
  KeyRound,
  Clock,
  ShieldCheck,
} from 'lucide-react';

/** คืน path หน้าแรกตามบทบาทหลังยืนยันตัวตนสำเร็จ */
const getDashboardPath = (role?: UserRole): string => {
  switch (role) {
    case UserRole.INSTRUCTOR:
      return '/instructor/dashboard';
    case UserRole.AV_STAFF:
      return '/av-staff/queue';
    case UserRole.COORDINATOR:
      return '/coordinator/courses';
    case UserRole.ADMIN:
    default:
      return '/admin/reports';
  }
};

/** แปลงจำนวนวินาทีเป็นรูปแบบ MM:SS สำหรับตัวนับถอยหลัง OTP */
const formatTimer = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const LoginPage: React.FC = () => {
  const { login, verify2FA, isAuthenticated, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Step 1 State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 2 (2FA) State
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [deliveryHint, setDeliveryHint] = useState('ช่องทางที่ลงทะเบียนไว้');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(180); // 3 minutes countdown (NFR-5)
  const [tempUser, setTempUser] = useState<{ full_name: string } | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(getDashboardPath(user?.role));
    }
  }, [isAuthenticated, user, navigate]);

  // 3-minute Countdown Timer (REQ-0001, NFR-5)
  useEffect(() => {
    if (!requires2FA || !expiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setTimeLeftSeconds(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        toast.error('รหัส 2FA หมดอายุ', 'เกินกำหนดเวลา 3 นาที กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
        setRequires2FA(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [requires2FA, expiresAt, toast]);

  // Handle Step 1: Submit username/password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.warning('กรุณากรอกข้อมูล', 'ระบุ Username และ Password ให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(username, password);
      if (res.requires2FA) {
        setRequires2FA(true);
        setTempToken(res.tempToken);
        setDeliveryHint(res.deliveryHint);
        setOtpCode('');
        setExpiresAt(new Date(res.expiresAt));
        // The password step intentionally does not return user data before OTP.
        setTempUser({ full_name: username });
        toast.info('ส่งรหัส OTP แล้ว', `ส่งไปยัง ${res.deliveryHint} กรุณากรอกภายใน 3 นาที`);
      }
    } catch (err: any) {
      toast.error('เข้าสู่ระบบไม่สำเร็จ', err.response?.data?.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Step 2: Submit 2FA OTP
  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      toast.warning('กรุณาระบุ OTP', 'รหัส OTP ต้องมี 6 หลัก');
      return;
    }

    setIsSubmitting(true);
    try {
      await verify2FA(tempToken, otpCode);
    } catch (err: any) {
      toast.error('ยืนยัน 2FA ไม่สำเร็จ', err.response?.data?.message || 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-navy-900 text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient glowing orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header Logo */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-sky-400 text-white shadow-xl shadow-brand-500/30 mb-4 ring-4 ring-white/10">
          <Printer className="w-8 h-8" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          ระบบจัดการพิมพ์ข้อสอบ (Online)
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-400">
          Online University Exam Printing Management System
        </p>
      </div>

      {/* Main Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 z-10">
        <div className="bg-slate-900/80 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-700/60">
          {!requires2FA ? (
            /* STEP 1: Username & Password (REQ-0001) */
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-brand-400" />
                  <span>เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย</span>
                </h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  ชื่อผู้ใช้ (Username)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="กรอกชื่อผู้ใช้ (Username)"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  รหัสผ่าน (Password)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
              </button>
            </form>
          ) : (
            /* STEP 2: 2FA OTP Countdown Timer (REQ-0001, NFR-5) */
            <form onSubmit={handle2FASubmit} className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="border-b border-slate-800 pb-3 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-500/20 text-brand-400 mb-2 ring-2 ring-brand-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  การยืนยันตัวตนแบบ 2 ขั้นตอน (2FA)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  สำหรับผู้ใช้: <strong className="text-brand-300">{tempUser?.full_name}</strong>
                </p>
              </div>

              {/* 3-minute Countdown indicator */}
              <div className="bg-slate-800/90 p-4 rounded-2xl border border-slate-700 text-center">
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 mb-1">
                  <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>ต้องยืนยันรหัสภายใน 3 นาที:</span>
                </div>
                <div
                  className={`text-3xl font-black font-mono tracking-wider ${
                    timeLeftSeconds < 60 ? 'text-rose-400 animate-pulse' : 'text-amber-300'
                  }`}
                >
                  {formatTimer(timeLeftSeconds)}
                </div>
              </div>

              <div className="bg-emerald-950/50 border border-emerald-800/80 p-3 rounded-xl text-xs text-emerald-100 text-center">
                <div className="font-bold">ส่งรหัส OTP ไปยังช่องทางที่ลงทะเบียนไว้แล้ว</div>
                <div className="mt-1 font-mono text-emerald-300">{deliveryHint}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  กรอกรหัสยืนยัน 6 หลัก (OTP / TOTP)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="block w-full py-3 text-center text-2xl font-mono tracking-widest bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRequires2FA(false)}
                  className="w-1/3 py-2.5 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || timeLeftSeconds === 0}
                  className="w-2/3 py-2.5 px-4 rounded-xl text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'กำลังยืนยัน...' : 'ยืนยันรหัส 2FA'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
