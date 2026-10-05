import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { examsApi } from '../../api/exams';
import { downloadAuthenticatedResource } from '../../api/client';
import { Exam, ExamStatus } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EnvelopePreviewModal } from '../../components/envelope/EnvelopePreviewModal';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft,
  Printer,
  FileCheck,
  CheckCircle2,
  Download,
  AlertCircle,
  FileText,
  Layers,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { localizedApiError } from '../../api/localizedError';
import i18n from '../../i18n';
import { APPROVED_PAPER_WEIGHTS, type ApprovedPaperWeight } from '../../utils/paperPrintSpecification';

export const ExamPrintPage: React.FC = () => {
  const { t } = useTranslation("avStaff");

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [exam, setExam] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Print record state (REQ-0009)
  const [printedCopies, setPrintedCopies] = useState<number>(0);
  const [paperWeight, setPaperWeight] = useState<ApprovedPaperWeight>(APPROVED_PAPER_WEIGHTS[0]);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Envelope Label Modal state (REQ-0010)
  const [isEnvelopeOpen, setIsEnvelopeOpen] = useState(false);

  const fetchExam = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const data = await examsApi.getExamById(id);
      setExam(data);
      setPrintedCopies(data.num_copies > 0 ? data.num_copies : 1);
    } catch (err: any) {
      toast.error(t("ไม่สามารถโหลดข้อมูลได้"), localizedApiError(err, t('An unexpected error occurred.')));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExam();
  }, [id]);

  // Handle Print Action (REQ-0009)
  const handleRecordPrint = async (markCompleted: boolean) => {
    if (!id) return;
    if (!printedCopies || printedCopies < 1) {
      toast.warning(t("กรุณาระบุจำนวนชุดที่พิมพ์"));
      return;
    }

    setIsSubmitting(true);
    try {
      await examsApi.printExam(id, {
        printed_copies: printedCopies,
        paper_weight: paperWeight,
        notes: notes || 'พิมพ์เรียบร้อยตามมาตรฐาน',
        mark_completed: markCompleted,
      });

      toast.success(
        markCompleted ? t('บันทึกการพิมพ์เสร็จสมบูรณ์') : t('เริ่มกระบวนการจัดพิมพ์'),
        t("บันทึกจำนวน {{v0}} ชุดเรียบร้อย", { v0: printedCopies })
      );

      if (markCompleted) {
        navigate('/av-staff/queue');
      } else {
        fetchExam();
      }
    } catch (err: any) {
      const errorCode = err?.response?.data?.code;
      const message = errorCode === 'UNSUPPORTED_PRINT_SPEC'
        ? t('สเปกการพิมพ์นี้ไม่รองรับ')
        : localizedApiError(err, t('An unexpected error occurred.'));
      toast.error(t("บันทึกการพิมพ์ไม่สำเร็จ"), message);
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

                {t("บันทึกการพิมพ์ข้อสอบ & ใบปะหน้า")}
              </h1>
              <StatusBadge status={exam.status} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">

              {t("วิชา")} {exam.course_code} - {exam.course_name}  {t("| ห้องสอบ:")} {exam.room || t("ตามตาราง")}
            </p>
          </div>
        </div>

        {/* Envelope Label Modal Trigger */}
        <button
          onClick={() => setIsEnvelopeOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 transition-all"
        >
          <FileCheck className="w-4 h-4" />

          {t("พิมพ์ใบปะหน้าซอง")}
        </button>
      </div>

      {/* Main Print Form Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Source File & Specs */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-400">{t("ไฟล์ต้นฉบับ:")}</span>
            <div className="font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">
              {exam.original_filename || t("ไฟล์ข้อสอบ")}
            </div>
            {exam.file_url && (
              <button
                type="button"
                onClick={() =>
                  void downloadAuthenticatedResource(exam.file_url!, exam.original_filename || `exam-${exam.id}`)
                    .catch(() => toast.error(t("ดาวน์โหลดไม่สำเร็จ"), t("ไม่สามารถดาวน์โหลดไฟล์ข้อสอบได้")))
                }
                className="text-brand-600 font-semibold hover:underline inline-flex items-center gap-1 mt-1"
              >
                <Download className="w-3 h-3" />

                {t("ดาวน์โหลดไฟล์ส่งเข้าเครื่องพิมพ์")}
              </button>
            )}
          </div>
          <div>
            <span className="text-slate-400">{t("จำนวนที่ขอพิมพ์:")}</span>
            <div className="text-base font-black text-emerald-600 mt-0.5">
              {exam.num_copies > 0 ? t("{{v0}} ชุด", { v0: exam.num_copies }) : t("ยังไม่ระบุ")}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{exam.num_pages || 1}  {t("หน้า/ชุด (")}{exam.is_double_sided ? t("หน้า-หลัง") : t("หน้าเดียว")})</div>
          </div>
          <div>
            <span className="text-slate-400">{t("คำสั่งพิเศษ:")}</span>
            <div className="font-medium text-slate-700 dark:text-slate-300 italic mt-0.5">
              {exam.special_instructions || t("ไม่มี")}
            </div>
          </div>
        </div>

        {/* Recording inputs (REQ-0009) */}
        <div className="space-y-4 text-xs">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Printer className="w-4 h-4 text-teal-600" />
            <span>{t("ระบุข้อมูลการพิมพ์จริง")}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">

                {t("จำนวนชุดที่พิมพ์จริง (Printed Copies) *")}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={printedCopies}
                onChange={(e) => setPrintedCopies(Number(e.target.value))}
                className="w-full text-base font-extrabold text-teal-600 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="paper-weight" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('น้ำหนัก/ชนิดกระดาษ')}
              </label>
              <select
                id="paper-weight"
                value={paperWeight}
                onChange={(e) => setPaperWeight(e.target.value as ApprovedPaperWeight)}
                disabled={APPROVED_PAPER_WEIGHTS.length === 1}
                className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 font-medium disabled:cursor-default disabled:opacity-100"
              >
                {APPROVED_PAPER_WEIGHTS.map((weight) => (
                  <option key={weight} value={weight}>{weight}</option>
                ))}
              </select>
            </div>

            <div>
              <span className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('ขนาดกระดาษ')}</span>
              <div className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {exam.paper_size || t('ไม่ระบุ')}
              </div>
            </div>

            <div>
              <span className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('ด้านการพิมพ์')}</span>
              <div className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {exam.is_double_sided ? t('Double-sided') : t('Single-sided')}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 dark:border-teal-900 dark:bg-teal-950/30">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t('ตัวอย่างสเปกการพิมพ์')}</div>
            <div className="mt-1 font-bold text-slate-800 dark:text-slate-100">
              {exam.paper_size || t('ไม่ระบุ')} • {paperWeight} • {exam.is_double_sided ? t('Double-sided') : t('Single-sided')}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">

              {t("บันทึกการพิมพ์ / หมายเหตุ")}
            </label>
            <input
              type="text"
              placeholder={t("เช่น พิมพ์ด้วยเครื่อง Ricoh Pro #2, พิมพ์สมบูรณ์ครบถ้วน...")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            />
          </div>
        </div>

        {/* Existing Print Records History */}
        {exam.print_records && exam.print_records.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">

              {t("ประวัติการบันทึกการพิมพ์ก่อนหน้า")}
            </h4>
            <div className="space-y-2">
              {exam.print_records.map((pr, i) => (
                <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-teal-600">{pr.printed_copies}  {t("ชุด")}</span> ({pr.paper_type})
                    {pr.notes && <span className="text-slate-500 dark:text-slate-400 ml-2 italic">"{pr.notes}"</span>}
                  </div>
                  <div className="text-slate-400 text-[11px]">

                    {t("โดย:")} {pr.printer_name} | {new Date(pr.printed_at).toLocaleString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'th-TH')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsEnvelopeOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />

            {t("เปิดดู/พิมพ์ใบปะหน้าซอง")}
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleRecordPrint(false)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-colors"
            >

              {t("กำลังจัดพิมพ์ (In Progress)")}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleRecordPrint(true)}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-500/25 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? t("กำลังบันทึก...") : t("พิมพ์เสร็จสมบูรณ์ (Mark as Printed)")}
            </button>
          </div>
        </div>
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
