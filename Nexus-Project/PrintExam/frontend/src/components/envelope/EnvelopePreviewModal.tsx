import React from 'react';
import { Modal } from '../common/Modal';
import { Exam } from '../../types';
import { Printer, Download } from 'lucide-react';
import { examsApi } from '../../api/exams';
import { downloadAuthenticatedResource } from '../../api/client';
import { useToast } from '../../context/ToastContext';

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
  const toast = useToast();
  if (!exam) return null;

  const actualCopies = exam.printed_copies ?? exam.print_records?.[0]?.printed_copies ?? exam.num_copies;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    await downloadAuthenticatedResource(
      examsApi.getEnvelopeLabelUrl(exam.id),
      `Envelope_Label_${exam.course_code || exam.id}.pdf`
    );
  };

  const trackingCode = `ENV-${exam.course_code}-${exam.id}-${exam.academic_year || '2569'}`;
  const examDate = exam.exam_date ? new Date(exam.exam_date) : null;
  const validExamDate = examDate && !Number.isNaN(examDate.getTime());
  const examDay = validExamDate ? examDate.getDate() : '-';
  const examMonth = validExamDate ? examDate.toLocaleDateString('th-TH', { month: 'long' }) : '-';
  const examYear = validExamDate ? examDate.getFullYear() + 543 : exam.academic_year || '-';
  const lineClass = 'inline-block min-h-5 border-b border-dotted border-slate-700 px-2 font-semibold';
  let selectedMaterials: string[] = [];
  try {
    const parsed = exam.allowed_materials ? JSON.parse(exam.allowed_materials) : [];
    selectedMaterials = Array.isArray(parsed) ? parsed : [];
  } catch {
    selectedMaterials = [];
  }
  const mark = (selected: boolean) => selected ? '( / )' : '(   )';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="ใบปะหน้าซองข้อสอบมาตรฐาน (Official Exam Envelope Label)"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Actions are omitted on the shared overview; operational pages retain them. */}
        {showActions && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              ระบบสร้างใบปะหน้าซองอัตโนมัติ พร้อมแถบตรวจสอบความปลอดภัย
            </div>
            <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              สั่งพิมพ์ใบปะหน้า
            </button>
            <button
              onClick={() =>
                void handleDownloadPdf().catch(() =>
                  toast.error('ดาวน์โหลดไม่สำเร็จ', 'ไม่สามารถสร้างหรือดาวน์โหลดใบปะหน้าได้')
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              ดาวน์โหลด PDF
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
            <img src="/images/psu-official-logo.png" alt="ตรามหาวิทยาลัยสงขลานครินทร์" className="mx-auto h-20 w-auto object-contain" />
            <div className="mt-1 text-lg font-extrabold">คณะวิทยาศาสตร์</div>
            <div className="text-base font-bold">มหาวิทยาลัยสงขลานครินทร์</div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-[auto_1fr] gap-2 md:grid-cols-[auto_1fr_auto_11rem]">
              <span>การสอบวิชา</span><span className={lineClass}>{exam.course_name}</span>
              <span>รหัสวิชา</span><span className={lineClass}>{exam.course_code}</span>
            </div>
            <div className="flex flex-wrap items-end gap-x-2 gap-y-2">
              <span>สอบวันที่</span><span className={`${lineClass} w-14 text-center`}>{examDay}</span>
              <span>เดือน</span><span className={`${lineClass} w-28 text-center`}>{examMonth}</span>
              <span>พ.ศ.</span><span className={`${lineClass} w-16 text-center`}>{examYear}</span>
              <span>เวลา</span><span className={`${lineClass} min-w-40 text-center`}>{exam.start_time && exam.end_time ? `${exam.start_time} - ${exam.end_time}` : '-'} น.</span>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-2 md:grid-cols-[auto_1fr_auto_1fr]">
              <span>ห้องสอบ</span><span className={lineClass}>{exam.room || '-'}</span>
              <span>เลขประจำซอง</span><span className={lineClass}>{trackingCode}</span>
            </div>
            <div className="flex flex-wrap items-end gap-x-2 gap-y-2">
              <span>จำนวนนักศึกษา</span><span className={`${lineClass} w-16 text-center`}>{exam.student_count ?? Math.max(actualCopies - (exam.reserve_copies ?? 2), 1)}</span><span>คน</span>
            </div>
            <div className="flex flex-wrap items-end gap-x-2 gap-y-2">
              <span>นศ.คณะ</span><span className={`${lineClass} min-w-52`}>วิทยาศาสตร์</span>
              <span>ตอน</span><span className={`${lineClass} w-20 text-center`}>{exam.section || '-'}</span>
              <span className="ml-4">ซองนี้มีข้อสอบ</span><span className={`${lineClass} w-16 text-center`}>{actualCopies}</span><span>ชุด</span>
            </div>
            <div className="flex items-end gap-2">
              <span>ข้อสอบสำรอง</span><span className={`${lineClass} w-14 text-center`}>{exam.reserve_copies ?? 2}</span><span>ชุด</span>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-center text-sm font-extrabold">อุปกรณ์ที่ใช้หรือคำแนะนำผู้คุมสอบเพิ่มเติม</div>
            <div className="mt-3 grid gap-x-8 gap-y-2 md:grid-cols-2">
              <div>{mark(selectedMaterials.includes('BOOK'))} นำตำราเข้าห้องสอบได้</div><div>{mark(Boolean(exam.special_instructions))} {exam.special_instructions || 'อื่น ๆ โปรดระบุ'}</div>
              <div>{mark(selectedMaterials.includes('CALCULATOR'))} นำเครื่องคิดเลขเข้าห้องสอบได้</div><div>( &nbsp; ) <span className="inline-block w-4/5 border-b border-dotted border-slate-600">&nbsp;</span></div>
              <div>{mark(selectedMaterials.includes('NO_FORMULA_RULER'))} ห้ามนำไม้บรรทัดมีสูตรคณิตศาสตร์เข้าห้องสอบ</div><div>( &nbsp; ) <span className="inline-block w-4/5 border-b border-dotted border-slate-600">&nbsp;</span></div>
            </div>
            <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
              <span>ผู้ออกข้อสอบ</span><span className={lineClass}>{exam.instructor_name || '-'}</span>
            </div>
            <div className="mt-3 grid grid-cols-[auto_1fr] gap-2 md:grid-cols-[auto_1fr_auto_1fr]">
              <span>ห้องทำงาน</span><span className={lineClass}>{exam.instructor_office_room || ''}</span>
              <span>โทรศัพท์/มือถือ</span><span className={lineClass}>{exam.instructor_phone || ''}</span>
            </div>
          </div>

          <div className="mt-5 border border-slate-900 p-4">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div>จำนวนนักศึกษาที่เข้าสอบ <span className="inline-block w-20 border-b border-dotted border-slate-700">&nbsp;</span> คน</div>
              <div>จำนวนนักศึกษาที่ขาดสอบ <span className="inline-block w-20 border-b border-dotted border-slate-700">&nbsp;</span> คน คือ</div>
            </div>
            <div className="mt-3 grid grid-cols-[2rem_9rem_1fr] border-b border-slate-500 pb-1 text-center font-bold"><span></span><span>รหัส</span><span>ชื่อ-สกุล</span></div>
            {[1, 2, 3].map((number) => (
              <div key={number} className="grid grid-cols-[2rem_9rem_1fr] items-end py-2"><span>{number}.</span><span className="border-b border-dotted border-slate-600">&nbsp;</span><span className="ml-4 border-b border-dotted border-slate-600">&nbsp;</span></div>
            ))}
            <div className="mx-auto mt-4 max-w-md space-y-3">
              {[1, 2, 3].map((number) => <div key={number} className="flex items-end gap-2"><span>{number}.</span><span className="flex-1 border-b border-dotted border-slate-600">&nbsp;</span><span>ผู้คุมสอบ</span></div>)}
            </div>
            <div className="mt-4">หมายเหตุ <span className="inline-block w-[85%] border-b border-dotted border-slate-600">&nbsp;</span></div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
