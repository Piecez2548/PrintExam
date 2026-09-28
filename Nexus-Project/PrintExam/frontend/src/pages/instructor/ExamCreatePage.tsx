import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { coursesApi } from '../../api/courses';
import { examsApi } from '../../api/exams';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Course } from '../../types';
import {
  Upload,
  FileText,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Printer,
  Save,
  Send,
  Sparkles,
} from 'lucide-react';

const EDIT_LOCK_DAYS = 2;
const DEFAULT_DEADLINE_DAYS = 5;

/** สร้างค่าวันที่เริ่มต้นสำหรับ input type=date โดยไม่ผูกกับรูปแบบวันที่บนหน้าจอ */
const createDefaultDeadline = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + DEFAULT_DEADLINE_DAYS);
  return date.toISOString().slice(0, 10);
};

/** คืนเวลาที่ระบบเริ่มล็อกการแก้ไข ซึ่งต้องก่อนกำหนดส่งตาม REQ-0005 */
const getEditLockAt = (deadlineDate: string): Date => {
  const deadline = new Date(`${deadlineDate}T23:59:59`);
  return new Date(deadline.getTime() - EDIT_LOCK_DAYS * 24 * 60 * 60 * 1000);
};

export const ExamCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields - Instructor manually inputs Course Details (REQ-0004)
  const [courseCode, setCourseCode] = useState<string>('');
  const [courseName, setCourseName] = useState<string>('');
  const [semester, setSemester] = useState<number>(1);
  const [academicYear, setAcademicYear] = useState<string>('2569');
  const [department, setDepartment] = useState<string>(user?.department || '');
  const [specialInstructions, setSpecialInstructions] = useState<string>('');
  const [numCopies, setNumCopies] = useState<number>(1);
  const [deadlineDate, setDeadlineDate] = useState<string>(createDefaultDeadline);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>('');

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const cList = await coursesApi.getCourses();
        setMyCourses(cList);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourses();
  }, []);

  const handleSelectQuickCourse = (c: Course) => {
    setCourseCode(c.course_code);
    setCourseName(c.course_name);
    setSemester(c.semester);
    setAcademicYear(c.academic_year);
    if (c.department) setDepartment(c.department);
    toast.info(`เลือกเติมข้อมูลวิชา ${c.course_code} - ${c.course_name}`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const ext = selected.name.split('.').pop()?.toLowerCase();

      if (!['pdf', 'docx', 'doc'].includes(ext || '')) {
        setFileError('รองรับเฉพาะไฟล์เอกสาร .docx, .doc หรือ .pdf เท่านั้น');
        setFile(null);
        return;
      }

      if (selected.size > 50 * 1024 * 1024) {
        setFileError('ขนาดไฟล์ต้องไม่เกิน 50MB');
        setFile(null);
        return;
      }

      setFileError('');
      setFile(selected);
    }
  };

  const handleSubmit = async (isDraft: boolean) => {
    if (!courseCode.trim()) {
      toast.warning('กรุณากรอกรหัสวิชา เช่น CPE101');
      return;
    }
    if (!courseName.trim()) {
      toast.warning('กรุณากรอกชื่อรายวิชา เช่น การเขียนโปรแกรมคอมพิวเตอร์');
      return;
    }
    if (!isDraft && !file) {
      toast.warning('กรุณาอัปโหลดไฟล์ข้อสอบก่อนส่งให้หน่วยโสตตรวจสอบ');
      return;
    }
    if (!Number.isInteger(numCopies) || numCopies < 1) {
      toast.warning('กรุณาระบุจำนวนชุดที่ต้องการพิมพ์อย่างน้อย 1 ชุด');
      return;
    }
    const deadline = new Date(`${deadlineDate}T23:59:59`);
    const lockAt = getEditLockAt(deadlineDate);
    if (!isDraft && (Number.isNaN(deadline.getTime()) || lockAt <= new Date())) {
      toast.warning('กำหนดส่งต้องห่างจากเวลาปัจจุบันมากกว่า 2 วัน');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('course_code', courseCode.trim().toUpperCase());
      formData.append('course_name', courseName.trim());
      formData.append('semester', semester.toString());
      formData.append('academic_year', academicYear);
      if (department) formData.append('department', department);
      formData.append('special_instructions', specialInstructions);
      formData.append('num_copies', numCopies.toString());
      formData.append('deadline_at', deadline.toISOString());
      formData.append('is_draft', isDraft.toString());
      if (file) {
        formData.append('file', file);
      }

      await examsApi.createExam(formData);
      toast.success(
        isDraft ? 'บันทึกฉบับร่างสำเร็จ' : 'ส่งข้อสอบเรียบร้อยแล้ว',
        'ส่งต่อไปยังหน่วยโสตทัศนูปกรณ์เพื่อตรวจสอบและกำหนดการพิมพ์'
      );
      navigate('/instructor/dashboard');
    } catch (err: any) {
      toast.error('ส่งข้อสอบไม่สำเร็จ', err.response?.data?.message || 'เกิดข้อผิดพลาดในการส่งข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/instructor/dashboard"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              แบบฟอร์มส่งข้อมูลและไฟล์ข้อสอบ
            </h1>
            <p className="text-xs text-slate-500">
              อาจารย์กรอกข้อมูลรายวิชาที่สอนและอัปโหลดไฟล์ข้อสอบเพื่อส่งให้หน่วยโสตทัศนูปกรณ์ดำเนินการ
            </p>
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Section 1: Course Input */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center font-black">
                1
              </span>
              <span>กรอกข้อมูลรายวิชาที่สอน (Course Information)</span>
            </h2>

            {myCourses.length > 0 && (
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>หรือคลิกเลือกวิชาเดิมที่เคยสอนเพื่อเติมข้อมูลด่วน:</span>
              </div>
            )}
          </div>

          {/* Quick select previously taught courses */}
          {myCourses.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {myCourses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectQuickCourse(c)}
                  className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium transition-colors"
                >
                  {c.course_code} - {c.course_name}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                รหัสวิชา (Course Code) *
              </label>
              <input
                type="text"
                required
                placeholder="เช่น CPE101, INT201, GEN121"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="w-full uppercase text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                ชื่อรายวิชา (Course Name) *
              </label>
              <input
                type="text"
                required
                placeholder="เช่น การเขียนโปรแกรมคอมพิวเตอร์เบื้องต้น"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  ภาคการศึกษา (Semester)
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                  className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 font-medium"
                >
                  <option value={1}>ภาคเรียนที่ 1</option>
                  <option value={2}>ภาคเรียนที่ 2</option>
                  <option value={3}>ภาคฤดูร้อน</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  ปีการศึกษา (Year)
                </label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                ภาควิชา / คณะ
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="เช่น วิศวกรรมคอมพิวเตอร์"
                className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Requested print quantity */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center font-black">
              2
            </span>
            <span>จำนวนชุดและรายละเอียดการพิมพ์</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                จำนวนชุดที่ต้องการพิมพ์ *
              </label>
              <div className="relative">
                <Printer className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={numCopies}
                  onChange={(e) => setNumCopies(Number(e.target.value))}
                  className="w-full pl-10 pr-14 text-base font-extrabold text-emerald-700 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">ชุด</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">หน่วยโสตจะตรวจสอบยอดนี้และบันทึกจำนวนที่พิมพ์จริงอีกครั้ง</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                กำหนดส่งข้อสอบ (Deadline) *
              </label>
              <input
                type="date"
                required
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="w-full text-sm font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5"
              />
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5">
                แก้ไขหรือยกเลิกได้ถึง {deadlineDate
                  ? getEditLockAt(deadlineDate).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
                  : '-'} (ก่อนกำหนดส่ง 2 วัน)
              </p>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              คำแนะนำพิเศษสำหรับเจ้าหน้าที่พิมพ์ (ถ้ามี เช่น การเย็บมุม, กระดาษคำตอบแยก, ซองสำรอง)
            </label>
            <textarea
              rows={2}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="ระบุข้อความหรือคำแนะนำเพิ่มเติมสำหรับหน่วยโสต..."
              className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3"
            />
          </div>
        </div>

        {/* Section 3: File Upload */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center font-black">
              3
            </span>
            <span>อัปโหลดไฟล์ต้นฉบับข้อสอบ (.docx หรือ .pdf)</span>
          </h2>

          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 rounded-2xl p-8 text-center bg-slate-50/50 dark:bg-slate-800/40 transition-colors">
            <input
              type="file"
              id="file-upload"
              accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-600 flex items-center justify-center mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                คลิกเพื่อเลือกไฟล์ข้อสอบ หรือลากไฟล์มาวางที่นี่
              </div>
              <div className="text-xs text-slate-400 mt-1">
                รองรับไฟล์ .docx, .doc, .pdf ขนาดสูงสุดไม่เกิน 50MB
              </div>
            </label>

            {file && (
              <div className="mt-4 inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-2 rounded-xl text-xs font-semibold">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>{file.name}</span>
                <span className="text-slate-400 font-normal">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}

            {fileError && (
              <div className="mt-3 text-xs text-rose-500 font-medium flex items-center justify-center gap-1">
                <AlertCircle className="w-4 h-4" />
                <span>{fileError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            * หลังจากส่งข้อสอบแล้ว เจ้าหน้าที่หน่วยโสตจะตรวจสอบความถูกต้องของไฟล์และตัดข้อสอบเพื่อดำเนินการพิมพ์
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(true)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              บันทึกแบบร่าง (Draft)
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(false)}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งข้อสอบให้หน่วยโสตตรวจ (Submit)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
