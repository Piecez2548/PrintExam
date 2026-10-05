import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { examsApi } from '../../api/exams';
import { downloadAuthenticatedResource } from '../../api/client';
import { Exam, ExamStatus } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatusTimeline } from '../../components/common/StatusTimeline';
import { DeadlineNotice } from '../../components/common/DeadlineNotice';
import { Modal } from '../../components/common/Modal';
import { EnvelopePreviewModal } from '../../components/envelope/EnvelopePreviewModal';
import { useToast } from '../../context/ToastContext';
import { useWebSocket } from '../../context/WebSocketContext';
import {
  ArrowLeft,
  FileText,
  Download,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock,
  Printer,
  FileCheck,
  Send,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { localizedApiError } from '../../api/localizedError';

export const ExamDetailPage: React.FC = () => {
  const { t } = useTranslation("instructor");

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { lastEvent } = useWebSocket();

  const [exam, setExam] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editNumCopies, setEditNumCopies] = useState<number>(1);
  const [editNumPages, setEditNumPages] = useState<number>(1);
  const [editDoubleSided, setEditDoubleSided] = useState<boolean>(true);
  const [editInstructions, setEditInstructions] = useState<string>('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Envelope Label Modal
  const [isEnvelopeOpen, setIsEnvelopeOpen] = useState(false);

  const fetchExam = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const data = await examsApi.getExamById(id);
      setExam(data);
      setEditNumCopies(data.num_copies > 0 ? data.num_copies : 1);
      setEditNumPages(data.num_pages || 1);
      setEditDoubleSided(Boolean(data.is_double_sided));
      setEditInstructions(data.special_instructions || '');
    } catch (err: any) {
      toast.error(t("ไม่สามารถโหลดข้อมูลข้อสอบได้"), localizedApiError(err, t('An unexpected error occurred.')));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExam();
  }, [id, lastEvent]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('num_copies', editNumCopies.toString());
      formData.append('num_pages', editNumPages.toString());
      formData.append('is_double_sided', editDoubleSided.toString());
      formData.append('special_instructions', editInstructions);
      formData.append('is_draft', 'false'); // Mark as resubmitted
      if (editFile) {
        formData.append('file', editFile);
      }

      await examsApi.updateExam(id, formData);
      toast.success(t("แก้ไขข้อสอบเรียบร้อยแล้ว"), t("ส่งข้อสอบให้เจ้าหน้าที่ตรวจสอบใหม่อีกครั้ง"));
      setIsEditModalOpen(false);
      fetchExam();
    } catch (err: any) {
      toast.error(t("แก้ไขไม่สำเร็จ"), localizedApiError(err, t('An unexpected error occurred.')));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelExam = async () => {
    if (!id) return;
    if (!window.confirm(t("คุณต้องการยกเลิกข้อสอบชุดนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้"))) {
      return;
    }

    try {
      await examsApi.deleteExam(id);
      toast.success(t("ยกเลิกข้อสอบเรียบร้อยแล้ว"));
      navigate('/instructor/dashboard');
    } catch (err: any) {
      toast.error(t("ไม่สามารถยกเลิกได้"), localizedApiError(err, t('An unexpected error occurred.')));
    }
  };

  if (isLoading) {
    return <div className="py-12 text-center text-slate-400">{t("กำลังโหลดรายละเอียดข้อสอบ...")}</div>;
  }

  if (!exam) {
    return (
      <div className="py-12 text-center text-slate-500 dark:text-slate-400">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <div>{t("ไม่พบข้อมูลข้อสอบ")}</div>
        <Link to="/instructor/dashboard" className="text-xs text-brand-600 underline mt-2 inline-block">

          {t("กลับไปที่แดชบอร์ด")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/instructor/dashboard"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">

                {t("ข้อสอบวิชา")} {exam.course_code} - {exam.course_name}
              </h1>
              <StatusBadge status={exam.status} size="md" />
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {t('Ref ID:')} #{exam.id}  {t("| สร้างเมื่อ:")} {new Date(exam.created_at).toLocaleString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'th-TH')}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* View Envelope Label */}
          <button
            onClick={() => setIsEnvelopeOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-xs"
          >
            <FileCheck className="w-4 h-4 text-brand-500" />

            {t("ดูใบปะหน้าซอง")}
          </button>

          {/* Edit Button */}
          <button
            onClick={() => setIsEditModalOpen(true)}
            disabled={!exam.can_edit_or_cancel}
            title={exam.edit_restriction_reason}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              exam.can_edit_or_cancel
                ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
          >
            <Edit className="w-3.5 h-3.5" />

            {t("แก้ไขข้อสอบ")}
          </button>

          {/* Cancel Button */}
          <button
            onClick={handleCancelExam}
            disabled={!exam.can_edit_or_cancel}
            title={exam.edit_restriction_reason}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              exam.can_edit_or_cancel
                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />

            {t("ยกเลิก")}
          </button>
        </div>
      </div>

      {/* Rejection Alert Banner */}
      {exam.status === ExamStatus.REJECTED && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-800 rounded-2xl p-5 flex items-start gap-4 text-rose-900 dark:text-rose-100 shadow-xs animate-in fade-in">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-extrabold text-sm text-rose-800 dark:text-rose-200">

              {t("ข้อสอบไม่ผ่านการตรวจสอบ")}
            </h3>
            <p className="text-xs sm:text-sm text-rose-700 dark:text-rose-300 mt-1 font-medium leading-relaxed">

              {t("สาเหตุ:")} <strong>{exam.rejection_reason || t("ไฟล์ไม่สมบูรณ์ หรือข้อมูลไม่ครบถ้วน")}</strong>
            </p>
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">

              {t("กรุณาแก้ไขไฟล์ข้อสอบตามข้อเสนอแนะด้านบน แล้วกดปุ่ม")} <strong>{t("\"แก้ไขข้อสอบ\"")}</strong>  {t("เพื่อส่งใหม่อีกครั้ง")}
            </p>
          </div>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 shrink-0"
          >

            {t("แก้ไขและส่งใหม่")}
          </button>
        </div>
      )}

      {/* Deadline Notice Card (REQ-0005) */}
      <DeadlineNotice exam={exam} />

      {/* Status Progress Stepper */}
      <StatusTimeline currentStatus={exam.status} history={exam.audit_trail || exam.status_history} />

      {/* Detailed Specs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Course & Schedule Details */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">

            {t("ข้อมูลรายวิชาและวันสอบ")}
          </h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400">{t("รหัสวิชา:")}</span>
              <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{exam.course_code}</div>
            </div>
            <div>
              <span className="text-slate-400">{t("ชื่อรายวิชา:")}</span>
              <div className="font-bold text-slate-800 dark:text-slate-200">{exam.course_name}</div>
            </div>
            <div>
              <span className="text-slate-400">{t("ภาคการศึกษา:")}</span>
              <div className="font-medium text-slate-700 dark:text-slate-300">

                {t("ภาค")} {exam.semester} / {exam.academic_year}
              </div>
            </div>
            <div>
              <span className="text-slate-400">{t("อาจารย์ผู้สอน:")}</span>
              <div className="font-medium text-slate-700 dark:text-slate-300">{exam.instructor_name}</div>
            </div>
            <div>
              <span className="text-slate-400">{t("วันสอบ:")}</span>
              <div className="font-bold text-slate-800 dark:text-slate-200">
                {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'th-TH') : t("ตามตารางสอบ")}
              </div>
            </div>
            <div>
              <span className="text-slate-400">{t("เวลา & ห้องสอบ:")}</span>
              <div className="font-bold text-brand-600">
                {exam.start_time && exam.end_time ? t("{{v0}}-{{v1}} น.", { v0: exam.start_time, v1: exam.end_time }) : ''} @ {exam.room || t("ตามตาราง")}
              </div>
            </div>
          </div>
        </div>

        {/* Printing Specs Details */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">

            {t("รายละเอียดการจัดพิมพ์")}
          </h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400">{t("จำนวนที่สั่งพิมพ์:")}</span>
              <div className="font-extrabold text-emerald-600 text-base">
                {exam.num_copies > 0 ? t("{{v0}} ชุด", { v0: exam.num_copies }) : t("ยังไม่ระบุ")}
              </div>
            </div>
            <div>
              <span className="text-slate-400">{t("จำนวนหน้า/ชุด:")}</span>
              <div className="font-bold text-slate-800 dark:text-slate-200">{exam.num_pages || 1}  {t("หน้า")}</div>
            </div>
            <div>
              <span className="text-slate-400">{t("รูปแบบการพิมพ์:")}</span>
              <div className="font-medium text-slate-700 dark:text-slate-300">
                {exam.is_double_sided ? t("หน้า-หลัง (Double)") : t("หน้าเดียว (Single)")} [{exam.paper_size}]
              </div>
            </div>
            <div>
              <span className="text-slate-400">{t("ไฟล์ข้อสอบ:")}</span>
              {exam.file_url ? (
                <button
                  type="button"
                  onClick={() =>
                    void downloadAuthenticatedResource(exam.file_url!, exam.original_filename || `exam-${exam.id}`)
                      .catch(() => toast.error(t("ดาวน์โหลดไม่สำเร็จ"), t("ไม่สามารถดาวน์โหลดไฟล์ข้อสอบได้")))
                  }
                  className="font-semibold text-brand-600 hover:underline flex items-center gap-1 mt-0.5"
                >
                  <Download className="w-3 h-3" />

                  {t("ดาวน์โหลดไฟล์")}
                </button>
              ) : (
                <div className="text-slate-400">{t("ไม่มีไฟล์")}</div>
              )}
            </div>
          </div>

          {exam.special_instructions && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-400">{t("คำสั่งพิมพ์พิเศษ:")}</span>
              <p className="font-medium text-slate-700 dark:text-slate-300 italic mt-0.5">
                "{exam.special_instructions}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t("แก้ไขข้อมูลข้อสอบ")}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">

              {t("จำนวนชุดที่ต้องการพิมพ์ *")}
            </label>
            <input
              type="number"
              min="1"
              value={editNumCopies}
              onChange={(e) => setEditNumCopies(Number(e.target.value))}
              required
              className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">

              {t("จำนวนหน้าต่อชุด")}
            </label>
            <input
              type="number"
              min="1"
              value={editNumPages}
              onChange={(e) => setEditNumPages(Number(e.target.value))}
              className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">

              {t("คำสั่งพิเศษ")}
            </label>
            <textarea
              rows={2}
              value={editInstructions}
              onChange={(e) => setEditInstructions(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">

              {t("อัปโหลดไฟล์ใหม่ (ถ้าต้องการเปลี่ยนไฟล์ .docx / .pdf)")}
            </label>
            <input
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setEditFile(e.target.files[0]);
                }
              }}
              className="block w-full text-xs text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 dark:text-slate-300 font-semibold"
            >

              {t("ยกเลิก")}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 transition-colors shadow-sm"
            >
              {isSaving ? t("กำลังบันทึก...") : t("บันทึกและส่งตรวจสอบใหม่")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Envelope Preview Modal */}
      <EnvelopePreviewModal
        isOpen={isEnvelopeOpen}
        onClose={() => setIsEnvelopeOpen(false)}
        exam={exam}
      />
    </div>
  );
};
