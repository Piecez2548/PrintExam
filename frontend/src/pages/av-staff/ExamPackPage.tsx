import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { examsApi } from '../../api/exams';
import { Exam, ExamStatus } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EnvelopePreviewModal } from '../../components/envelope/EnvelopePreviewModal';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft,
  PackageCheck,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Send,
} from 'lucide-react';

export const ExamPackPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [exam, setExam] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Packing state (REQ-0011)
  const [envelopeCount, setEnvelopeCount] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [chkSeal, setChkSeal] = useState<boolean>(true);
  const [chkLabel, setChkLabel] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Envelope modal
  const [isEnvelopeOpen, setIsEnvelopeOpen] = useState(false);

  const fetchExam = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const data = await examsApi.getExamById(id);
      setExam(data);
    } catch (err: any) {
      toast.error('ไม่สามารถโหลดข้อมูลได้', err.response?.data?.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExam();
  }, [id]);

  const handlePackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!chkSeal || !chkLabel) {
      toast.warning('กรุณายืนยันการปิดผนึกและติดใบปะหน้าซองให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);
    try {
      await examsApi.packExam(id, {
        envelope_count: envelopeCount,
        notes: notes || 'บรรจุซองและปิดผนึกซีลเรียบร้อย',
      });

      toast.success('บันทึกการบรรจุซองเรียบร้อยแล้ว', 'สถานะเปลี่ยนเป็น "บรรจุซองเรียบร้อย"');
      navigate('/av-staff/queue');
    } catch (err: any) {
      toast.error('บันทึกการบรรจุซองไม่สำเร็จ', err.response?.data?.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="py-12 text-center text-slate-400">กำลังโหลดข้อมูล...</div>;
  if (!exam) return <div className="py-12 text-center text-slate-500">ไม่พบข้อสอบ</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/av-staff/queue"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                ยืนยันการบรรจุซองข้อสอบ
              </h1>
              <StatusBadge status={exam.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              วิชา {exam.course_code} - {exam.course_name} | ห้องสอบ: {exam.room || 'ตามตาราง'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsEnvelopeOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-50 shadow-xs"
        >
          <FileText className="w-4 h-4 text-brand-500" />
          ดูใบปะหน้าซอง
        </button>
      </div>

      {/* Main Packing Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Info Grid */}
        <div className="bg-purple-50 dark:bg-purple-950/40 p-5 rounded-2xl border border-purple-200 dark:border-purple-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-purple-900 dark:text-purple-200">
          <div>
            <span className="text-slate-500 dark:text-slate-400">จำนวนที่พิมพ์แล้ว:</span>
            <div className="text-xl font-black text-purple-900 dark:text-purple-100 mt-0.5">
              {exam.printed_copies ?? exam.print_records?.[0]?.printed_copies ?? exam.num_copies} ชุด
            </div>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">ห้องสอบ:</span>
            <div className="text-sm font-bold text-purple-900 dark:text-purple-100 mt-0.5">{exam.room || 'ตามตาราง'}</div>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">วันสอบ:</span>
            <div className="text-sm font-bold text-purple-900 dark:text-purple-100 mt-0.5">
              {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString('th-TH') : '-'}
            </div>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">อาจารย์ผู้สอน:</span>
            <div className="text-sm font-bold text-purple-900 dark:text-purple-100 mt-0.5">{exam.instructor_name}</div>
          </div>
        </div>

        <form onSubmit={handlePackSubmit} className="space-y-5 text-xs">
          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              จำนวนซองข้อสอบที่บรรจุ (Envelope Count) *
            </label>
            <input
              type="number"
              min="1"
              value={envelopeCount}
              onChange={(e) => setEnvelopeCount(Number(e.target.value))}
              required
              className="w-full text-base font-extrabold text-purple-600 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              (เช่น 1 ซอง หรือแบ่ง 2 ซองตามแถวที่นั่ง)
            </p>
          </div>

          {/* Checklist */}
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>การตรวจสอบความปลอดภัยของซองข้อสอบ</span>
            </h4>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={chkLabel}
                onChange={(e) => setChkLabel(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded"
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                1. ติดใบปะหน้าซองข้อสอบ (FORM EXAM-01) ครบถ้วน ระบุวิชา ห้องสอบ และจำนวนถูกต้อง
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={chkSeal}
                onChange={(e) => setChkSeal(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded"
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                2. ปิดผนึกฝาซองด้วยสติกเกอร์ซีลความปลอดภัย (Security Seal) และลงนามกำกับเรียบร้อย
              </span>
            </label>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              บันทึกการบรรจุซอง / หมายเหตุ
            </label>
            <input
              type="text"
              placeholder="เช่น บรรจุ 1 ซองใหญ่ ซองละ 120 ชุด..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting || !chkSeal || !chkLabel}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-500/25 transition-all flex items-center gap-2 text-xs disabled:opacity-50"
            >
              <PackageCheck className="w-4 h-4" />
              {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันบรรจุซองข้อสอบ (Confirm Packing)'}
            </button>
          </div>
        </form>
      </div>

      {/* Envelope Modal */}
      <EnvelopePreviewModal
        isOpen={isEnvelopeOpen}
        onClose={() => setIsEnvelopeOpen(false)}
        exam={exam}
      />
    </div>
  );
};
