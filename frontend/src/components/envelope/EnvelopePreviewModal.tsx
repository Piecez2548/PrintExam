import React from 'react';
import { Modal } from '../common/Modal';
import { Exam } from '../../types';
import { Printer, Download } from 'lucide-react';
import { examsApi } from '../../api/exams';
import { downloadAuthenticatedResource } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { resolveEnvelopeCoverSheet } from '../../utils/envelopeCoverSheet';

interface EnvelopePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
  showActions?: boolean;
}

export const EnvelopePreviewModal: React.FC<EnvelopePreviewModalProps> = ({
  isOpen,
  onClose,
  exam,
  showActions = true,
}) => {
  const { t } = useTranslation("coverSheet");

  const toast = useToast();
  if (!exam) return null;

  const cover = resolveEnvelopeCoverSheet(exam, i18n.resolvedLanguage || 'th');

  const handlePrint = async () => {
    const printable = document.getElementById('printable-envelope');
    if (!printable) return;

    await document.fonts.ready;
    await Promise.all(Array.from(printable.querySelectorAll('img')).map((image) =>
      image.decode().catch(() => undefined)
    ));
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
    window.print();
  };

  const handleDownloadPdf = async () => {
    await downloadAuthenticatedResource(
      examsApi.getEnvelopeLabelUrl(exam.id),
      `Envelope_Label_${exam.course_code || exam.id}.pdf`
    );
  };

  const lineClass = 'inline-block min-h-5 border-b border-dotted border-slate-700 px-2 font-semibold';
  const mark = (selected: boolean) => selected ? '( / )' : '(   )';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("ใบปะหน้าซองข้อสอบมาตรฐาน (Official Exam Envelope Label)")}
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Actions are omitted on the shared overview; operational pages retain them. */}
        {showActions && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-xs text-slate-600 dark:text-slate-300">

              {t("ระบบสร้างใบปะหน้าซองอัตโนมัติ พร้อมแถบตรวจสอบความปลอดภัย")}
            </div>
            <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />

              {t("สั่งพิมพ์ใบปะหน้า")}
            </button>
            <button
              onClick={() =>
                void handleDownloadPdf().catch(() =>
                  toast.error(t("ดาวน์โหลดไม่สำเร็จ"), t("ไม่สามารถสร้างหรือดาวน์โหลดใบปะหน้าได้"))
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />

              {t("ดาวน์โหลด PDF")}
            </button>
            </div>
          </div>
        )}

        {/* Printable Envelope Layout - follows the faculty's original envelope form */}
        <div
          id="printable-envelope"
          className="border-2 border-slate-900 bg-white p-6 text-[13px] text-slate-900 shadow-md"
        >
          <div className="mb-5 text-center">
            <img src="/images/psu-official-logo.png" alt={t("ตรามหาวิทยาลัยสงขลานครินทร์")} className="mx-auto h-20 w-auto object-contain" />
            <div className="mt-1 text-lg font-extrabold">{cover.department}</div>
            <div className="text-base font-bold">{t("มหาวิทยาลัยสงขลานครินทร์")}</div>
          </div>

          <div className="space-y-3">
            <div className="print-cover-grid-course grid grid-cols-[auto_1fr] gap-2 md:grid-cols-[auto_1fr_auto_11rem]">
              <span>{t("การสอบวิชา")}</span><span className={lineClass}>{cover.courseName}</span>
              <span>{t("รหัสวิชา")}</span><span className={lineClass}>{cover.courseCode}</span>
            </div>
            <div className="flex flex-wrap items-end gap-x-2 gap-y-2">
              <span>{t("สอบวันที่")}</span><span className={`${lineClass} w-14 text-center`}>{cover.examDay}</span>
              <span>{t("เดือน")}</span><span className={`${lineClass} w-28 text-center`}>{cover.examMonth}</span>
              <span>{t("พ.ศ.")}</span><span className={`${lineClass} w-16 text-center`}>{cover.examYear}</span>
              <span>{t("เวลา")}</span><span className={`${lineClass} min-w-40 text-center`}>{cover.examTime === '-' ? '-' : `${cover.examTime} ${t("น.")}`}</span>
            </div>
            <div className="print-cover-grid-details grid grid-cols-[auto_1fr] gap-2 md:grid-cols-[auto_1fr_auto_1fr]">
              <span>{t("ห้องสอบ")}</span><span className={lineClass}>{cover.examRoom}</span>
              <span>{t("เลขประจำซอง")}</span><span className={lineClass}>{cover.envelopeIdentifier}</span>
            </div>
            <div className="flex flex-wrap items-end gap-x-2 gap-y-2">
              <span>{t("จำนวนนักศึกษา")}</span><span className={`${lineClass} w-16 text-center`}>{cover.studentCount}</span><span>{t("คน")}</span>
            </div>
            <div className="flex flex-wrap items-end gap-x-2 gap-y-2">
              <span>{t("นศ.คณะ")}</span><span className={`${lineClass} min-w-52`}>{cover.department}</span>
              <span>{t("ตอน")}</span><span className={`${lineClass} w-20 text-center`}>{cover.section}</span>
              <span className="ml-4">{t("ซองนี้มีข้อสอบ")}</span><span className={`${lineClass} w-16 text-center`}>{cover.examCopyCount}</span><span>{t("ชุด")}</span>
            </div>
            <div className="flex items-end gap-2">
              <span>{t("ข้อสอบสำรอง")}</span><span className={`${lineClass} w-14 text-center`}>{cover.reserveCopyCount}</span><span>{t("ชุด")}</span>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-center text-sm font-extrabold">{t("อุปกรณ์ที่ใช้หรือคำแนะนำผู้คุมสอบเพิ่มเติม")}</div>
            <div className="print-cover-grid-options mt-3 grid gap-x-8 gap-y-2 md:grid-cols-2">
              <div>{mark(cover.permittedBooks)}  {t("นำตำราเข้าห้องสอบได้")}</div><div>{mark(Boolean(cover.specialInstructions))} {cover.specialInstructions || <span className="inline-block w-4/5 border-b border-dotted border-slate-600">&nbsp;</span>}</div>
              <div>{mark(cover.permittedCalculator)}  {t("นำเครื่องคิดเลขเข้าห้องสอบได้")}</div><div>( &nbsp; ) <span className="inline-block w-4/5 border-b border-dotted border-slate-600">&nbsp;</span></div>
              <div>{mark(cover.prohibitsFormulaRuler)}  {t("ห้ามนำไม้บรรทัดมีสูตรคณิตศาสตร์เข้าห้องสอบ")}</div><div>( &nbsp; ) <span className="inline-block w-4/5 border-b border-dotted border-slate-600">&nbsp;</span></div>
            </div>
            <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
              <span>{t("ผู้ออกข้อสอบ")}</span><span className={lineClass}>{cover.instructorName}</span>
            </div>
            <div className="print-cover-grid-details mt-3 grid grid-cols-[auto_1fr] gap-2 md:grid-cols-[auto_1fr_auto_1fr]">
              <span>{t("ห้องทำงาน")}</span><span className={lineClass}>{cover.officeRoom === '-' ? '' : cover.officeRoom}</span>
              <span>{t("โทรศัพท์/มือถือ")}</span><span className={lineClass}>{cover.instructorPhone === '-' ? '' : cover.instructorPhone}</span>
            </div>
          </div>

          <div className="mt-5 border border-slate-900 p-4">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div>{t("จำนวนนักศึกษาที่เข้าสอบ")} <span className="inline-block w-20 border-b border-dotted border-slate-700">&nbsp;</span>  {t("คน")}</div>
              <div>{t("จำนวนนักศึกษาที่ขาดสอบ")} <span className="inline-block w-20 border-b border-dotted border-slate-700">&nbsp;</span>  {t("คน คือ")}</div>
            </div>
            <div className="mt-3 grid grid-cols-[2rem_9rem_1fr] border-b border-slate-500 pb-1 text-center font-bold"><span></span><span>{t("รหัส")}</span><span>{t("ชื่อ-สกุล")}</span></div>
            {[1, 2, 3].map((number) => (
              <div key={number} className="grid grid-cols-[2rem_9rem_1fr] items-end py-2"><span>{number}.</span><span className="border-b border-dotted border-slate-600">&nbsp;</span><span className="ml-4 border-b border-dotted border-slate-600">&nbsp;</span></div>
            ))}
            <div className="mx-auto mt-4 max-w-md space-y-3">
              {[1, 2, 3].map((number) => <div key={number} className="flex items-end gap-2"><span>{number}.</span><span className="flex-1 border-b border-dotted border-slate-600">&nbsp;</span><span>{t("ผู้คุมสอบ")}</span></div>)}
            </div>
            <div className="mt-4">{t("หมายเหตุ")} <span className="inline-block w-[85%] border-b border-dotted border-slate-600">&nbsp;</span></div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
