import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Clock3, FileUp, Info, Printer, Save, Send } from 'lucide-react';
import { examsApi } from '../../api/exams';
import { coursesApi } from '../../api/courses';
import { schedulesApi } from '../../api/schedules';
import { Course, ExamSchedule } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const MATERIAL_OPTIONS = [
  { value: 'BOOK', label: 'อนุญาตนำตำราเข้าห้องสอบ' },
  { value: 'CALCULATOR', label: 'อนุญาตเครื่องคิดเลข' },
  { value: 'NO_FORMULA_RULER', label: 'ไม่อนุญาตไม้บรรทัดสูตร' },
  { value: 'NONE', label: 'ไม่มีอุปกรณ์เพิ่มเติม' },
];

export const ExamCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [allSchedules, setAllSchedules] = useState<ExamSchedule[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [scheduleId, setScheduleId] = useState('');
  const [studentCount, setStudentCount] = useState(1);
  const [reserveCopies, setReserveCopies] = useState(2);
  const [section, setSection] = useState('');
  const [numPages, setNumPages] = useState(1);
  const [examLanguage, setExamLanguage] = useState('THAI');
  const [printFormat, setPrintFormat] = useState('DOUBLE_SIDED');
  const [materials, setMaterials] = useState<string[]>(['NONE']);
  const [otherMaterial, setOtherMaterial] = useState('');
  const [requiresAnswerSheet, setRequiresAnswerSheet] = useState(false);
  const [examSessionType, setExamSessionType] = useState('IN_SCHEDULE');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([coursesApi.getCourses(), schedulesApi.getSchedules()])
      .then(([courseItems, scheduleItems]) => {
        const available = scheduleItems.filter((item) => item.status !== 'CANCELLED' && !item.submission_id);
        setCourses(courseItems);
        setAllSchedules(scheduleItems);
        setSchedules(available);
        if (available.length === 1) setScheduleId(String(available[0].id));
      })
      .catch(() => toast.error('โหลดรายวิชาและตารางสอบไม่สำเร็จ'))
      .finally(() => setLoadingSchedules(false));
  }, []);

  const selected = useMemo(() => schedules.find((item) => item.id === Number(scheduleId)), [schedules, scheduleId]);
  const unavailableCourses = useMemo(() => courses
    .filter((course) => !schedules.some((schedule) => schedule.course_id === course.id))
    .map((course) => {
      const relatedSchedules = allSchedules.filter((schedule) => schedule.course_id === course.id);
      let reason = 'รอเจ้าหน้าที่กำหนดวัน เวลา และห้องสอบ';
      if (relatedSchedules.some((schedule) => schedule.status !== 'CANCELLED' && schedule.submission_id)) {
        reason = 'ส่งข้อสอบสำหรับรอบที่กำหนดแล้วเรียบร้อย';
      } else if (relatedSchedules.length > 0 && relatedSchedules.every((schedule) => schedule.status === 'CANCELLED')) {
        reason = 'ตารางสอบถูกยกเลิก รอเจ้าหน้าที่กำหนดใหม่';
      }
      return { course, reason };
    }), [courses, allSchedules, schedules]);
  const totalCopies = studentCount + reserveCopies;

  useEffect(() => {
    if (selected?.student_count && selected.student_count > 0) setStudentCount(selected.student_count);
    setSection(selected?.section || '');
  }, [selected?.id]);

  const toggleMaterial = (value: string) => {
    setMaterials((current) => {
      if (value === 'NONE') return current.includes('NONE') ? [] : ['NONE'];
      const withoutNone = current.filter((item) => item !== 'NONE');
      return withoutNone.includes(value) ? withoutNone.filter((item) => item !== value) : [...withoutNone, value];
    });
  };

  const submit = async (isDraft: boolean) => {
    if (!selected) {
      toast.warning('กรุณาเลือกตารางสอบที่เจ้าหน้าที่กำหนดไว้');
      return;
    }
    if (!isDraft && !file) {
      toast.warning('กรุณาแนบไฟล์ข้อสอบก่อนส่ง');
      return;
    }
    if (studentCount < 1 || reserveCopies < 0) {
      toast.warning('กรุณาตรวจสอบจำนวนผู้เข้าสอบและชุดสำรอง');
      return;
    }

    const selectedMaterials = [...materials];
    if (otherMaterial.trim()) selectedMaterials.push(`OTHER:${otherMaterial.trim()}`);
    const data = new FormData();
    data.append('schedule_id', String(selected.id));
    data.append('course_id', String(selected.course_id));
    data.append('student_count', String(studentCount));
    data.append('reserve_copies', String(reserveCopies));
    data.append('section', section.trim());
    data.append('num_copies', String(totalCopies));
    data.append('num_pages', String(numPages));
    data.append('exam_language', examLanguage);
    data.append('print_format', printFormat);
    data.append('is_double_sided', String(printFormat === 'DOUBLE_SIDED' || printFormat === 'BOOKLET'));
    data.append('paper_size', 'A4');
    data.append('allowed_materials', JSON.stringify(selectedMaterials));
    data.append('requires_answer_sheet', String(requiresAnswerSheet));
    data.append('exam_session_type', examSessionType);
    data.append('special_instructions', specialInstructions);
    data.append('is_draft', String(isDraft));
    if (file) data.append('file', file);

    try {
      setSubmitting(true);
      const result = await examsApi.createExam(data);
      toast.success(result.message);
      navigate(`/instructor/exams/${result.data.id}`);
    } catch (error: any) {
      toast.error('ส่งข้อสอบไม่สำเร็จ', error.response?.data?.message || 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="max-w-5xl mx-auto p-5 sm:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">ฟอร์มส่งข้อสอบ</h1>
        <p className="text-sm text-slate-500 mt-1">วัน เวลา ห้องสอบ และกำหนดส่ง ดึงจากตารางที่เจ้าหน้าที่ดำเนินการสอบกำหนดไว้</p>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-4 flex gap-3 text-sm text-blue-900 dark:text-blue-200">
        <Info className="w-5 h-5 shrink-0" />
        <div><strong>ขั้นตอน:</strong> เจ้าหน้าที่บันทึกตารางและแจ้งอาจารย์ → อาจารย์เลือกตารางและส่งไฟล์ → หน่วยโสตตรวจ/พิมพ์/บรรจุ → เจ้าหน้าที่รับมอบ</div>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4"><CalendarCheck className="w-5 h-5" /> 1. เลือกตารางสอบที่เจ้าหน้าที่กำหนด</h2>
        {loadingSchedules ? (
          <div className="text-sm text-slate-500">กำลังโหลดตารางสอบ...</div>
        ) : schedules.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="font-bold">ยังไม่มีรายวิชาที่พร้อมส่งข้อสอบ</div>
            <div className="mt-1">รายวิชาจะเลือกได้ทันทีหลังเจ้าหน้าที่บันทึกวัน เวลา ห้องสอบ และกำหนดส่งข้อสอบ</div>
          </div>
        ) : (
          <select className={inputClass} value={scheduleId} onChange={(e) => setScheduleId(e.target.value)} required>
            <option value="">-- เลือกรายวิชาและรอบสอบ --</option>
            {schedules.map((item) => <option key={item.id} value={item.id}>{item.course_code} - {item.course_name} | {item.exam_date} {item.start_time}-{item.end_time} | {item.room}</option>)}
          </select>
        )}

        {selected && (
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><div className="text-xs text-slate-500">รายวิชา / ตอน</div><div className="font-bold mt-1">{selected.course_code}</div><div>{selected.course_name}{selected.section ? ` ตอน ${selected.section}` : ''}</div></div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><div className="text-xs text-slate-500">วันและเวลา</div><div className="font-bold mt-1">{new Date(selected.exam_date).toLocaleDateString('th-TH')}</div><div>{selected.start_time} - {selected.end_time} น.</div></div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><div className="text-xs text-slate-500">ห้องสอบ</div><div className="font-bold mt-1 text-rose-600">{selected.room}</div><div>{selected.exam_type === 'MIDTERM' ? 'กลางภาค' : selected.exam_type === 'FINAL' ? 'ปลายภาค' : 'ย่อย'}</div></div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><div className="text-xs text-slate-500">กำหนดส่ง</div><div className="font-bold mt-1 text-amber-700">{new Date(selected.deadline_date).toLocaleDateString('th-TH')}</div><div className="text-xs text-slate-500 mt-1">ภายใน 23:59 น.</div></div>
          </div>
        )}

        {!loadingSchedules && unavailableCourses.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Clock3 className="h-4 w-4 text-amber-500" />
              รายวิชาที่เพิ่มแล้วแต่ยังเลือกส่งไม่ได้ ({unavailableCourses.length})
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {unavailableCourses.map(({ course, reason }) => (
                <div key={course.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div>
                    <span className="font-extrabold text-slate-900 dark:text-white">{course.course_code}</span>
                    <span className="ml-2 text-slate-500">{course.course_name}{course.section ? ` ตอน ${course.section}` : ''}</span>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-300">{reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
        <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><Printer className="w-5 h-5" /> 2. รายละเอียดการจัดพิมพ์</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="text-sm font-semibold">ตอน<input type="text" maxLength={20} className={`${inputClass} mt-1.5`} value={section} onChange={(e) => setSection(e.target.value)} placeholder="เช่น 01" /><span className="block text-xs text-slate-500 mt-1">แก้ไขได้หากตอนในตารางสอบยังไม่ตรง</span></label>
          <label className="text-sm font-semibold">จำนวนผู้เข้าสอบ<input type="number" min={1} className={`${inputClass} mt-1.5`} value={studentCount} onChange={(e) => setStudentCount(Number(e.target.value))} /></label>
          <label className="text-sm font-semibold">ชุดสำรอง<input type="number" min={0} max={20} className={`${inputClass} mt-1.5`} value={reserveCopies} onChange={(e) => setReserveCopies(Number(e.target.value))} /><span className="block text-xs text-slate-500 mt-1">ค่าแนะนำตามแบบ: 2 ชุด</span></label>
          <label className="text-sm font-semibold">จำนวนชุดรวม<input readOnly className={`${inputClass} mt-1.5 bg-slate-100 dark:bg-slate-800 font-bold`} value={totalCopies} /></label>
          <label className="text-sm font-semibold">จำนวนหน้า/ชุด<input type="number" min={1} className={`${inputClass} mt-1.5`} value={numPages} onChange={(e) => setNumPages(Number(e.target.value))} /></label>
          <label className="text-sm font-semibold">ภาษาข้อสอบ<select className={`${inputClass} mt-1.5`} value={examLanguage} onChange={(e) => setExamLanguage(e.target.value)}><option value="THAI">ภาษาไทย</option><option value="ENGLISH">ภาษาอังกฤษ</option><option value="BILINGUAL">ไทยและอังกฤษ</option></select></label>
          <label className="text-sm font-semibold">รูปแบบการพิมพ์<select className={`${inputClass} mt-1.5`} value={printFormat} onChange={(e) => setPrintFormat(e.target.value)}><option value="SINGLE_SIDED">หน้าเดียว</option><option value="DOUBLE_SIDED">หน้า-หลัง</option><option value="BOOKLET">แบบเล่ม</option><option value="OTHER">รูปแบบอื่น</option></select></label>
          <label className="text-sm font-semibold">ประเภทการสอบ<select className={`${inputClass} mt-1.5`} value={examSessionType} onChange={(e) => setExamSessionType(e.target.value)}><option value="IN_SCHEDULE">ในตารางสอบ</option><option value="OUT_OF_SCHEDULE">นอกตารางสอบ</option></select></label>
          <label className="text-sm font-semibold">กระดาษคำตอบคอมพิวเตอร์<select className={`${inputClass} mt-1.5`} value={requiresAnswerSheet ? 'yes' : 'no'} onChange={(e) => setRequiresAnswerSheet(e.target.value === 'yes')}><option value="no">ไม่ใช้</option><option value="yes">ใช้</option></select></label>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">อุปกรณ์/คำแนะนำสำหรับผู้คุมสอบ</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {MATERIAL_OPTIONS.map((option) => <label key={option.value} className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm"><input type="checkbox" checked={materials.includes(option.value)} onChange={() => toggleMaterial(option.value)} /> {option.label}</label>)}
          </div>
          <input className={`${inputClass} mt-3`} value={otherMaterial} onChange={(e) => setOtherMaterial(e.target.value)} placeholder="อื่น ๆ โปรดระบุ" />
        </div>

        <label className="block text-sm font-semibold">คำอธิบายเพิ่มเติม<textarea rows={3} className={`${inputClass} mt-1.5`} value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} placeholder="เช่น การเย็บมุม การแยกชุด หรือหมายเหตุสำคัญ" /></label>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4"><FileUp className="w-5 h-5" /> 3. แนบไฟล์ข้อสอบ</h2>
        <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:py-2.5 file:font-bold file:text-brand-700 hover:file:bg-brand-100" />
        <p className="text-xs text-slate-500 mt-2">รองรับ PDF, DOC และ DOCX ระบบจะตรวจชนิดไฟล์จริงก่อนรับเอกสาร</p>
      </section>

      <div className="flex flex-col sm:flex-row justify-end gap-3">
        <button type="button" disabled={submitting || !selected} onClick={() => submit(true)} className="inline-flex justify-center items-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold disabled:opacity-50"><Save className="w-4 h-4" /> บันทึกแบบร่าง</button>
        <button type="button" disabled={submitting || !selected || !file} onClick={() => submit(false)} className="inline-flex justify-center items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 text-sm font-bold disabled:opacity-50"><Send className="w-4 h-4" /> {submitting ? 'กำลังบันทึก...' : 'ส่งข้อสอบ'}</button>
      </div>

      <div className="text-xs text-slate-500">ผู้ส่ง: {user?.full_name} · อีเมล: {user?.email}</div>
    </div>
  );
};
