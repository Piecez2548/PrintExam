import React, { useState, useEffect } from 'react';
import { dashboardApi } from '../../api/dashboard';
import { coursesApi } from '../../api/courses';
import { usersApi } from '../../api/users';
import { DashboardSummaryData, ExamStatus, User, Course, UserRole } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EnvelopePreviewModal } from '../../components/envelope/EnvelopePreviewModal';
import { useWebSocket } from '../../context/WebSocketContext';
import {
  BarChart3,
  Download,
  Filter,
  Search,
  BookOpen,
  Users,
  Printer,
  PackageCheck,
  Truck,
  RotateCcw,
  FileCheck,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { lastEvent } = useWebSocket();
  const [data, setData] = useState<DashboardSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters (REQ-0014)
  const [examDate, setExamDate] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [status, setStatus] = useState('');
  const [room, setRoom] = useState('');
  const [coordinatorId, setCoordinatorId] = useState('');
  const [semester, setSemester] = useState('');
  const [academicYear, setAcademicYear] = useState('');

  // Dropdown lists
  const [instructors, setInstructors] = useState<User[]>([]);
  const [coordinators, setCoordinators] = useState<User[]>([]);
  const [envelopeExam, setEnvelopeExam] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const res = await dashboardApi.getSummary({
        exam_date: examDate || undefined,
        course_code: courseCode || undefined,
        instructor_id: instructorId || undefined,
        status: status || undefined,
        room: room || undefined,
        coordinator_id: coordinatorId || undefined,
        semester: semester || undefined,
        academic_year: academicYear || undefined,
      });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      const [insts, coords] = await Promise.all([
        usersApi.getUsers({ role: UserRole.INSTRUCTOR }),
        usersApi.getUsers({ role: UserRole.COORDINATOR }),
      ]);
      setInstructors(insts);
      setCoordinators(coords);
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    loadData();
  }, [examDate, courseCode, instructorId, status, room, coordinatorId, semester, academicYear, lastEvent]);

  const handleResetFilters = () => {
    setExamDate('');
    setCourseCode('');
    setInstructorId('');
    setStatus('');
    setRoom('');
    setCoordinatorId('');
    setSemester('');
    setAcademicYear('');
  };

  const handleExportCsv = () => {
    if (!data || data.exams.length === 0) return;

    const headers = ['รหัสวิชา', 'ชื่อวิชา', 'อาจารย์ผู้สอน', 'วันสอบ', 'เวลาสอบ', 'ห้องสอบ', 'จำนวนพิมพ์', 'สถานะ', 'จนท.ดำเนินการสอบ'];
    const rows = data.exams.map((e) => [
      `"${e.course_code}"`,
      `"${e.course_name}"`,
      `"${e.instructor_name || '-'}"`,
      `"${e.exam_date || '-'}"`,
      `"${e.start_time || ''}-${e.end_time || ''}"`,
      `"${e.room || '-'}"`,
      e.num_copies || 0,
      `"${e.status}"`,
      `"${e.coordinator_name || '-'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Exam_Report_Summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const counts = data?.statusCounts || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-brand-600" />
            <span>รายงานสรุปภาพรวมและสถิติข้อสอบ</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            สรุปข้อมูล วันที่สอบ/รหัสวิชา/ชื่อวิชา/อาจารย์/สถานะ/ห้องสอบ/จนท.ดำเนินการสอบ ครบทุกมิติ
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={!data || data.exams.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/25 transition-all disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          ส่งออกรายงาน (Export CSV)
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase">ข้อสอบทั้งหมด</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {counts.TOTAL || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{data?.totalCourses || 0} รายวิชา</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-teal-600 uppercase">ตัดข้อสอบแล้ว</div>
          <div className="text-2xl font-black text-teal-600 mt-1">
            {counts[ExamStatus.APPROVED] || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">ผ่านการตรวจสอบ</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-amber-600 uppercase">กำลัง/พิมพ์เสร็จ</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {(counts[ExamStatus.PRINTING] || 0) + (counts[ExamStatus.PRINTED] || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{data?.totalCopies || 0} ชุดรวม</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-purple-600 uppercase">บรรจุซองแล้ว</div>
          <div className="text-2xl font-black text-purple-600 mt-1">
            {counts[ExamStatus.PACKED] || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">ติดใบปะหน้าซอง</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-sky-600 uppercase">พร้อมรับมอบ</div>
          <div className="text-2xl font-black text-sky-600 mt-1">
            {counts[ExamStatus.READY_FOR_PICKUP] || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">แจ้งศูนย์สอบแล้ว</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-emerald-600 uppercase">ส่งมอบเสร็จสิ้น</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {counts[ExamStatus.DELIVERED] || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">รับเข้าห้องสอบแล้ว</div>
        </div>
      </div>

      {/* Multi-Filter Search Panel */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-brand-600" />
            <span>ตัวกรองค้นหาข้อมูลสรุป</span>
          </div>
          <button
            onClick={handleResetFilters}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            ล้างตัวกรองทั้งหมด
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
              รหัสหรือชื่อวิชา
            </label>
            <input
              type="text"
              placeholder="เช่น CPE101, วิศวกรรม..."
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
              อาจารย์ผู้สอน
            </label>
            <select
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
            >
              <option value="">อาจารย์ทุกคน</option>
              {instructors.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
              สถานะข้อสอบ
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
            >
              <option value="">ทุกสถานะ</option>
              <option value={ExamStatus.SUBMITTED}>ส่งแล้ว รอตรวจสอบ</option>
              <option value={ExamStatus.REJECTED}>ไม่ผ่านตรวจสอบ</option>
              <option value={ExamStatus.APPROVED}>อนุมัติ / ตัดข้อสอบแล้ว</option>
              <option value={ExamStatus.PRINTING}>กำลังจัดพิมพ์</option>
              <option value={ExamStatus.PRINTED}>พิมพ์เสร็จเรียบร้อย</option>
              <option value={ExamStatus.PACKED}>บรรจุซองเรียบร้อย</option>
              <option value={ExamStatus.READY_FOR_PICKUP}>พร้อมส่งมอบ</option>
              <option value={ExamStatus.DELIVERED}>ส่งมอบแล้ว</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
              วันที่สอบ
            </label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
              ห้องสอบ (Room)
            </label>
            <input
              type="text"
              placeholder="เช่น LAB-401, CB-2301"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
              จนท.ดำเนินการสอบ
            </label>
            <select
              value={coordinatorId}
              onChange={(e) => setCoordinatorId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
            >
              <option value="">เจ้าหน้าที่ทุกคน</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
              ภาคการศึกษา
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
            >
              <option value="">ทุกภาค</option>
              <option value="1">ภาคเรียนที่ 1</option>
              <option value="2">ภาคเรียนที่ 2</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
              ปีการศึกษา
            </label>
            <input
              type="text"
              placeholder="2569"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Summary Detailed Table (REQ-0014) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">วันที่ & เวลาสอบ</th>
                <th className="py-3.5 px-4">รหัสวิชา & ชื่อวิชา</th>
                <th className="py-3.5 px-4">อาจารย์ผู้สอน</th>
                <th className="py-3.5 px-4">ห้องสอบ</th>
                <th className="py-3.5 px-4">จำนวนพิมพ์</th>
                <th className="py-3.5 px-4">สถานะข้อสอบ</th>
                <th className="py-3.5 px-4">จนท.ดำเนินการสอบ</th>
                <th className="py-3.5 px-4 text-right">ใบปะหน้า</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    กำลังประมวลผลข้อมูลรายงาน...
                  </td>
                </tr>
              ) : !data || data.exams.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    ไม่พบข้อมูลข้อสอบตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                data.exams.map((row: any) => (
                  <tr key={row.exam_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {row.exam_date ? new Date(row.exam_date).toLocaleDateString('th-TH') : '-'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {row.start_time && row.end_time ? `${row.start_time}-${row.end_time} น.` : ''} ({row.exam_type || 'FINAL'})
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {row.course_code}
                      </div>
                      <div className="text-slate-500">{row.course_name}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{row.instructor_name}</div>
                      <div className="text-[11px] text-slate-400">{row.instructor_department}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-rose-600">
                      {row.room || '-'}
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-800 dark:text-slate-200">
                      {row.num_copies > 0 ? `${row.num_copies} ชุด` : 'ยังไม่ระบุ'}
                      <div className="text-[11px] font-normal text-slate-400">{row.num_pages || 1} หน้า/ชุด</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      {row.coordinator_name || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() =>
                          setEnvelopeExam({
                            id: row.exam_id,
                            course_code: row.course_code,
                            course_name: row.course_name,
                            instructor_name: row.instructor_name,
                            exam_date: row.exam_date,
                            start_time: row.start_time,
                            end_time: row.end_time,
                            room: row.room,
                            num_copies: row.num_copies,
                            num_pages: row.num_pages,
                            paper_size: row.paper_size,
                            is_double_sided: row.is_double_sided,
                            semester: row.semester,
                            academic_year: row.academic_year,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
                      >
                        <FileCheck className="w-3.5 h-3.5 inline mr-1" />
                        ใบปะหน้า
                      </button>
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
        isOpen={!!envelopeExam}
        onClose={() => setEnvelopeExam(null)}
        exam={envelopeExam}
      />
    </div>
  );
};
