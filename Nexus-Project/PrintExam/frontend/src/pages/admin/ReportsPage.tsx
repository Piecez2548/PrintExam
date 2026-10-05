import React, { useState, useEffect } from 'react';
import { dashboardApi } from '../../api/dashboard';
import { DashboardSummaryData, ExamStatus } from '../../types';
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
  PieChart,
  TrendingUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

export const ReportsPage: React.FC = () => {
  const { t } = useTranslation("admin");

  const { lastEvent } = useWebSocket();
  const [data, setData] = useState<DashboardSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters (REQ-0014)
  const [examDate, setExamDate] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [status, setStatus] = useState('');
  const [room, setRoom] = useState('');

  const [envelopeExam, setEnvelopeExam] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const res = await dashboardApi.getSummary({
        exam_date: examDate || undefined,
        course_code: courseCode || undefined,
        status: status || undefined,
        room: room || undefined,
      });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [examDate, courseCode, status, room, lastEvent]);

  const handleResetFilters = () => {
    setExamDate('');
    setCourseCode('');
    setStatus('');
    setRoom('');
  };

  const activeFilterCount = [examDate, courseCode, status, room].filter(Boolean).length;

  const handleExportCsv = () => {
    if (!data || data.exams.length === 0) return;
    const csvCell = (value: unknown): string => {
      let text = String(value ?? '');
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };

    const headers = ['รหัสวิชา', 'ชื่อวิชา', 'อาจารย์ผู้สอน', 'วันสอบ', 'เวลาสอบ', 'ห้องสอบ', 'จำนวนพิมพ์', 'สถานะ', 'จนท.ดำเนินการสอบ'].map((header) => t(header));
    const rows = data.exams.map((e) => [
      csvCell(e.course_code),
      csvCell(e.course_name),
      csvCell(e.instructor_name || '-'),
      csvCell(e.exam_date || '-'),
      csvCell(`${e.start_time || ''}-${e.end_time || ''}`),
      csvCell(e.room || '-'),
      e.num_copies || 0,
      csvCell(e.status),
      csvCell(e.coordinator_name || '-'),
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
    URL.revokeObjectURL(url);
  };

  const counts = (data?.exams || []).reduce<Record<string, number>>((result, exam: any) => {
    result[exam.status] = (result[exam.status] || 0) + 1;
    result.TOTAL = (result.TOTAL || 0) + 1;
    return result;
  }, { TOTAL: 0 });

  const statusChart = [
    { label: t("รอส่ง/รอตรวจ"), value: (counts[ExamStatus.DRAFT] || 0) + (counts[ExamStatus.SUBMITTED] || 0), color: '#3b82f6' },
    { label: t("ต้องแก้ไข"), value: counts[ExamStatus.REJECTED] || 0, color: '#f43f5e' },
    { label: t("ผ่านการตรวจ"), value: counts[ExamStatus.APPROVED] || 0, color: '#14b8a6' },
    { label: t("กำลัง/พิมพ์เสร็จ"), value: (counts[ExamStatus.PRINTING] || 0) + (counts[ExamStatus.PRINTED] || 0), color: '#f59e0b' },
    { label: t("บรรจุ/พร้อมรับ"), value: (counts[ExamStatus.PACKED] || 0) + (counts[ExamStatus.READY_FOR_PICKUP] || 0), color: '#8b5cf6' },
    { label: t("ส่งมอบแล้ว"), value: counts[ExamStatus.DELIVERED] || 0, color: '#10b981' },
  ];
  const chartTotal = statusChart.reduce((sum, item) => sum + item.value, 0);
  let donutCursor = 0;
  const donutGradient = chartTotal === 0
    ? 'conic-gradient(#e2e8f0 0 100%)'
    : `conic-gradient(${statusChart.map((item) => {
        const start = donutCursor;
        donutCursor += (item.value / chartTotal) * 100;
        return `${item.color} ${start}% ${donutCursor}%`;
      }).join(', ')})`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const submissionTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const value = (data?.exams || []).filter((exam: any) => {
      if (!exam.submitted_at) return false;
      const submittedDate = new Date(exam.submitted_at);
      const submittedKey = `${submittedDate.getFullYear()}-${String(submittedDate.getMonth() + 1).padStart(2, '0')}-${String(submittedDate.getDate()).padStart(2, '0')}`;
      return submittedKey === dateKey;
    }).length;
    return { key: dateKey, label: date.toLocaleDateString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'th-TH', { day: 'numeric', month: 'short' }), value };
  });
  const trendMax = Math.max(...submissionTrend.map((item) => item.value), 1);
  const trendPoints = submissionTrend.map((item, index) => ({
    ...item,
    x: 34 + (index * 572) / 6,
    y: 176 - (item.value / trendMax) * 126,
  }));
  const trendPolyline = trendPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const trendArea = `34,176 ${trendPolyline} 606,176`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-brand-600" />
            <span>{t("สรุปภาพรวมระบบข้อสอบ")}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">

            {t("ข้อมูลภาพรวมระดับระบบชุดเดียวกันสำหรับทุกบทบาท ส่วนงานเฉพาะของแต่ละบทบาทอยู่ในเมนูของตนเอง")}
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={!data || data.exams.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/25 transition-all disabled:opacity-50"
        >
          <Download className="w-4 h-4" />

          {t("ส่งออกรายงาน (Export CSV)")}
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{t("ข้อสอบทั้งหมด")}</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {counts.TOTAL || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{data?.totalCourses || 0}  {t("รายวิชา")}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-teal-600 uppercase">{t("ตัดข้อสอบแล้ว")}</div>
          <div className="text-2xl font-black text-teal-600 mt-1">
            {counts[ExamStatus.APPROVED] || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{t("ผ่านการตรวจสอบ")}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-amber-600 uppercase">{t("กำลัง/พิมพ์เสร็จ")}</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {(counts[ExamStatus.PRINTING] || 0) + (counts[ExamStatus.PRINTED] || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{data?.totalCopies || 0}  {t("ชุดรวม")}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-purple-600 uppercase">{t("บรรจุซองแล้ว")}</div>
          <div className="text-2xl font-black text-purple-600 mt-1">
            {counts[ExamStatus.PACKED] || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{t("ติดใบปะหน้าซอง")}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-sky-600 uppercase">{t("พร้อมรับมอบ")}</div>
          <div className="text-2xl font-black text-sky-600 mt-1">
            {counts[ExamStatus.READY_FOR_PICKUP] || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{t("แจ้งศูนย์สอบแล้ว")}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-emerald-600 uppercase">{t("ส่งมอบเสร็จสิ้น")}</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {counts[ExamStatus.DELIVERED] || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{t("รับเข้าห้องสอบแล้ว")}</div>
        </div>
      </div>

      {/* Visual overview: placed directly below the dashboard KPI cards */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white"><PieChart className="h-5 w-5 text-brand-600" />  {t("สัดส่วนสถานะข้อสอบ")}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("แยกตามขั้นตอนการดำเนินงานของรายการที่แสดง")}</p>
            </div>
            <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{chartTotal}  {t("รายการ")}</span>
          </div>
          <div className="mt-6 grid items-center gap-6 sm:grid-cols-[190px_1fr]">
            <div className="relative mx-auto grid h-44 w-44 place-items-center rounded-full shadow-inner" style={{ background: donutGradient }} role="img" aria-label={t("กราฟวงแหวนแสดงสัดส่วนสถานะข้อสอบ")}>
              <div className="grid h-28 w-28 place-items-center rounded-full bg-white text-center shadow-sm dark:bg-slate-900">
                <div><div className="text-3xl font-black text-slate-900 dark:text-white">{chartTotal}</div><div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t("ข้อสอบทั้งหมด")}</div></div>
              </div>
            </div>
            <div className="space-y-3">
              {statusChart.map((item) => (
                <div key={item.label} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2.5 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">{item.label}</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{item.value}</span>
                  <span className="w-12 text-right text-xs text-slate-400">{chartTotal ? Math.round((item.value / chartTotal) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white"><TrendingUp className="h-5 w-5 text-brand-600" />  {t("แนวโน้มการส่งข้อสอบ")}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("จำนวนข้อสอบที่ส่งเข้าระบบในช่วง 7 วันล่าสุด")}</p></div>
            <span className="shrink-0 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{t("7 วันล่าสุด")}</span>
          </div>
          <div className="mt-5 overflow-hidden rounded-xl bg-gradient-to-b from-brand-50/70 to-white px-2 pt-2 dark:from-brand-950/30 dark:to-slate-900">
            <svg viewBox="0 0 640 200" className="h-52 w-full" role="img" aria-label={t("กราฟเส้นแสดงจำนวนการส่งข้อสอบ 7 วันล่าสุด")} preserveAspectRatio="none">
              {[50, 92, 134, 176].map((y) => <line key={y} x1="34" y1={y} x2="606" y2={y} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" strokeDasharray="4 5" />)}
              <defs><linearGradient id="reportSubmissionArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.28" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" /></linearGradient></defs>
              <polygon points={trendArea} fill="url(#reportSubmissionArea)" />
              <polyline points={trendPolyline} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              {trendPoints.map((point) => <g key={point.key}><circle cx={point.x} cy={point.y} r="7" fill="white" stroke="#2563eb" strokeWidth="4" vectorEffect="non-scaling-stroke" /><text x={point.x} y={Math.max(point.y - 14, 18)} textAnchor="middle" className="fill-slate-700 text-[12px] font-bold dark:fill-slate-200">{point.value}</text></g>)}
            </svg>
            <div className="grid grid-cols-7 gap-1 px-1 pb-3">{submissionTrend.map((item) => <div key={item.key} className="text-center text-[10px] font-semibold text-slate-400 sm:text-xs">{item.label}</div>)}</div>
          </div>
        </section>
      </div>

      {/* Search and filter panel */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300">
              <Filter className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">{t("ค้นหาและกรองข้อมูล")}</h2>
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">

                    {t("ใช้งาน")} {activeFilterCount}  {t("ตัวกรอง")}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t("กราฟ สถิติ และตารางจะอัปเดตตามเงื่อนไขที่เลือก")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            disabled={activeFilterCount === 0}
            className="inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:self-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />

            {t("ล้างตัวกรอง")}
          </button>
        </div>

        <div className="bg-slate-50/70 p-4 dark:bg-slate-950/30 sm:p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
            <div className="sm:col-span-2 lg:col-span-4">
              <label htmlFor="report-course-filter" className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">

                {t("ค้นหารายวิชา")}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="report-course-filter"
                  type="search"
                  placeholder={t("รหัสวิชา หรือชื่อวิชา")}
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-brand-950"
                />
              </div>
            </div>

            <div className="lg:col-span-2">
              <label htmlFor="report-date-filter" className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">{t("วันที่สอบ")}</label>
              <input id="report-date-filter" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-brand-950" />
            </div>

            <div className="lg:col-span-3">
              <label htmlFor="report-room-filter" className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">{t("ห้องสอบ")}</label>
              <input id="report-room-filter" type="search" placeholder={t("เช่น LAB-401 หรือ CB-2301")} value={room} onChange={(e) => setRoom(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-brand-950" />
            </div>

            <div className="lg:col-span-3">
              <label htmlFor="report-status-filter" className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">{t("สถานะข้อสอบ")}</label>
              <select id="report-status-filter" value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-brand-950">
                <option value="">{t("ทุกสถานะ")}</option>
                <option value={ExamStatus.SUBMITTED}>{t("ส่งแล้ว รอตรวจสอบ")}</option>
                <option value={ExamStatus.REJECTED}>{t("ไม่ผ่านตรวจสอบ")}</option>
                <option value={ExamStatus.APPROVED}>{t("อนุมัติ / ตัดข้อสอบแล้ว")}</option>
                <option value={ExamStatus.PRINTING}>{t("กำลังจัดพิมพ์")}</option>
                <option value={ExamStatus.PRINTED}>{t("พิมพ์เสร็จเรียบร้อย")}</option>
                <option value={ExamStatus.PACKED}>{t("บรรจุซองเรียบร้อย")}</option>
                <option value={ExamStatus.READY_FOR_PICKUP}>{t("พร้อมส่งมอบ")}</option>
                <option value={ExamStatus.DELIVERED}>{t("ส่งมอบแล้ว")}</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Summary Detailed Table (REQ-0014) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">{t("วันที่ & เวลาสอบ")}</th>
                <th className="py-3.5 px-4">{t("รหัสวิชา & ชื่อวิชา")}</th>
                <th className="py-3.5 px-4">{t("อาจารย์ผู้สอน")}</th>
                <th className="py-3.5 px-4">{t("ห้องสอบ")}</th>
                <th className="py-3.5 px-4">{t("จำนวนพิมพ์")}</th>
                <th className="py-3.5 px-4">{t("สถานะข้อสอบ")}</th>
                <th className="py-3.5 px-4">{t("จนท.ดำเนินการสอบ")}</th>
                <th className="py-3.5 px-4 text-right">{t("ใบปะหน้า")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">

                    {t("กำลังประมวลผลข้อมูลรายงาน...")}
                  </td>
                </tr>
              ) : !data || data.exams.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">

                    {t("ไม่พบข้อมูลข้อสอบตามเงื่อนไขที่เลือก")}
                  </td>
                </tr>
              ) : (
                data.exams.map((row: any) => (
                  <tr key={row.exam_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {row.exam_date ? new Date(row.exam_date).toLocaleDateString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'th-TH') : '-'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {row.start_time && row.end_time ? t("{{v0}}-{{v1}} น.", { v0: row.start_time, v1: row.end_time }) : ''} ({t(`examType.${row.exam_type || 'FINAL'}`, { ns: 'statuses', defaultValue: row.exam_type || 'FINAL' })})
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {row.course_code}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">{row.course_name}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{row.instructor_name}</div>
                      <div className="text-[11px] text-slate-400">{row.instructor_department}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                      {row.room || '-'}
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-800 dark:text-slate-200">
                      {row.num_copies > 0 ? t("{{v0}} ชุด", { v0: row.num_copies }) : t("ยังไม่ระบุ")}
                      <div className="text-[11px] font-normal text-slate-400">{row.num_pages || 1}  {t("หน้า/ชุด")}</div>
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
                        className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 dark:text-slate-300 hover:bg-slate-200 font-medium"
                      >
                        <FileCheck className="w-3.5 h-3.5 inline mr-1" />

                        {t("ใบปะหน้า")}
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
        showActions={false}
      />
    </div>
  );
};
