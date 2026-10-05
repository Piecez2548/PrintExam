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

const EXAM_LANGUAGE_OPTIONS = [
  { value: 'THAI', label: 'ภาษาไทย' },
  { value: 'ENGLISH', label: 'ภาษาอังกฤษ' },
  { value: 'BILINGUAL', label: 'ไทยและอังกฤษ' },
] as const;

const PRINT_FORMAT_OPTIONS = [
  { value: 'SINGLE_SIDED', label: 'หน้าเดียว' },
  { value: 'DOUBLE_SIDED', label: 'หน้า-หลัง' },
  { value: 'BOOKLET', label: 'แบบเล่ม' },
  { value: 'OTHER', label: 'รูปแบบอื่น' },
] as const;

const ALLOWED_MATERIAL_OPTIONS = [
  { value: 'BOOK', label: 'อนุญาตนำตำราเข้าห้องสอบ' },
  { value: 'CALCULATOR', label: 'อนุญาตเครื่องคิดเลข' },
  { value: 'NO_FORMULA_RULER', label: 'ไม่อนุญาตไม้บรรทัดสูตร' },
  { value: 'NONE', label: 'ไม่มีอุปกรณ์เพิ่มเติม' },
] as const;

function parseAllowedMaterials(raw?: string): { selected: string[]; other: string; legacy: string[] } {
  if (!raw) return { selected: [], other: '', legacy: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string')) {
      return { selected: [], other: '', legacy: [raw] };
    }
    const values = parsed as string[];
    const selected = values.filter((value) => ALLOWED_MATERIAL_OPTIONS.some((option) => option.value === value));
    const otherValues = values.filter((value) => value.startsWith('OTHER:') && value.slice(6).trim());
    const other = otherValues[0]?.slice(6) || '';
    const recognized = new Set([...selected, ...(other ? [otherValues[0]] : [])]);
    return { selected, other, legacy: values.filter((value) => !recognized.has(value)) };
  } catch {
    return { selected: [], other: '', legacy: [raw] };
  }
}

const formatIsDoubleSided = (format: string) => format === 'DOUBLE_SIDED' || format === 'BOOKLET';

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
  const [editStudentCount, setEditStudentCount] = useState<number>(1);
  const [editReserveCopies, setEditReserveCopies] = useState<number>(0);
  const [editNumPages, setEditNumPages] = useState<number>(1);
  const [editExamLanguage, setEditExamLanguage] = useState<string>('THAI');
  const [editPrintFormat, setEditPrintFormat] = useState<string>('DOUBLE_SIDED');
  const [editRequiresAnswerSheet, setEditRequiresAnswerSheet] = useState(false);
  const [editMaterials, setEditMaterials] = useState<string[]>([]);
  const [editOtherMaterial, setEditOtherMaterial] = useState('');
  const [editMaterialsLegacy, setEditMaterialsLegacy] = useState<string[]>([]);
  const [editInstructions, setEditInstructions] = useState<string>('');
  const [editDirtyFields, setEditDirtyFields] = useState<Set<string>>(new Set());
  const [editFile, setEditFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Envelope Label Modal
  const [isEnvelopeOpen, setIsEnvelopeOpen] = useState(false);

  const resetEditForm = (data: Exam) => {
    setEditNumCopies(data.num_copies > 0 ? data.num_copies : 1);
    setEditStudentCount(data.student_count && data.student_count > 0 ? data.student_count : 1);
    setEditReserveCopies(data.reserve_copies ?? 0);
    setEditNumPages(data.num_pages || 1);
    setEditExamLanguage(data.exam_language || 'THAI');
    setEditPrintFormat(data.print_format || (data.is_double_sided ? 'DOUBLE_SIDED' : 'SINGLE_SIDED'));
    setEditRequiresAnswerSheet(Boolean(data.requires_answer_sheet));
    const materialValues = parseAllowedMaterials(data.allowed_materials);
    setEditMaterials(materialValues.selected);
    setEditOtherMaterial(materialValues.other);
    setEditMaterialsLegacy(materialValues.legacy);
    setEditInstructions(data.special_instructions || '');
    setEditDirtyFields(new Set());
  };

  const fetchExam = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const data = await examsApi.getExamById(id);
      setExam(data);
      resetEditForm(data);
    } catch (err: any) {
      toast.error(t("ไม่สามารถโหลดข้อมูลข้อสอบได้"), localizedApiError(err, t('An unexpected error occurred.')));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExam();
  }, [id, lastEvent]);

  const markEditFieldChanged = (field: string) => {
    setEditDirtyFields((current) => new Set(current).add(field));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setIsSaving(true);
    try {
      const formData = new FormData();
      if (editDirtyFields.has('num_copies')) formData.append('num_copies', editNumCopies.toString());
      if (editDirtyFields.has('student_count')) formData.append('student_count', editStudentCount.toString());
      if (editDirtyFields.has('reserve_copies')) formData.append('reserve_copies', editReserveCopies.toString());
      if (editDirtyFields.has('num_pages')) formData.append('num_pages', editNumPages.toString());
      if (editDirtyFields.has('exam_language')) formData.append('exam_language', editExamLanguage);
      if (editDirtyFields.has('print_format')) {
        formData.append('print_format', editPrintFormat);
        formData.append('is_double_sided', String(formatIsDoubleSided(editPrintFormat)));
      }
      if (editDirtyFields.has('requires_answer_sheet')) formData.append('requires_answer_sheet', String(editRequiresAnswerSheet));
      if (editDirtyFields.has('allowed_materials')) {
        const nextMaterials = [...editMaterials];
        if (editOtherMaterial.trim()) nextMaterials.push(`OTHER:${editOtherMaterial.trim()}`);
        formData.append('allowed_materials', JSON.stringify(nextMaterials));
      }
      if (editDirtyFields.has('special_instructions')) formData.append('special_instructions', editInstructions);
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

  const openEditModal = () => {
    if (exam) resetEditForm(exam);
    setEditFile(null);
    setIsEditModalOpen(true);
  };

  const toggleEditMaterial = (value: string) => {
    if (value === 'NONE' && !editMaterials.includes('NONE')) setEditOtherMaterial('');
    setEditMaterials((current) => {
      if (value === 'NONE') return current.includes('NONE') ? [] : ['NONE'];
      const withoutNone = current.filter((item) => item !== 'NONE');
      return withoutNone.includes(value) ? withoutNone.filter((item) => item !== value) : [...withoutNone, value];
    });
    markEditFieldChanged('allowed_materials');
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
            onClick={openEditModal}
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
            onClick={openEditModal}
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
        maxWidth="2xl"
      >
        <form onSubmit={handleEditSubmit} className="max-h-[calc(100dvh-10rem)] space-y-4 overflow-y-auto px-1 text-sm">
          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h4 className="mb-3 font-bold text-slate-900 dark:text-white">{t("รายละเอียดการจัดพิมพ์")}</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {t("จำนวนชุดที่ต้องการพิมพ์ *")}
                <input type="number" min={1} value={editNumCopies} onChange={(e) => { setEditNumCopies(Number(e.target.value)); markEditFieldChanged('num_copies'); }} required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </label>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {t("จำนวนผู้เข้าสอบ")}
                <input type="number" min={1} value={editStudentCount} onChange={(e) => { setEditStudentCount(Number(e.target.value)); markEditFieldChanged('student_count'); }} required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </label>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {t("ชุดสำรอง")}
                <input type="number" min={0} max={20} value={editReserveCopies} onChange={(e) => { setEditReserveCopies(Number(e.target.value)); markEditFieldChanged('reserve_copies'); }} required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </label>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {t("จำนวนหน้า/ชุด")}
                <input type="number" min={1} value={editNumPages} onChange={(e) => { setEditNumPages(Number(e.target.value)); markEditFieldChanged('num_pages'); }} required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </label>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {t("ภาษาข้อสอบ")}
                <select value={editExamLanguage} onChange={(e) => { setEditExamLanguage(e.target.value); markEditFieldChanged('exam_language'); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  {!EXAM_LANGUAGE_OPTIONS.some((option) => option.value === editExamLanguage) && <option value={editExamLanguage} disabled>{t("ค่าเดิมที่ไม่อยู่ในรายการ")}</option>}
                  {EXAM_LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
                </select>
              </label>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {t("รูปแบบการพิมพ์")}
                <select value={editPrintFormat} onChange={(e) => { setEditPrintFormat(e.target.value); markEditFieldChanged('print_format'); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  {!PRINT_FORMAT_OPTIONS.some((option) => option.value === editPrintFormat) && <option value={editPrintFormat} disabled>{t("ค่าเดิมที่ไม่อยู่ในรายการ")}</option>}
                  {PRINT_FORMAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
                </select>
              </label>
              <label className="font-semibold text-slate-700 dark:text-slate-300 sm:col-span-2">
                {t("กระดาษคำตอบคอมพิวเตอร์")}
                <select value={editRequiresAnswerSheet ? 'yes' : 'no'} onChange={(e) => { setEditRequiresAnswerSheet(e.target.value === 'yes'); markEditFieldChanged('requires_answer_sheet'); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  <option value="no">{t("ไม่ใช้")}</option>
                  <option value="yes">{t("ใช้")}</option>
                </select>
              </label>
              {exam.section && <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:col-span-2"><span className="font-semibold">{t("ตอน")}: </span>{exam.section}<span className="ml-2 text-slate-500 dark:text-slate-400">{t("เป็นข้อมูลอ้างอิงจากข้อสอบหรือตารางสอบ")}</span></div>}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h4 className="mb-3 font-bold text-slate-900 dark:text-white">{t("วัสดุและคำแนะนำ")}</h4>
            <fieldset>
              <legend className="mb-2 font-semibold text-slate-700 dark:text-slate-300">{t("อุปกรณ์/คำแนะนำสำหรับผู้คุมสอบ")}</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ALLOWED_MATERIAL_OPTIONS.map((option) => <label key={option.value} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-slate-700 dark:border-slate-700 dark:text-slate-200"><input type="checkbox" checked={editMaterials.includes(option.value)} onChange={() => toggleEditMaterial(option.value)} className="accent-brand-600" />{t(option.label)}</label>)}
              </div>
              <label className="mt-3 block font-semibold text-slate-700 dark:text-slate-300">
                {t("อื่น ๆ โปรดระบุ")}
                <input value={editOtherMaterial} onChange={(e) => { const value = e.target.value; setEditOtherMaterial(value); if (value.trim()) setEditMaterials((current) => current.filter((item) => item !== 'NONE')); markEditFieldChanged('allowed_materials'); }} maxLength={250} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </label>
              {editMaterialsLegacy.length > 0 && <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><div>{t("มีค่าอุปกรณ์เดิมที่ไม่อยู่ในรายการ และจะคงไว้หากไม่แก้ไข")}</div><ul className="mt-1 list-inside list-disc">{editMaterialsLegacy.map((value, index) => <li key={`${index}-${value}`}>{value}</li>)}</ul></div>}
            </fieldset>
            <label className="mt-4 block font-semibold text-slate-700 dark:text-slate-300">
              {t("คำอธิบายเพิ่มเติม")}
              <textarea rows={3} value={editInstructions} onChange={(e) => { setEditInstructions(e.target.value); markEditFieldChanged('special_instructions'); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            </label>
          </section>

          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h4 className="mb-3 font-bold text-slate-900 dark:text-white">{t("ไฟล์ข้อสอบ")}</h4>
            <div className="text-xs text-slate-600 dark:text-slate-300"><span className="font-semibold">{t("ไฟล์ปัจจุบัน:")}</span> {exam.original_filename || (exam.file_url ? t("ไฟล์ข้อสอบ") : t("ไม่มีไฟล์"))}</div>
            <label className="mt-3 block font-semibold text-slate-700 dark:text-slate-300">
              {t("อัปโหลดไฟล์ใหม่ (ถ้าต้องการเปลี่ยนไฟล์ .docx / .pdf)")}
              <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setEditFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-950 dark:file:text-brand-200" />
            </label>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t("รองรับ PDF, DOC และ DOCX ระบบจะตรวจชนิดไฟล์จริงก่อนรับเอกสาร")}</p>
          </section>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
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
