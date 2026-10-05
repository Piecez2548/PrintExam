export enum UserRole {
  INSTRUCTOR = 'INSTRUCTOR',
  AV_STAFF = 'AV_STAFF',
  COORDINATOR = 'COORDINATOR',
  ADMIN = 'ADMIN',
}

export enum ExamStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  REJECTED = 'REJECTED',
  APPROVED = 'APPROVED',
  PRINTING = 'PRINTING',
  PRINTED = 'PRINTED',
  PACKED = 'PACKED',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  department?: string;
  phone?: string;
  office_room?: string;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

export interface Course {
  id: number;
  course_code: string;
  course_name: string;
  department?: string;
  instructor_id: number;
  instructor_name?: string;
  instructor_email?: string;
  instructor_department?: string;
  section?: string;
  semester: number;
  student_count?: number;
  academic_year: string;
  created_at: string;
}

export interface ExamSchedule {
  id: number;
  course_id: number;
  course_code: string;
  course_name: string;
  instructor_id?: number;
  instructor_name?: string;
  exam_type: 'MIDTERM' | 'FINAL' | 'QUIZ';
  exam_date: string;
  start_time: string;
  end_time: string;
  room: string;
  section?: string;
  student_count?: number;
  coordinator_id?: number;
  coordinator_name?: string;
  coordinator_phone?: string;
  deadline_date: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED';
  submission_id?: number;
  created_at: string;
}

export interface ExamStatusHistory {
  id: number;
  exam_id: number;
  from_status?: string;
  to_status: string;
  action_by: number;
  action_name: string;
  action_role?: string;
  action_at: string;
  note?: string;
}

export interface ExamAuditTrailItem {
  id: number;
  event_type: 'STATUS_CHANGE' | 'DATA_EDIT';
  action_at: string;
  action_name: string;
  action_role?: string;
  action_by?: number | null;
  to_status?: string;
  from_status?: string | null;
  note?: string | null;
  action?: string;
  entity_type?: string;
  entity_id?: string | null;
  exam_id?: number;
  changes?: Record<string, { before: unknown; after: unknown }>;
}

export interface PrintRecord {
  id: number;
  exam_id: number;
  printed_by: number;
  printer_name?: string;
  printed_copies: number;
  paper_type: string;
  printed_at: string;
  notes?: string;
}

export interface PackingRecord {
  id: number;
  exam_id: number;
  packed_by: number;
  packer_name?: string;
  packed_at: string;
  envelope_count: number;
  notes?: string;
}

export interface DeliveryRecord {
  id: number;
  exam_id: number;
  handed_over_by: number;
  handover_name?: string;
  received_by: number;
  receiver_name?: string;
  delivered_at: string;
  receiver_signature_note?: string;
}

export interface Exam {
  id: number;
  course_id: number;
  schedule_id?: number;
  course_code: string;
  course_name: string;
  department?: string;
  semester?: number;
  academic_year?: string;
  instructor_id?: number;
  instructor_name?: string;
  instructor_email?: string;
  instructor_phone?: string;
  instructor_office_room?: string;
  exam_date?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
  exam_type?: string;
  file_url?: string;
  original_filename?: string;
  file_type?: string;
  file_size?: number;
  num_copies: number;
  student_count?: number;
  reserve_copies?: number;
  printed_copies?: number;
  num_pages: number;
  exam_language?: string;
  print_format?: string;
  allowed_materials?: string;
  requires_answer_sheet?: boolean;
  exam_session_type?: string;
  section?: string;
  special_instructions?: string;
  is_double_sided: number | boolean;
  paper_size: string;
  status: ExamStatus;
  rejection_reason?: string;
  created_by: number;
  submitted_at?: string;
  deadline_at: string;
  created_at: string;
  updated_at: string;
  coordinator_name?: string;
  status_history?: ExamStatusHistory[];
  audit_trail?: ExamAuditTrailItem[];
  print_records?: PrintRecord[];
  packing_records?: PackingRecord[];
  delivery_records?: DeliveryRecord[];
  can_edit_or_cancel?: boolean;
  edit_restriction_reason?: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: number | boolean;
  created_at: string;
}

export interface AuditLogItem {
  id: number;
  user_id?: number;
  user_name?: string;
  user_role?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  ip_address?: string;
  detail_json?: string;
  created_at: string;
}

export interface DashboardSummaryData {
  statusCounts: Record<string, number>;
  totalCopies: number;
  totalCourses: number;
  exams: any[];
}
