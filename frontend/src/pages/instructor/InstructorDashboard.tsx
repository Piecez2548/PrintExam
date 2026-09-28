import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { examsApi } from '../../api/exams';
import { Exam, ExamStatus } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useWebSocket } from '../../context/WebSocketContext';
import {
  FilePlus2,
  FileText,
  Clock,
  CheckCircle2,
  Printer,
  PackageCheck,
  Truck,
  Eye,
  AlertCircle,
  Search,
} from 'lucide-react';

export const InstructorDashboard: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { lastEvent } = useWebSocket();

  const fetchExams = async () => {
    try {
      setIsLoading(true);
      const data = await examsApi.getExams({
        search: searchQuery || undefined,
        status: statusFilter || undefined,
      });
      setExams(data);
    } catch (err) {
      console.error('Error fetching instructor exams:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [searchQuery, statusFilter, lastEvent]);

  // Status Metrics
  const submittedCount = exams.filter((e) => e.status === ExamStatus.SUBMITTED).length;
  const approvedCount = exams.filter((e) => e.status === ExamStatus.APPROVED).length;
  const printingCount = exams.filter((e) => e.status === ExamStatus.PRINTING || e.status === ExamStatus.PRINTED).length;
  const packedCount = exams.filter((e) => e.status === ExamStatus.PACKED || e.status === ExamStatus.READY_FOR_PICKUP).length;
  const deliveredCount = exams.filter((e) => e.status === ExamStatus.DELIVERED).length;
  const rejectedCount = exams.filter((e) => e.status === ExamStatus.REJECTED).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            แดชบอร์ดข้อสอบ (อาจารย์ผู้สอน)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            ติดตามสถานะข้อสอบแบบ Real-time
          </p>
        </div>
        <Link
          to="/instructor/exams/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-brand-500/25 transition-all"
        >
          <FilePlus2 className="w-4 h-4" />
          ส่งข้อสอบใหม่
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">รอตรวจสอบ</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{submittedCount}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-teal-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">ตัดข้อสอบแล้ว</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{approvedCount}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">กำลังพิมพ์</span>
            <Printer className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{printingCount}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-purple-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">บรรจุซอง</span>
            <PackageCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{packedCount}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">ส่งมอบแล้ว</span>
            <Truck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{deliveredCount}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">ต้องแก้ไข</span>
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-rose-600">{rejectedCount}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหารหัสวิชา หรือชื่อวิชา..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
          >
            <option value="">ทุกสถานะ (All Statuses)</option>
            <option value={ExamStatus.SUBMITTED}>ส่งแล้ว รอตรวจสอบ</option>
            <option value={ExamStatus.REJECTED}>ไม่ผ่านตรวจสอบ</option>
            <option value={ExamStatus.APPROVED}>อนุมัติ / ตัดข้อสอบแล้ว</option>
            <option value={ExamStatus.PRINTING}>กำลังจัดพิมพ์</option>
            <option value={ExamStatus.PACKED}>บรรจุซองเรียบร้อย</option>
            <option value={ExamStatus.DELIVERED}>ส่งมอบแล้ว</option>
          </select>
        </div>
      </div>

      {/* Exams Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">รหัสวิชา & ชื่อรายวิชา</th>
                <th className="py-3.5 px-4">วัน-เวลาสอบ & ห้องสอบ</th>
                <th className="py-3.5 px-4">จำนวนพิมพ์</th>
                <th className="py-3.5 px-4">ไฟล์ข้อสอบ</th>
                <th className="py-3.5 px-4">สถานะ (Real-time)</th>
                <th className="py-3.5 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    กำลังโหลดข้อมูลข้อสอบ...
                  </td>
                </tr>
              ) : exams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    ไม่พบรายการข้อสอบ
                  </td>
                </tr>
              ) : (
                exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {exam.course_code}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">{exam.course_name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        ภาค {exam.semester}/{exam.academic_year}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString('th-TH') : '-'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {exam.start_time && exam.end_time ? `${exam.start_time} - ${exam.end_time} น.` : ''}
                      </div>
                      <div className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                        {exam.room || 'ตามตารางสอบ'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                      {exam.num_copies > 0 ? `${exam.num_copies} ชุด` : 'ยังไม่ระบุ'}
                      <div className="text-[11px] font-normal text-slate-400">
                        {exam.num_pages || 1} หน้า/ชุด ({exam.is_double_sided ? 'หน้า-หลัง' : 'หน้าเดียว'})
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {exam.file_url ? (
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <FileText className="w-4 h-4 text-brand-500 shrink-0" />
                          <span className="truncate max-w-[140px]" title={exam.original_filename}>
                            {exam.original_filename || 'ไฟล์ข้อสอบ'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">ไม่มีไฟล์</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={exam.status} />
                      {exam.status === ExamStatus.REJECTED && exam.rejection_reason && (
                        <div className="text-[11px] text-rose-600 mt-1 line-clamp-1" title={exam.rejection_reason}>
                          เหตุผล: {exam.rejection_reason}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/instructor/exams/${exam.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 hover:text-brand-600 font-semibold transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        รายละเอียด
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
