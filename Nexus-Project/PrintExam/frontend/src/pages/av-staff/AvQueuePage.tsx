import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { examsApi } from '../../api/exams';
import { Exam, ExamStatus } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EnvelopePreviewModal } from '../../components/envelope/EnvelopePreviewModal';
import { useWebSocket } from '../../context/WebSocketContext';
import { useToast } from '../../context/ToastContext';
import {
  ListTodo,
  CheckCircle2,
  Printer,
  PackageCheck,
  Send,
  FileCheck,
  Eye,
  AlertCircle,
  FileText,
  Clock,
  Download,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { localizedApiError } from '../../api/localizedError';

export const AvQueuePage: React.FC = () => {
  const { t } = useTranslation("avStaff");

  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'validate' | 'print' | 'pack' | 'pickup'>('validate');
  const [selectedExamForEnvelope, setSelectedExamForEnvelope] = useState<Exam | null>(null);
  const { lastEvent } = useWebSocket();
  const toast = useToast();

  const fetchExams = async () => {
    try {
      setIsLoading(true);
      const data = await examsApi.getExams();
      setExams(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [lastEvent]);

  // Filter queues
  const toValidateExams = exams.filter(
    (e) => e.status === ExamStatus.SUBMITTED || e.status === ExamStatus.REJECTED
  );
  const toPrintExams = exams.filter(
    (e) => e.status === ExamStatus.APPROVED || e.status === ExamStatus.PRINTING
  );
  const toPackExams = exams.filter((e) => e.status === ExamStatus.PRINTED);
  const pickupExams = exams.filter(
    (e) => e.status === ExamStatus.PACKED || e.status === ExamStatus.READY_FOR_PICKUP || e.status === ExamStatus.DELIVERED
  );

  const getActiveList = () => {
    switch (activeTab) {
      case 'validate': return toValidateExams;
      case 'print': return toPrintExams;
      case 'pack': return toPackExams;
      case 'pickup': return pickupExams;
    }
  };

  const handleMarkReadyForPickup = async (examId: number) => {
    try {
      await examsApi.readyForPickup(examId, { pickup_location: 'หน่วยโสตทัศนศึกษา ชั้น 2' });
      toast.success(t("แจ้งพร้อมส่งมอบเรียบร้อย"), t("ส่งการแจ้งเตือนไปยังเจ้าหน้าที่ดำเนินการสอบแล้ว"));
      fetchExams();
    } catch (err: any) {
      toast.error(t("ไม่สามารถอัปเดตได้"), localizedApiError(err, t('An unexpected error occurred.')));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <ListTodo className="w-6 h-6 text-amber-500" />
            <span>{t("คิวงานพิมพ์ข้อสอบ (เจ้าหน้าที่หน่วยโสต)")}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">

            {t("กระบวนการ: ตรวจสอบไฟล์ → ตัดข้อสอบ → พิมพ์ → ใบปะหน้าซอง → บรรจุซอง → ส่งมอบ")}
          </p>
        </div>
      </div>

      {/* Workflow Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('validate')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'validate'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{t("1. รอตรวจสอบไฟล์")}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {toValidateExams.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('print')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'print'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-500/25'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>{t("2. รอจัดพิมพ์ (ตัดข้อสอบแล้ว)")}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {toPrintExams.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('pack')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'pack'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>{t("3. รอบรรจุซอง")}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {toPackExams.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('pickup')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'pickup'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>{t("4. พร้อมส่งมอบ / ส่งแล้ว")}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {pickupExams.length}
          </span>
        </button>
      </div>

      {/* Queue List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">{t("รหัสวิชา & รายวิชา")}</th>
                <th className="py-3.5 px-4">{t("อาจารย์ผู้สอน")}</th>
                <th className="py-3.5 px-4">{t("วัน-เวลาสอบ & ห้อง")}</th>
                <th className="py-3.5 px-4">{t("จำนวนพิมพ์ / รูปแบบ")}</th>
                <th className="py-3.5 px-4">{t("สถานะ")}</th>
                <th className="py-3.5 px-4 text-right">{t("ดำเนินการ")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">

                    {t("กำลังโหลดข้อมูลคิวงาน...")}
                  </td>
                </tr>
              ) : getActiveList().length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">

                    {t("ไม่มีรายการในคิวนี้ขณะนี้")}
                  </td>
                </tr>
              ) : (
                getActiveList().map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {exam.course_code}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">{exam.course_name}</div>
                      {exam.original_filename && (
                        <div className="text-[11px] text-brand-600 dark:text-brand-400 flex items-center gap-1 mt-0.5">
                          <FileText className="w-3 h-3" />
                          <span className="truncate max-w-[150px]">{exam.original_filename}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {exam.instructor_name ? `${exam.instructor_name}${exam.instructor_deleted ? ` (${t('บัญชีถูกลบ', { ns: 'common' })})` : ''}` : '-'}
                      </div>
                      <div className="text-[11px] text-slate-400">{exam.instructor_email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'th-TH') : t("ตามตาราง")}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {exam.start_time && exam.end_time ? t("{{v0}}-{{v1}} น.", { v0: exam.start_time, v1: exam.end_time }) : ''}
                      </div>
                      <div className="text-[11px] font-semibold text-rose-600">
                        {exam.room || t("ตามตาราง")}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-900 dark:text-slate-100">
                        {exam.num_copies > 0 ? t("{{v0}} ชุด", { v0: exam.num_copies }) : t("ยังไม่ระบุจำนวน")} ({exam.num_pages || 1}  {t("หน้า)")}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {exam.is_double_sided ? t("หน้า-หลัง") : t("หน้าเดียว")} [{exam.paper_size}]
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={exam.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5">
                      {/* Contextual Actions per Stage */}
                      {activeTab === 'validate' && (
                        <Link
                          to={`/av-staff/exams/${exam.id}/review`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-xs"
                        >
                          <FileCheck className="w-3.5 h-3.5" />

                          {t("ตรวจไฟล์ & ตัดข้อสอบ")}
                        </Link>
                      )}

                      {activeTab === 'print' && (
                        <Link
                          to={`/av-staff/exams/${exam.id}/print`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold transition-all shadow-xs"
                        >
                          <Printer className="w-3.5 h-3.5" />

                          {t("บันทึกการพิมพ์ & ใบปะหน้า")}
                        </Link>
                      )}

                      {activeTab === 'pack' && (
                        <Link
                          to={`/av-staff/exams/${exam.id}/pack`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-xs"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />

                          {t("ยืนยันบรรจุซอง")}
                        </Link>
                      )}

                      {activeTab === 'pickup' && (
                        <>
                          {exam.status === ExamStatus.PACKED && (
                            <button
                              onClick={() => handleMarkReadyForPickup(exam.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold transition-all shadow-xs"
                            >
                              <Send className="w-3.5 h-3.5" />

                              {t("แจ้งพร้อมส่งมอบ")}
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedExamForEnvelope(exam)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 dark:text-slate-300 hover:bg-slate-200 font-medium"
                          >
                            <FileText className="w-3.5 h-3.5" />

                            {t("ใบปะหน้า")}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Envelope Modal */}
      <EnvelopePreviewModal
        isOpen={!!selectedExamForEnvelope}
        onClose={() => setSelectedExamForEnvelope(null)}
        exam={selectedExamForEnvelope}
      />
    </div>
  );
};
