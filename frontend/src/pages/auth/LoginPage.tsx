import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authApi } from '../../api/auth';
import { Modal } from '../../components/common/Modal';
import {
  Printer,
  Lock,
  User as UserIcon,
  KeyRound,
  Clock,
  ShieldCheck,
  Eye,
  EyeOff,
  CircleHelp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PreferenceControls } from '../../components/common/PreferenceControls';
import { localizedApiError } from '../../api/localizedError';

/** แปลงจำนวนวินาทีเป็นรูปแบบ MM:SS สำหรับตัวนับถอยหลัง OTP */
const formatTimer = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const LoginPage: React.FC = () => {
  const { t } = useTranslation("auth");

  const { login, verify2FA, isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Step 1 State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [isSendingHelpRequest, setIsSendingHelpRequest] = useState(false);
  const focusFrameRef = useRef<number | null>(null);
  const focusTimerRef = useRef<number | null>(null);

  const cancelPendingFocusRetention = () => {
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
    focusFrameRef.current = null;
    focusTimerRef.current = null;
  };

  const retainTypingFocus = (input: HTMLInputElement) => {
    cancelPendingFocusRetention();
    focusFrameRef.current = window.requestAnimationFrame(() => {
      input.focus({ preventScroll: true });
      focusFrameRef.current = null;
    });
    focusTimerRef.current = window.setTimeout(() => {
      input.focus({ preventScroll: true });
      focusTimerRef.current = null;
    }, 75);
  };

  useEffect(() => cancelPendingFocusRetention, []);

  // Step 2 (2FA) State
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [deliveryHint, setDeliveryHint] = useState('ช่องทางที่ลงทะเบียนไว้');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(180); // 3 minutes countdown (NFR-5)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/reports');
    }
  }, [isAuthenticated, navigate]);

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!forgotIdentifier.trim()) {
      toast.warning(t("กรุณากรอกชื่อผู้ใช้หรืออีเมล"));
      return;
    }
    try {
      setIsSendingHelpRequest(true);
      const result = await authApi.requestPasswordReset(forgotIdentifier.trim());
      toast.success(t("ส่งคำขอแล้ว"), t('Your request will be reviewed by an administrator.'));
      setIsForgotModalOpen(false);
      setForgotIdentifier('');
    } catch (error: any) {
      toast.error(t("ส่งคำขอไม่สำเร็จ"), localizedApiError(error, t('An unexpected error occurred.')));
    } finally {
      setIsSendingHelpRequest(false);
    }
  };

  // 3-minute Countdown Timer (REQ-0001, NFR-5)
  useEffect(() => {
    if (!requires2FA || !expiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setTimeLeftSeconds(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        toast.error(t("รหัส 2FA หมดอายุ"), t("เกินกำหนดเวลา 3 นาที กรุณาเข้าสู่ระบบใหม่อีกครั้ง"));
        setRequires2FA(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [requires2FA, expiresAt, toast]);

  // Handle Step 1: Submit username/password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.warning(t("กรุณากรอกข้อมูล"), t("ระบุ Username และ Password ให้ครบถ้วน"));
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
        toast.info(t("ส่งรหัส OTP แล้ว"), t("ส่งไปยัง {{v0}} กรุณากรอกภายใน 3 นาที", { v0: res.deliveryHint }));
      }
    } catch (err: any) {
      toast.error(t("เข้าสู่ระบบไม่สำเร็จ"), localizedApiError(err, t('An unexpected error occurred.')));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Step 2: Submit 2FA OTP
  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      toast.warning(t("กรุณาระบุ OTP"), t("รหัส OTP ต้องมี 6 หลัก"));
      return;
    }

    setIsSubmitting(true);
    try {
      await verify2FA(tempToken, otpCode);
    } catch (err: any) {
      toast.error(t("ยืนยัน 2FA ไม่สำเร็จ"), localizedApiError(err, t('An unexpected error occurred.')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 dark:from-slate-900 dark:via-slate-800 dark:to-navy-900 dark:text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <PreferenceControls compact />
      </div>
      {/* Background ambient glowing orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-brand-500/10 dark:bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-sky-500/10 dark:bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header Logo */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-sky-400 text-white shadow-xl shadow-brand-500/30 mb-4 ring-4 ring-white/10">
          <Printer className="w-8 h-8" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">

          {t("ระบบจัดการพิมพ์ข้อสอบ (Online)")}
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-400">
          Online University Exam Printing Management System
        </p>
      </div>

      {/* Main Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 z-10">
        <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-200 dark:border-slate-700/60">
          {!requires2FA ? (
            /* STEP 1: Username & Password (REQ-0001) */
            <form onSubmit={handlePasswordSubmit} autoComplete="off" className="space-y-5">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-brand-400" />
                  <span>{t("เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย")}</span>
                </h3>
              </div>

              <div>
                <label htmlFor="login-username" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">

                  {t("ชื่อผู้ใช้ (Username)")}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 dark:text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    autoComplete="off"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    value={username}
                    onChange={(e) => {
                      const input = e.currentTarget;
                      setUsername(input.value);
                      retainTypingFocus(input);
                    }}
                    onPointerDown={cancelPendingFocusRetention}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' || e.key === 'Enter') cancelPendingFocusRetention();
                    }}
                    required
                    placeholder={t("กรอกชื่อผู้ใช้ (Username)")}
                    className="block w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">

                  {t("รหัสผ่าน (Password)")}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 dark:text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    value={password}
                    onChange={(e) => {
                      const input = e.currentTarget;
                      setPassword(input.value);
                      retainTypingFocus(input);
                    }}
                    onPointerDown={cancelPendingFocusRetention}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' || e.key === 'Enter') cancelPendingFocusRetention();
                    }}
                    required
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-11 py-2.5 bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t("ซ่อนรหัสผ่าน") : t("แสดงรหัสผ่าน")} className="absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 hover:text-white">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotIdentifier(username);
                      setIsForgotModalOpen(true);
                    }}
                    className="text-xs font-semibold text-brand-300 transition-colors hover:text-brand-200 hover:underline"
                  >

                    {t("ลืมรหัสผ่าน?")}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                <span>{t("หลังตรวจสอบรหัสผ่าน ระบบจะส่ง OTP ไปยังช่องทางที่ลงทะเบียนไว้ หากเข้าใช้งานครั้งแรกให้เปลี่ยนข้อมูลบัญชีในหน้าโปรไฟล์")}</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? t("กำลังตรวจสอบ...") : t("เข้าสู่ระบบ")}
              </button>
            </form>
          ) : (
            /* STEP 2: 2FA OTP Countdown Timer (REQ-0001, NFR-5) */
            <form onSubmit={handle2FASubmit} className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-500/20 text-brand-400 mb-2 ring-2 ring-brand-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">

                  {t("การยืนยันตัวตนแบบ 2 ขั้นตอน (2FA)")}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">

                  {t("สำหรับผู้ใช้:")} <strong className="text-brand-300">{username}</strong>
                </p>
              </div>

              {/* 3-minute Countdown indicator */}
              <div className="bg-slate-100 dark:bg-slate-800/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>{t("ต้องยืนยันรหัสภายใน 3 นาที:")}</span>
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
                <div className="font-bold">{t("ส่งรหัส OTP ไปยังช่องทางที่ลงทะเบียนไว้แล้ว")}</div>
                <div className="mt-1 font-mono text-emerald-300">{deliveryHint === 'ช่องทางที่ลงทะเบียนไว้' ? t(deliveryHint) : deliveryHint}</div>
              </div>

              <div>
                <label htmlFor="login-otp" className="block text-xs font-semibold text-slate-300 mb-1.5">

                  {t("กรอกรหัสยืนยัน 6 หลัก (OTP / TOTP)")}
                </label>
                <input
                  id="login-otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="block w-full py-3 text-center text-2xl font-mono tracking-widest bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRequires2FA(false)}
                  className="w-1/3 py-2.5 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >

                  {t("ย้อนกลับ")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || timeLeftSeconds === 0}
                  className="w-2/3 py-2.5 px-4 rounded-xl text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? t("กำลังยืนยัน...") : t("ยืนยันรหัส 2FA")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title={t("ขอความช่วยเหลือกรณีลืมรหัสผ่าน")}
        maxWidth="md"
      >
        <form onSubmit={handleForgotPassword} className="space-y-4 text-sm">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">

            {t("ระบบจะส่งคำขอไปยังผู้ดูแลระบบ กรุณาติดต่อผู้ดูแลเพื่อยืนยันตัวตนและรับรหัสผ่านชั่วคราว เช่นเดียวกับการติดต่อศูนย์คอมพิวเตอร์ของมหาวิทยาลัย")}
          </div>
          <label htmlFor="forgot-identifier" className="block font-semibold text-slate-700 dark:text-slate-200">

            {t("ชื่อผู้ใช้หรืออีเมล")}
            <input
              id="forgot-identifier"
              name="identifier"
              value={forgotIdentifier}
              onChange={(event) => setForgotIdentifier(event.target.value)}
              autoComplete="username"
              required
              placeholder={t("Username หรืออีเมลที่ลงทะเบียน")}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t("เพื่อความปลอดภัย ระบบจะไม่แจ้งว่าบัญชีดังกล่าวมีอยู่หรือไม่")}</p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button type="button" onClick={() => setIsForgotModalOpen(false)} className="rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{t("ยกเลิก")}</button>
            <button disabled={isSendingHelpRequest} className="rounded-xl bg-brand-600 px-5 py-2 font-bold text-white hover:bg-brand-700 disabled:opacity-50">
              {isSendingHelpRequest ? t("กำลังส่งคำขอ...") : t("ส่งคำขอถึงผู้ดูแลระบบ")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
