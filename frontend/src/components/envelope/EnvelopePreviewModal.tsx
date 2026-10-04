import React from 'react';
import { Modal } from '../common/Modal';
import { Exam } from '../../types';
import { Printer, Download, QrCode, CheckSquare, ShieldCheck } from 'lucide-react';
import { examsApi } from '../../api/exams';
import { openAuthenticatedDocument } from '../../utils/secureDocument';
import { useToast } from '../../context/ToastContext';

interface EnvelopePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
}

export const EnvelopePreviewModal: React.FC<EnvelopePreviewModalProps> = ({
  isOpen,
  onClose,
  exam,
}) => {
  const toast = useToast();

  if (!exam) return null;

  const actualCopies = exam.printed_copies ?? exam.print_records?.[0]?.printed_copies ?? exam.num_copies;

  const handlePrint = async () => {
    const documentWindow = window.open('', '_blank');
    try {
      // Print the authoritative standalone PDF so the Reports page layout is
      // never included in the browser's printable document.
      await openAuthenticatedDocument(() => examsApi.getEnvelopeLabel(exam.id), documentWindow);
    } catch (err: any) {
      toast.error('เปิดเอกสารสำหรับพิมพ์ไม่สำเร็จ', err.response?.data?.message || 'คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้');
    }
  };

  const handleDownloadPdf = async () => {
    const documentWindow = window.open('', '_blank');
    try {
      await openAuthenticatedDocument(() => examsApi.getEnvelopeLabel(exam.id), documentWindow);
    } catch (err: any) {
      toast.error('เปิด PDF ไม่สำเร็จ', err.response?.data?.message || 'คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้');
    }
  };

  const trackingCode = `ENV-${exam.course_code}-${exam.id}-${exam.academic_year || '2569'}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="ใบปะหน้าซองข้อสอบมาตรฐาน (Official Exam Envelope Label)"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Actions Toolbar */}
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
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              ดาวน์โหลด PDF
            </button>
          </div>
        </div>

        {/* Printable Envelope Layout */}
        <div
          id="printable-envelope"
          className="border-2 border-slate-900 bg-white text-slate-900 p-6 rounded-lg font-sans shadow-md"
        >
          {/* Header Banner */}
          <div className="bg-slate-900 text-white p-4 rounded-t flex items-center justify-between border-b-2 border-slate-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-black text-lg border border-white/30">
                U
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-wide uppercase">
                  UNIVERSITY EXAMINATION CENTER
                </h2>
                <p className="text-xs text-slate-300">
                  ศูนย์ประสานงานการสอบและพิมพ์ข้อสอบมาตรฐานมหาวิทยาลัย
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block bg-sky-500/20 text-sky-300 border border-sky-400/40 text-xs px-2.5 py-0.5 rounded font-bold">
                ใบปะหน้าซองข้อสอบมาตรฐาน (FORM EXAM-01)
              </span>
              <div className="text-[11px] text-slate-400 mt-0.5">
                ภาคเรียนที่ {exam.semester || 1} ปีการศึกษา {exam.academic_year || '2569'}
              </div>
            </div>
          </div>

          {/* Sub Header / QR & Tracking */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border-x-2 border-b border-slate-900 bg-slate-50/50">
            <div className="md:col-span-3 space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">รหัสวิชา:</span>
                <span className="text-2xl font-black text-sky-900">{exam.course_code}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold text-slate-500">ชื่อวิชา:</span>
                <span className="text-base font-bold text-slate-800">{exam.course_name}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-700 pt-1">
                <div>
                  <strong>อาจารย์ผู้สอน:</strong> {exam.instructor_name || '-'}
                </div>
                <div>
                  <strong>ประเภทการสอบ:</strong> {exam.exam_type === 'MIDTERM' ? 'สอบกลางภาค' : 'สอบไล่ปลายภาค'}
                </div>
              </div>
            </div>

            {/* Tracking barcode/QR representation */}
            <div className="border border-slate-300 bg-white p-3 rounded flex flex-col items-center justify-center text-center">
              <QrCode className="w-12 h-12 text-slate-800 mb-1" />
              <div className="font-mono text-[10px] font-bold tracking-tight text-slate-700">{trackingCode}</div>
              <div className="text-[9px] text-slate-400">SECURITY VERIFIED</div>
            </div>
          </div>

          {/* Exam Schedule & Room Box */}
          <div className="p-4 border-x-2 border-b border-slate-900 grid grid-cols-2 md:grid-cols-4 gap-3 bg-white">
            <div className="bg-slate-100 p-2.5 rounded border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">วันสอบ (Exam Date)</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">
                {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString('th-TH') : 'ตามตารางสอบ'}
              </div>
            </div>
            <div className="bg-slate-100 p-2.5 rounded border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">เวลาสอบ (Time)</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">
                {exam.start_time && exam.end_time ? `${exam.start_time} - ${exam.end_time} น.` : 'ตามประกาศ'}
              </div>
            </div>
            <div className="bg-sky-50 p-2.5 rounded border border-sky-200">
              <div className="text-[11px] font-semibold text-sky-700">ห้องสอบ (Exam Room)</div>
              <div className="text-base font-extrabold text-sky-900 mt-0.5">
                {exam.room || 'ตามตารางจัดสอบ'}
              </div>
            </div>
            <div className="bg-slate-100 p-2.5 rounded border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">กำหนดส่งไฟล์ (Deadline)</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">
                {exam.deadline_date || 'ตามกำหนดการ'}
              </div>
            </div>
            <div className="md:col-span-4 bg-slate-50 p-2.5 rounded border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">ผู้ประสานงานการสอบ (Coordinator)</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">
                {exam.coordinator_name || 'ยังไม่กำหนด'}
              </div>
            </div>
          </div>

          {/* Printing Specs Box */}
          <div className="p-4 border-x-2 border-b border-slate-900 bg-emerald-50/50">
            <div className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>รายละเอียดการจัดพิมพ์และจำนวนชุด</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500">จำนวนที่พิมพ์:</span>
                <div className="text-xl font-black text-emerald-700">{actualCopies} ชุด</div>
              </div>
              <div>
                <span className="text-slate-500">จำนวนหน้า/ชุด:</span>
                <div className="text-sm font-bold text-slate-800">{exam.num_pages || 1} หน้า</div>
              </div>
              <div>
                <span className="text-slate-500">รูปแบบการพิมพ์:</span>
                <div className="text-sm font-bold text-slate-800">
                  {exam.is_double_sided ? 'หน้า-หลัง (Double)' : 'หน้าเดียว (Single)'} [{exam.paper_size}]
                </div>
              </div>
              <div>
                <span className="text-slate-500">หมายเหตุพิเศษ:</span>
                <div className="text-xs text-slate-700 italic">{exam.special_instructions || '-'}</div>
              </div>
            </div>
          </div>

          {/* Verification & Sign-off Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-x-2 border-b-2 border-slate-900 divide-y md:divide-y-0 md:divide-x divide-slate-300 text-xs">
            {/* Column 1: AV Staff */}
            <div className="p-3 bg-white space-y-2">
              <div className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">
                1. หน่วยโสตทัศนศึกษา (พิมพ์ & บรรจุ)
              </div>
              <div className="space-y-1 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>ตรวจจำนวนครบถ้วน ({actualCopies} ชุด)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>ปิดผนึกซองและซีลเรียบร้อย</span>
                </div>
              </div>
              <div className="pt-2 text-[11px] text-slate-500">
                <div>ผู้บรรจุ: ............................................</div>
                <div className="mt-1">วันที่: ...... / ...... / ..........</div>
              </div>
            </div>

            {/* Column 2: Dispatch / Handover */}
            <div className="p-3 bg-white space-y-2">
              <div className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">
                2. การส่งมอบข้อสอบ (Dispatch)
              </div>
              <div className="space-y-1 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 border border-slate-400 rounded-xs" />
                  <span>ส่งมอบซองข้อสอบครบตามจำนวน</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 border border-slate-400 rounded-xs" />
                  <span>ซีลอยู่ในสภาพสมบูรณ์ ไม่มีการเปิด</span>
                </div>
              </div>
              <div className="pt-2 text-[11px] text-slate-500">
                <div>ผู้ส่งมอบ: ............................................</div>
                <div className="mt-1">วันที่: ...... / ...... / ..........  เวลา: ........</div>
              </div>
            </div>

            {/* Column 3: Coordinator Receiving */}
            <div className="p-3 bg-white space-y-2">
              <div className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">
                3. จนท.ดำเนินการสอบ (ผู้รับมอบ)
              </div>
              <div className="space-y-1 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 border border-slate-400 rounded-xs" />
                  <span>ได้รับซองข้อสอบตามวิชา/ห้องสอบ</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 border border-slate-400 rounded-xs" />
                  <span>นำส่งเข้าห้องสอบตามกำหนดการ</span>
                </div>
              </div>
              <div className="pt-2 text-[11px] text-slate-500">
                <div>ผู้รับมอบ: {exam.coordinator_name || '............................................'}</div>
                <div className="mt-1">วันที่: ...... / ...... / ..........  เวลา: ........</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
