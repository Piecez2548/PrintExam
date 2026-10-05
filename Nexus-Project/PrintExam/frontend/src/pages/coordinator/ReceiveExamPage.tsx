import React, { useState, useEffect } from 'react';
import { examsApi } from '../../api/exams';
import { Exam, ExamStatus } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EnvelopePreviewModal } from '../../components/envelope/EnvelopePreviewModal';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { useAuth } from '../../context/AuthContext';
import {
  PackageCheck,
  CheckCircle2,
  FileCheck,
  ShieldCheck,
  Truck,
  FileText,
  Clock,
  UserCheck,
  PenTool,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { localizedApiError } from '../../api/localizedError';

export const ReceiveExamPage: React.FC = () => {
  const { t } = useTranslation("coordinator");

  const toast = useToast();
  const { user, isCoordinator } = useAuth();
  const { lastEvent } = useWebSocket();
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Receive Handover Modal State (REQ-0012)
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [receiverNote, setReceiverNote] = useState('ได้รับซองข้อสอบครบถ้วน ซีลปิดผนึกอยู่ในสภาพสมบูรณ์');
  const [chkItems, setChkItems] = useState(true);
  const [chkSealed, setChkSealed] = useState(true);
  const [chkProctorRole, setChkProctorRole] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Envelope Label Modal
  const [envelopeExam, setEnvelopeExam] = useState<Exam | null>(null);

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

  // Ready for pickup or delivered
  const pickupQueue = exams.filter(
    (e) => e.status === ExamStatus.READY_FOR_PICKUP || e.status === ExamStatus.PACKED
  );
  const deliveredList = exams.filter((e) => e.status === ExamStatus.DELIVERED);

  const handleOpenReceiveModal = (exam: Exam) => {
    setSelectedExam(exam);
    setReceiverNote(`ข้าพเจ้า ${user?.full_name || 'กรรมการคุมสอบ'} ได้ตรวจรับซองข้อสอบเรียบร้อย ซีลสมบูรณ์`);
    setChkItems(true);
    setChkSealed(true);
    setChkProctorRole(true);
    setIsReceiveModalOpen(true);
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam) return;
    if (!chkItems || !chkSealed || !chkProctorRole) {
      toast.warning(t("กรุณายืนยันการตรวจสอบและความรับผิดชอบของกรรมการคุมสอบให้ครบถ้วน"));
      return;
    }

    setIsSubmitting(true);
    try {
      await examsApi.deliverExam(selectedExam.id, {
        receiver_signature_note: receiverNote,
      });

      toast.success(
        t("บันทึกรับมอบข้อสอบเรียบร้อยแล้ว"),
        t("กรรมการคุมสอบ ({{v0}}) ได้ลงนามรับมอบข้อสอบวิชา {{v1}} เข้าห้องสอบเรียบร้อย", { v0: user?.full_name, v1: selectedExam.course_code })
      );
      setIsReceiveModalOpen(false);
      fetchExams();
    } catch (err: any) {
      toast.error(t("ไม่สามารถบันทึกได้"), localizedApiError(err, t('An unexpected error occurred.')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <PackageCheck className="w-6 h-6 text-emerald-600" />
            <span>{t("รับมอบข้อสอบและนำส่งห้องสอบ")}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">

            {t("สำหรับกรรมการคุมสอบ/เจ้าหน้าที่ดำเนินการสอบ เพื่อตรวจรับซองข้อสอบ บันทึกลงนามรับมอบ และนำส่งเข้าห้องสอบ (REQ-0012)")}
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold">
          <UserCheck className="w-4 h-4 text-emerald-600" />
          <span>{t("ผู้ลงนามรับมอบ:")} {user?.full_name}  {t("(กรรมการคุมสอบ)")}</span>
        </div>
      </div>

      {/* Section 1: Ready for Pickup Queue */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-500" />
            <span>{t("รายการข้อสอบพร้อมรับมอบ (")}{pickupQueue.length}  {t("รายการ)")}</span>
          </h2>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">{t("รหัสวิชา & ชื่อรายวิชา")}</th>
                  <th className="py-3.5 px-4">{t("วันสอบ & เวลาสอบ")}</th>
                  <th className="py-3.5 px-4">{t("ห้องสอบ (Exam Room)")}</th>
                  <th className="py-3.5 px-4">{t("จำนวนชุด")}</th>
                  <th className="py-3.5 px-4">{t("สถานะ")}</th>
                  <th className="py-3.5 px-4 text-right">{t("ดำเนินการรับมอบ")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">

                      {t("กำลังโหลดข้อมูล...")}
                    </td>
                  </tr>
                ) : pickupQueue.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">

                      {t("ยังไม่มีซองข้อสอบที่พร้อมรับมอบขณะนี้")}
                    </td>
                  </tr>
                ) : (
                  pickupQueue.map((exam) => (
                    <tr key={exam.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {exam.course_code}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">{exam.course_name}</div>
                        <div className="text-[11px] text-slate-400">{t("ผู้สอน:")} {exam.instructor_name}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'th-TH') : '-'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {exam.start_time && exam.end_time ? t("{{v0}}-{{v1}} น.", { v0: exam.start_time, v1: exam.end_time }) : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-rose-600">
                        {exam.room || t("ตามตาราง")}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-800 dark:text-slate-200">
                        {exam.printed_copies ?? exam.num_copies}  {t("ชุด")}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={exam.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => setEnvelopeExam(exam)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 dark:text-slate-300 hover:bg-slate-200 font-medium"
                        >

                          {t("ใบปะหน้า")}
                        </button>
                        {isCoordinator ? (
                          <button
                            onClick={() => handleOpenReceiveModal(exam)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-xs"
                          >
                            <PenTool className="w-3.5 h-3.5" />

                            {t("ลงนามรับมอบข้อสอบ")}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">

                            {t("(เฉพาะเจ้าหน้าที่สอบที่ลงนามได้)")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 2: Delivered History */}
      <div className="space-y-3 pt-4">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Truck className="w-4 h-4 text-emerald-600" />
          <span>{t("ประวัติข้อสอบที่รับมอบแล้ว (")}{deliveredList.length}  {t("รายการ)")}</span>
        </h2>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">{t("รหัสวิชา & รายวิชา")}</th>
                  <th className="py-3.5 px-4">{t("วัน-เวลาสอบ")}</th>
                  <th className="py-3.5 px-4">{t("ห้องสอบ")}</th>
                  <th className="py-3.5 px-4">{t("จำนวนพิมพ์")}</th>
                  <th className="py-3.5 px-4">{t("สถานะ")}</th>
                  <th className="py-3.5 px-4 text-right">{t("เอกสาร")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {deliveredList.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                      {exam.course_code} - {exam.course_name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'th-TH') : '-'}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-rose-600">{exam.room}</td>
                    <td className="py-3.5 px-4 font-bold">{exam.printed_copies ?? exam.num_copies}  {t("ชุด")}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={exam.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setEnvelopeExam(exam)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 dark:text-slate-300 hover:bg-slate-200 font-medium"
                      >

                        {t("ใบปะหน้าซอง")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Receive & Sign-off Modal */}
      <Modal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        title={t("ลงนามและยืนยันการรับมอบซองข้อสอบ (กรรมการคุมสอบ)")}
        maxWidth="lg"
      >
        {selectedExam && (
          <form onSubmit={handleConfirmDelivery} className="space-y-4 text-xs">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
              <div className="font-bold text-sm">

                {t("วิชา")} {selectedExam.course_code} - {selectedExam.course_name}
              </div>
              <div className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">

                {t("สำหรับห้องสอบ:")} <strong>{selectedExam.room || t("ตามตาราง")}</strong>  {t("| จำนวน")} <strong>{selectedExam.printed_copies ?? selectedExam.num_copies}  {t("ชุด")}</strong>
              </div>
              <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">

                {t("วัน-เวลาสอบ:")} {selectedExam.exam_date ? new Date(selectedExam.exam_date).toLocaleDateString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'th-TH') : '-'} {selectedExam.start_time}-{selectedExam.end_time}  {t("น.")}
              </div>
            </div>

            {/* Proctor Identity Banner */}
            <div className="bg-blue-50 dark:bg-blue-950/40 p-3.5 rounded-2xl border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <div className="font-bold text-xs">{t("ผู้ลงนามรับมอบข้อสอบ (กรรมการคุมสอบ/ฝ่ายดำเนินการสอบ)")}</div>
                <div className="text-xs text-blue-700 dark:text-blue-300 font-medium mt-0.5">

                  {t("ชื่อ-สกุล:")} <strong>{user?.full_name}</strong>  {t("| อีเมล:")} {user?.email}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{t("การตรวจสอบขณะรับมอบ")}</span>
              </h4>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chkItems}
                  onChange={(e) => setChkItems(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded mt-0.5"
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">

                  {t("1. ตรวจสอบรหัสวิชา, ชื่อวิชา, ห้องสอบ และจำนวนชุด (")}{selectedExam.printed_copies ?? selectedExam.num_copies}  {t("ชุด) ถูกต้องตรงตามใบปะหน้าซอง")}
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chkSealed}
                  onChange={(e) => setChkSealed(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded mt-0.5"
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">

                  {t("2. สติกเกอร์ซีลซองและแถบปิดผนึกอยู่ในสภาพสมบูรณ์ ไม่มีการเปิด ฉีกขาด หรือถูกแกะก่อนเวลา")}
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chkProctorRole}
                  onChange={(e) => setChkProctorRole(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded mt-0.5"
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">

                  {t("3. ข้าพเจ้ารับมอบซองข้อสอบในฐานะกรรมการคุมสอบ และจะนำส่งเข้าห้องสอบตามเวลาที่กำหนด")}
                </span>
              </label>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">

                {t("หมายเหตุการรับมอบ / ข้อความบันทึกลงนาม")}
              </label>
              <input
                type="text"
                value={receiverNote}
                onChange={(e) => setReceiverNote(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsReceiveModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 dark:text-slate-300 font-semibold"
              >

                {t("ยกเลิก")}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !chkItems || !chkSealed || !chkProctorRole}
                className="inline-flex items-center gap-1.5 px-6 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
              >
                <PenTool className="w-4 h-4" />
                {isSubmitting ? t("กำลังบันทึก...") : t("ลงนามและยืนยันรับมอบเข้าห้องสอบ")}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Envelope Modal */}
      <EnvelopePreviewModal
        isOpen={!!envelopeExam}
        onClose={() => setEnvelopeExam(null)}
        exam={envelopeExam}
      />
    </div>
  );
};
