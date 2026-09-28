import React, { useState, useEffect } from 'react';
import { coursesApi } from '../../api/courses';
import { schedulesApi } from '../../api/schedules';
import { usersApi } from '../../api/users';
import { Course, ExamSchedule, User, UserRole } from '../../types';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  CalendarCheck,
  Plus,
  Edit,
  CheckCircle2,
  Search,
  BookOpen,
  Calendar,
  Clock,
  MapPin,
  AlertTriangle,
  Filter,
  Layers,
} from 'lucide-react';

// Helper to format Date to strict YYYY-MM-DD
const toDateInputValue = (val?: string | Date): string => {
  if (!val) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper for Thai full date display
const formatThaiDateFull = (val?: string): string => {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const CourseSchedulePage: React.FC = () => {
  const toast = useToast();
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [instructors, setInstructors] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'courses' | 'schedules'>('courses');
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterInstructorId, setFilterInstructorId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add/Edit Schedule Modal State - Only MIDTERM and FINAL
  const [isSchedModalOpen, setIsSchedModalOpen] = useState(false);
  const [schedCourseId, setSchedCourseId] = useState('');
  const [schedType, setSchedType] = useState<'FINAL' | 'MIDTERM'>('FINAL');
  const [schedDate, setSchedDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [room, setRoom] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [editingSchedId, setEditingSchedId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [cList, sList, uList] = await Promise.all([
        coursesApi.getCourses({ all: true }),
        schedulesApi.getSchedules({ all: true }),
        usersApi.getUsers({ role: UserRole.INSTRUCTOR }),
      ]);
      setCourses(cList);
      setSchedules(sList);
      setInstructors(uList);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered lists
  const filteredCourses = courses.filter((c) => {
    const matchInstructor = !filterInstructorId || c.instructor_id.toString() === filterInstructorId;
    const matchSearch =
      !searchQuery ||
      c.course_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.course_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.instructor_name && c.instructor_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchInstructor && matchSearch;
  });

  const filteredSchedules = schedules.filter((s) => {
    const matchInstructor =
      !filterInstructorId ||
      courses.find((c) => c.id === s.course_id)?.instructor_id.toString() === filterInstructorId;
    const matchSearch =
      !searchQuery ||
      s.course_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.course_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.instructor_name && s.instructor_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchInstructor && matchSearch;
  });

  // Courses that DO NOT have an exam schedule yet
  const scheduledCourseIds = new Set(schedules.map((s) => s.course_id));
  const coursesWithoutSchedule = courses.filter((c) => !scheduledCourseIds.has(c.id));

  const handleExamDateChange = (val: string) => {
    setSchedDate(val);
    if (val) {
      const examD = new Date(val);
      if (!isNaN(examD.getTime())) {
        const deadline = new Date(examD);
        deadline.setDate(deadline.getDate() - 5);
        setDeadlineDate(toDateInputValue(deadline));
      }
    }
  };

  // Save Schedule
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedCourseId || !schedDate || !startTime || !endTime || !room || !deadlineDate) {
      toast.warning('กรุณากรอกข้อมูลกำหนดการสอบให้ครบถ้วน');
      return;
    }

    try {
      if (editingSchedId) {
        await schedulesApi.updateSchedule(editingSchedId, {
          course_id: Number(schedCourseId),
          exam_type: schedType,
          exam_date: schedDate,
          start_time: startTime,
          end_time: endTime,
          room,
          deadline_date: deadlineDate,
        });
        toast.success('แก้ไขกำหนดการสอบสำเร็จ');
      } else {
        await schedulesApi.createSchedule({
          course_id: Number(schedCourseId),
          exam_type: schedType,
          exam_date: schedDate,
          start_time: startTime,
          end_time: endTime,
          room,
          deadline_date: deadlineDate,
        });
        toast.success('กำหนดวันสอบและห้องสอบเรียบร้อยแล้ว');
      }
      setIsSchedModalOpen(false);
      resetSchedForm();
      fetchData();
    } catch (err: any) {
      toast.error('ไม่สามารถบันทึกได้', err.response?.data?.message);
    }
  };

  const resetSchedForm = () => {
    setSchedCourseId(courses.length > 0 ? courses[0].id.toString() : '');
    setSchedType('FINAL');
    const defaultExam = new Date();
    defaultExam.setDate(defaultExam.getDate() + 14);
    const defaultExamStr = toDateInputValue(defaultExam);
    setSchedDate(defaultExamStr);

    const defaultDead = new Date(defaultExam);
    defaultDead.setDate(defaultDead.getDate() - 5);
    setDeadlineDate(toDateInputValue(defaultDead));

    setStartTime('09:00');
    setEndTime('12:00');
    setRoom('');
    setEditingSchedId(null);
  };

  const handleOpenAddScheduleForCourse = (courseId: number) => {
    resetSchedForm();
    setSchedCourseId(courseId.toString());
    setIsSchedModalOpen(true);
  };

  const handleOpenAddSchedule = () => {
    resetSchedForm();
    setIsSchedModalOpen(true);
  };

  const handleOpenEditSchedule = (sched: ExamSchedule) => {
    setEditingSchedId(sched.id);
    setSchedCourseId(sched.course_id.toString());
    setSchedType(sched.exam_type === 'MIDTERM' ? 'MIDTERM' : 'FINAL');
    setSchedDate(toDateInputValue(sched.exam_date));
    setStartTime(sched.start_time || '09:00');
    setEndTime(sched.end_time || '12:00');
    setRoom(sched.room || '');
    setDeadlineDate(toDateInputValue(sched.deadline_date));
    setIsSchedModalOpen(true);
  };

  const handleConfirmSchedule = async (schedId: number) => {
    try {
      await schedulesApi.confirmSchedule(schedId);
      toast.success('ยืนยันกำหนดการสอบเรียบร้อยแล้ว');
      fetchData();
    } catch (err: any) {
      toast.error('ไม่สามารถยืนยันได้', err.response?.data?.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <CalendarCheck className="w-6 h-6 text-blue-600" />
            <span>รายวิชาที่จัดสอบและกำหนดการสอบ</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            เจ้าหน้าที่ดำเนินการสอบตรวจสอบรายวิชาที่อาจารย์เปิดสอบ กำหนดวันสอบ ห้องสอบ และ Deadline การส่งข้อสอบ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAddSchedule}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            + กำหนดวันสอบ/ห้องสอบ
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">รายวิชาทั้งหมดที่จัดสอบ</div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              {courses.length} วิชา
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">กำหนดวันสอบแล้ว</div>
            <div className="text-xl font-extrabold text-emerald-600 mt-0.5">
              {schedules.length} วิชา
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">รอกำหนดวันสอบ/ห้องสอบ</div>
            <div className="text-xl font-extrabold text-amber-600 mt-0.5">
              {coursesWithoutSchedule.length} วิชา
            </div>
          </div>
        </div>
      </div>

      {/* Pending Schedules Alert Banner */}
      {coursesWithoutSchedule.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <div className="font-bold text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                มี {coursesWithoutSchedule.length} รายวิชาที่ยังไม่ได้กำหนดวันสอบและห้องสอบ
              </div>
              <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                อาจารย์ต้องการวันสอบและ Deadline ในระบบเพื่อใช้ส่งข้อสอบ: {coursesWithoutSchedule.map((c) => c.course_code).slice(0, 4).join(', ')}
                {coursesWithoutSchedule.length > 4 ? '...' : ''}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              if (coursesWithoutSchedule.length > 0) {
                handleOpenAddScheduleForCourse(coursesWithoutSchedule[0].id);
              }
            }}
            className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            กำหนดวันสอบทันที
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหารหัสวิชา, ชื่อวิชา, อาจารย์..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto text-xs">
          <span className="text-slate-500 font-medium whitespace-nowrap flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> อาจารย์:
          </span>
          <select
            value={filterInstructorId}
            onChange={(e) => setFilterInstructorId(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
          >
            <option value="">อาจารย์ทุกคน ({instructors.length} ท่าน)</option>
            {instructors.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.full_name} ({inst.department || 'อาจารย์'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('courses')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'courses'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>รายชื่อวิชาที่จะจัดสอบ ({filteredCourses.length} วิชา)</span>
        </button>

        <button
          onClick={() => setActiveTab('schedules')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'schedules'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>ตารางกำหนดการสอบและห้องสอบ ({filteredSchedules.length} รายการ)</span>
        </button>
      </div>

      {/* Tab Content 1: Courses Table */}
      {activeTab === 'courses' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">รหัสวิชา</th>
                  <th className="py-3.5 px-4">ชื่อรายวิชา</th>
                  <th className="py-3.5 px-4">อาจารย์ผู้สอน (Instructor)</th>
                  <th className="py-3.5 px-4">ภาคการศึกษา / ปี</th>
                  <th className="py-3.5 px-4">สถานะกำหนดการสอบ</th>
                  <th className="py-3.5 px-4 text-right">การกำหนดวันสอบ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCourses.map((course) => {
                  const hasSchedule = scheduledCourseIds.has(course.id);
                  return (
                    <tr key={course.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {course.course_code}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {course.course_name}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{course.instructor_name}</div>
                        <div className="text-[11px] text-slate-400">{course.instructor_email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        ภาค {course.semester} / {course.academic_year}
                      </td>
                      <td className="py-3.5 px-4">
                        {hasSchedule ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> กำหนดวันสอบแล้ว
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" /> รอกำหนดวันสอบ
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {!hasSchedule ? (
                          <button
                            onClick={() => handleOpenAddScheduleForCourse(course.id)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shadow-xs"
                          >
                            + กำหนดวันสอบ
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const sched = schedules.find((s) => s.course_id === course.id);
                              if (sched) handleOpenEditSchedule(sched);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
                          >
                            ดู / แก้ไขวันสอบ
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content 2: Schedules Table */}
      {activeTab === 'schedules' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">รหัสวิชา & รายวิชา</th>
                  <th className="py-3.5 px-4">อาจารย์ผู้สอน</th>
                  <th className="py-3.5 px-4">ประเภทการสอบ</th>
                  <th className="py-3.5 px-4">วันสอบ & เวลา</th>
                  <th className="py-3.5 px-4">ห้องสอบ (Room)</th>
                  <th className="py-3.5 px-4">Deadline ส่งข้อสอบ</th>
                  <th className="py-3.5 px-4">สถานะ</th>
                  <th className="py-3.5 px-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : filteredSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      ยังไม่มีกำหนดการสอบตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  filteredSchedules.map((sched) => (
                    <tr key={sched.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {sched.course_code}
                        </div>
                        <div className="text-slate-500">{sched.course_name}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {sched.instructor_name || '-'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {courses.find((c) => c.id === sched.course_id)?.instructor_email || ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                          {sched.exam_type === 'MIDTERM' ? 'กลางภาค' : 'ปลายภาค'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {new Date(sched.exam_date).toLocaleDateString('th-TH')}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {sched.start_time} - {sched.end_time} น.
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-rose-600">
                        {sched.room}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {new Date(sched.deadline_date).toLocaleDateString('th-TH')}
                      </td>
                      <td className="py-3.5 px-4">
                        {sched.status === 'CONFIRMED' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> ยืนยันแล้ว
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                            <Clock className="w-3.5 h-3.5" /> รอการยืนยัน
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        {sched.status !== 'CONFIRMED' && (
                          <button
                            onClick={() => handleConfirmSchedule(sched.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
                          >
                            ยืนยัน
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEditSchedule(sched)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
                        >
                          แก้ไข
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      <Modal
        isOpen={isSchedModalOpen}
        onClose={() => setIsSchedModalOpen(false)}
        title={editingSchedId ? 'แก้ไขกำหนดการสอบและห้องสอบ' : 'กำหนดวันสอบและห้องสอบ'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveSchedule} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              รายวิชาที่จัดสอบ *
            </label>
            <select
              value={schedCourseId}
              onChange={(e) => setSchedCourseId(e.target.value)}
              required
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course_code} - {c.course_name} (อาจารย์: {c.instructor_name})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ประเภทการสอบ *
              </label>
              <select
                value={schedType}
                onChange={(e: any) => setSchedType(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
              >
                <option value="MIDTERM">สอบกลางภาค (Midterm Exam)</option>
                <option value="FINAL">สอบไล่ปลายภาค (Final Exam)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  วันที่จัดสอบ (Exam Date) *
                </label>
              </div>
              <input
                type="date"
                value={schedDate}
                onChange={(e) => handleExamDateChange(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
              />
              {schedDate && (
                <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
                  {formatThaiDateFull(schedDate)}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                เวลาเริ่มสอบ
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                เวลาสิ้นสุด
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              ห้องสอบ (Exam Room) *
            </label>
            <input
              type="text"
              placeholder="เช่น ห้องบรรยาย CB-2301, CB-2302"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              required
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              วันสุดท้ายที่อาจารย์ต้องส่งไฟล์ (Deadline Date) *
            </label>
            <input
              type="date"
              value={deadlineDate}
              onChange={(e) => setDeadlineDate(e.target.value)}
              required
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
            />
            {deadlineDate && (
              <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                Deadline: {formatThaiDateFull(deadlineDate)} (อาจารย์สามารถแก้ไขข้อสอบได้ก่อนกำหนดนี้อย่างน้อย 2 วัน)
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsSchedModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-sm"
            >
              บันทึกกำหนดการ
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
