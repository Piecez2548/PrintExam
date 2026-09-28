import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-500 flex items-center justify-center">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-black text-slate-800 dark:text-white">404 - ไม่พบหน้าที่ต้องการ</h1>
      <p className="text-xs sm:text-sm text-slate-500 max-w-sm">
        หน้าที่คุณกำลังเข้าชมอาจถูกย้าย หรือคุณไม่มีสิทธิ์เข้าถึงหน้านี้
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md transition-all"
      >
        <Home className="w-4 h-4" />
        กลับสู่หน้าหลัก
      </Link>
    </div>
  );
};
