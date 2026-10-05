import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { examsApi } from '../../api/exams';
import { downloadAuthenticatedResource } from '../../api/client';
import { Exam, ExamStatus } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatusTimeline } from '../../components/common/StatusTimeline';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft,
  FileCheck,
  CheckCircle2,
  XCircle,
  Download,
  AlertCircle,
  FileText,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { localizedApiError } from '../../api/localizedError';

export const ExamReviewPage: React.FC = () => {
  const { t } = useTranslation("avStaff");

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [exam, setExam] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Validation Checklist state
  const [chkFileType, setChkFileType] = useState(true);
  const [chkMetadata, setChkMetadata] = useState(true);
  const [chkCopies, setChkCopies] = useState(true);
  const [validationNote, setValidationNote] = useState('');

  // Rejection Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchExam = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const data = await examsApi.getExamById(id);
      setExam(data);
    } catch (err: any) {
      toast.error(t("ไม่สามารถโหลดข้อมูลได้"), localizedApiError(err, t('An unexpected error occurred.')));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExam();
  }, [id]);

  // Handle Approve / "ตัดข้อสอบ" (REQ-0006)
  const handleApprove = async () => {
    if (!id) return;
    if (!chkFileType || !chkMetadata || !chkCopies) {
      toast.warning(t("กรุณาตรวจสอบรายการความถูกต้องให้ครบถ้วนก่อนอนุมัติ"));
      return;
    }

    setIsSubmitting(true);
    try {
      await examsApi.validateExam(id, validationNote || 'ตรวจสอบไฟล์ถูกต้องสมบูรณ์ อนุมัติตัดข้อสอบ');
      toast.success(t("อนุมัติตัดข้อสอบเรียบร้อยแล้ว"), t("สถานะเปลี่ยนเป็น \"อนุมัติ / ตัดข้อสอบแล้ว\" พร้อมพิมพ์"));
      navigate('/av-staff/queue');
    } catch (err: any) {
      toast.error(t("เกิดข้อผิดพลาดในการอนุมัติ"), localizedApiError(err, t('An unexpected error occurred.')));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reject (REQ-0007)
  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !rejectionReason.trim()) {
      toast.warning(t("กรุณาระบุสาเหตุที่ปฏิเสธ"));
      return;
    }

    setIsSubmitting(true);
    try {
      await examsApi.rejectExam(id, rejectionReason);
      toast.success(t("ส่งกลับให้อาจารย์แก้ไขแล้ว"), t("ระบบได้ส่งการแจ้งเตือนไปยังอาจารย์ผู้สอนทันที"));
      setIsRejectModalOpen(false);
      navigate('/av-staff/queue');
    } catch (err: any) {
      toast.error(t("เกิดข้อผิดพลาดในการปฏิเสธ"), localizedApiError(err, t('An unexpected error occurred.')));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="py-12 text-center text-slate-400">{t("กำลังโหลดข้อมูล...")}</div>;
  if (!exam) return <div className="py-12 text-center text-slate-500 dark:text-slate-400">{t("ไม่พบข้อสอบ")}</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/av-staff/queue"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">

                {t("ตรวจสอบไฟล์ข้อสอบ")}
              </h1>
              <StatusBadge status={exam.status} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">

              {t("วิชา")} {exam.course_code} - {exam.course_name}  {t("(ส่งโดย:")} {exam.instructor_name})
            </p>
          </div>
        </div>
      </div>

      {/* File & Details Review Box */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        {/* File inspection block */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {exam.original_filename || t("ไฟล์ข้อสอบ")}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">

                {t("ประเภท:")} {exam.file_type || '.docx / .pdf'}  {t("| ขนาด:")}{' '}
                {exam.file_size ? `${(exam.file_size / 1024).toFixed(1)} KB` : t("สมบูรณ์")}
              </div>
            </div>
          </div>

          {exam.file_url && (
            <button
              type="button"
              onClick={() =>
                void downloadAuthenticatedResource(exam.file_url!, exam.original_filename || `exam-${exam.id}`)
                  .catch(() => toast.error(t("ดาวน์โหลดไม่สำเร็จ"), t("ไม่สามารถดาวน์โหลดไฟล์ข้อสอบได้")))
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 transition-all"
            >
              <Download className="w-4 h-4" />

              {t("ดาวน์โหลดเปิดตรวจไฟล์")}
            </button>
          )}
        </div>

        {/* Specs Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
            <span className="text-slate-400">{t("จำนวนสั่งพิมพ์:")}</span>
            <div className="text-base font-extrabold text-slate-800 dark:text-slate-100">
              {exam.num_copies > 0 ? t("{{v0}} ชุด", { v0: exam.num_copies }) : t("ยังไม่ระบุ")}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
            <span className="text-slate-400">{t("จำนวนหน้า:")}</span>
            <div className="text-base font-extrabold text-slate-800 dark:text-slate-100">{exam.num_pages || 1}  {t("หน้า")}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
            <span className="text-slate-400">{t("รูปแบบการพิมพ์:")}</span>
            <div className="font-bold text-slate-800 dark:text-slate-200 mt-1">
              {exam.is_double_sided ? t("หน้า-หลัง") : t("หน้าเดียว")} [{exam.paper_size}]
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
            <span className="text-slate-400">{t("ห้องสอบ:")}</span>
            <div className="font-bold text-rose-600 mt-1">{exam.room || t("ตามตารางสอบ")}</div>
          </div>
        </div>

        {exam.special_instructions && (
          <div className="bg-amber-50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
            <strong>{t("หมายเหตุจากอาจารย์:")}</strong> {exam.special_instructions}
          </div>
        )}

        {/* Validation Checklist */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-brand-500" />
            <span>{t("รายการตรวจสอบความถูกต้องของไฟล์ข้อสอบ")}</span>
          </h3>

          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={chkFileType}
                onChange={(e) => setChkFileType(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded"
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">

                {t("1. ไฟล์อยู่ในรูปแบบที่ถูกต้อง (.docx, .doc, .pdf) เปิดอ่านได้ ชัดเจน ไม่มีไฟล์เสีย")}
              </span>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={chkMetadata}
                onChange={(e) => setChkMetadata(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded"
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">

                {t("2. ข้อมูลหน้าปกข้อสอบถูกต้องตรงกับรหัสวิชา, ชื่อวิชา, ภาคเรียน, และชื่ออาจารย์ผู้สอน")}
              </span>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={chkCopies}
                onChange={(e) => setChkCopies(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded"
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">

                {t("3. จำนวนชุดที่อาจารย์ขอพิมพ์สอดคล้องกับจำนวนนักศึกษา (")}{exam.num_copies > 0 ? t("{{v0}} ชุด", { v0: exam.num_copies }) : t("ยังไม่ระบุจำนวน")})
              </span>
            </label>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">

              {t("บันทึกผลการตรวจสอบ (Optional)")}
            </label>
            <input
              type="text"
              placeholder={t("ระบุข้อความบันทึกของหน่วยโสต...")}
              value={validationNote}
              onChange={(e) => setValidationNote(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            />
          </div>
        </div>

        {/* Action Decision Buttons */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsRejectModalOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 text-xs font-bold transition-colors flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4" />

            {t("ไม่ผ่าน / ส่งกลับแก้ไข")}
          </button>

          <button
            type="button"
            disabled={isSubmitting || !chkFileType || !chkMetadata || !chkCopies}
            onClick={handleApprove}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isSubmitting ? t("กำลังบันทึก...") : t("อนุมัติ / ตัดข้อสอบ")}
          </button>
        </div>
      </div>

      {/* Reject Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title={t("ระบุสาเหตุที่ข้อสอบไม่ผ่านการตรวจสอบ")}
      >
        <form onSubmit={handleReject} className="space-y-4 text-xs">
          <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">

            {t("ระบบจะส่งข้อความแจ้งเตือนให้อาจารย์ผู้สอน (")}<strong>{exam.instructor_name}</strong>{t(") ทันที เพื่อให้อาจารย์แก้ไขไฟล์และส่งใหม่")}
          </div>

          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1.5">

              {t("สาเหตุที่ไม่ผ่านการตรวจสอบ *")}
            </label>
            <textarea
              rows={3}
              required
              placeholder={t("เช่น รหัสวิชาบนหน้าปกไม่ตรงกับวิชาที่ระบุ, ไฟล์ไม่มีหน้าคำตอบ, ไฟล์เปิดแล้วฟอนต์เพี้ยน...")}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsRejectModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 dark:text-slate-300 font-semibold"
            >

              {t("ยกเลิก")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors shadow-sm"
            >
              {isSubmitting ? t("กำลังส่งแจ้งเตือน...") : t("ยืนยันปฏิเสธและแจ้งอาจารย์")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
