import React, { useEffect, useState } from 'react';
import { BookOpen, CalendarClock, Plus, Users } from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { schedulesApi } from '../../api/schedules';
import { Course, ExamSchedule } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const termLabel = (semester: number) => semester === 3 ? 'ซัมเมอร์' : `ภาค ${semester}`;

export const MyCoursesPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [section, setSection] = useState('');
  const [semester, setSemester] = useState(1);
  const [academicYear, setAcademicYear] = useState('2569');
  const [studentCount, setStudentCount] = useState(1);

  const loadData = async () => {
    try {
      setLoading(true);
      const [courseItems, scheduleItems] = await Promise.all([
        coursesApi.getCourses(),
        schedulesApi.getSchedules(),
      ]);
      setCourses(courseItems);
      setSchedules(scheduleItems);
    } catch {
      toast.error('โหลดรายวิชาไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    try {
      setSaving(true);
      await coursesApi.createCourse({
        course_code: courseCode,
        course_name: courseName,
        instructor_id: user.id,
        department: user.department,
        section,
        semester,
        academic_year: academicYear,
        student_count: studentCount,
      });
      toast.success('เพิ่มรายวิชาที่สอนแล้ว', 'เจ้าหน้าที่ดำเนินการสอบจะเห็นวิชานี้เพื่อกำหนดตารางสอบ');
      setCourseCode('');
      setCourseName('');
      setSection('');
      setStudentCount(1);
      setShowForm(false);
      await loadData();
    } catch (error: any) {
      toast.error('เพิ่มรายวิชาไม่สำเร็จ', error.response?.data?.message || 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="max-w-6xl mx-auto p-5 sm:p-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2"><BookOpen className="w-6 h-6" /> รายวิชาที่ฉันสอน</h1>
          <p className="text-sm text-slate-500 mt-1">แจ้งรายวิชาที่เปิดสอนก่อน แล้วเจ้าหน้าที่ดำเนินการสอบจะกำหนดกลางภาค/ปลายภาค วัน เวลา และห้องสอบ</p>
        </div>
        <button onClick={() => setShowForm((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 text-sm font-bold"><Plus className="w-4 h-4" /> เพิ่มรายวิชาที่สอน</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-brand-200 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-950/20 p-5">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">ข้อมูลรายวิชาที่เปิดสอน</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="text-sm font-semibold">รหัสวิชา *<input className={`${inputClass} mt-1.5 uppercase`} value={courseCode} onChange={(e) => setCourseCode(e.target.value)} required placeholder="เช่น CS101" /></label>
            <label className="text-sm font-semibold lg:col-span-2">ชื่อรายวิชา *<input className={`${inputClass} mt-1.5`} value={courseName} onChange={(e) => setCourseName(e.target.value)} required /></label>
            <label className="text-sm font-semibold">ตอน<select className={`${inputClass} mt-1.5`} value={section} onChange={(e) => setSection(e.target.value)}><option value="">ไม่ระบุ</option>{['01','02','03','04','05','06','07','08','09','10'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="text-sm font-semibold">ภาคการศึกษา *<select className={`${inputClass} mt-1.5`} value={semester} onChange={(e) => setSemester(Number(e.target.value))}><option value={1}>ภาค 1</option><option value={2}>ภาค 2</option><option value={3}>ซัมเมอร์</option></select></label>
            <label className="text-sm font-semibold">ปีการศึกษา *<input className={`${inputClass} mt-1.5`} value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} required /></label>
            <label className="text-sm font-semibold">จำนวนนักศึกษา *<input type="number" min={1} className={`${inputClass} mt-1.5`} value={studentCount} onChange={(e) => setStudentCount(Number(e.target.value))} required /></label>
          </div>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold">ยกเลิก</button><button disabled={saving} className="rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-bold disabled:opacity-50">{saving ? 'กำลังบันทึก...' : 'บันทึกรายวิชา'}</button></div>
        </form>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500"><tr><th className="p-4">รายวิชา</th><th className="p-4">ภาคเรียน</th><th className="p-4">นักศึกษา</th><th className="p-4">ตารางสอบ</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? <tr><td colSpan={4} className="p-10 text-center text-slate-400">กำลังโหลด...</td></tr> : courses.length === 0 ? <tr><td colSpan={4} className="p-10 text-center text-slate-400">ยังไม่มีรายวิชา กรุณาเพิ่มรายวิชาที่คุณสอน</td></tr> : courses.map((course) => {
                const courseSchedules = schedules.filter((schedule) => schedule.course_id === course.id);
                return <tr key={course.id} className="align-top"><td className="p-4"><div className="font-bold text-slate-900 dark:text-white">{course.course_code}{course.section ? ` ตอน ${course.section}` : ''}</div><div className="text-slate-500 mt-0.5">{course.course_name}</div></td><td className="p-4 font-medium">{termLabel(course.semester)} / {course.academic_year}</td><td className="p-4"><span className="inline-flex items-center gap-1.5"><Users className="w-4 h-4 text-slate-400" /> {course.student_count || 1} คน</span></td><td className="p-4">{courseSchedules.length === 0 ? <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg text-xs font-bold"><CalendarClock className="w-4 h-4" /> รอเจ้าหน้าที่กำหนด</span> : <div className="space-y-1">{courseSchedules.map((schedule) => <div key={schedule.id} className="text-xs"><span className="font-bold">{schedule.exam_type === 'MIDTERM' ? 'กลางภาค' : schedule.exam_type === 'FINAL' ? 'ปลายภาค' : 'สอบย่อย'}</span> · {schedule.exam_date} {schedule.start_time}-{schedule.end_time} · {schedule.room} <span className={schedule.status !== 'CANCELLED' ? 'text-emerald-600' : 'text-rose-600'}>({schedule.status !== 'CANCELLED' ? 'พร้อมส่งข้อสอบ' : 'ยกเลิกแล้ว'})</span></div>)}</div>}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
          {loading ? <div className="p-8 text-center text-sm text-slate-400">กำลังโหลด...</div> : courses.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">ยังไม่มีรายวิชา กรุณาเพิ่มรายวิชาที่คุณสอน</div> : courses.map((course) => {
            const courseSchedules = schedules.filter((schedule) => schedule.course_id === course.id);
            return <article key={course.id} className="space-y-3 p-4"><div><div className="font-extrabold text-slate-900 dark:text-white">{course.course_code}{course.section ? ` ตอน ${course.section}` : ''}</div><div className="text-sm text-slate-500">{course.course_name}</div></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-semibold dark:bg-slate-800">{termLabel(course.semester)} / {course.academic_year}</span><span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 font-semibold dark:bg-slate-800"><Users className="h-3.5 w-3.5" /> {course.student_count || 1} คน</span></div>{courseSchedules.length === 0 ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700"><CalendarClock className="h-4 w-4" /> รอเจ้าหน้าที่กำหนดตารางสอบ</span> : <div className="space-y-2">{courseSchedules.map((schedule) => <div key={schedule.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700"><div className="font-bold">{schedule.exam_type === 'MIDTERM' ? 'กลางภาค' : schedule.exam_type === 'FINAL' ? 'ปลายภาค' : 'สอบย่อย'}</div><div className="mt-1 text-slate-500">{new Date(schedule.exam_date).toLocaleDateString('th-TH')} · {schedule.start_time}-{schedule.end_time}</div><div className="text-brand-600">{schedule.room}</div></div>)}</div>}</article>;
          })}
        </div>
      </div>
    </div>
  );
};
