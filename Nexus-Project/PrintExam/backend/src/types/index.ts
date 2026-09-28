import { UserRole, ExamStatus } from '../config/constants';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  full_name: string;
  email: string;
  role: UserRole;
  department?: string;
  phone?: string;
  is_active: number; // 1 or 0
  two_factor_secret?: string;
  two_factor_temp_code?: string;
  two_factor_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UserDTO {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  department?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface Course {
  id: number;
  course_code: string;
  course_name: string;
  instructor_id: number;
  instructor_name?: string;
  instructor_email?: string;
  department?: string;
  semester: number;
  academic_year: string;
  created_at: string;
  updated_at: string;
}

export interface ExamSchedule {
  id: number;
  course_id: number;
  course_code?: string;
  course_name?: string;
  instructor_id?: number;
  instructor_name?: string;
  exam_type: 'MIDTERM' | 'FINAL' | 'QUIZ';
  exam_date: string;
  start_time: string;
  end_time: string;
  room: string;
  coordinator_id?: number;
  coordinator_name?: string;
  deadline_date: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED';
  created_at: string;
  updated_at: string;
}

export interface Exam {
  id: number;
  course_id: number;
  schedule_id?: number;
  course_code?: string;
  course_name?: string;
  instructor_id?: number;
  instructor_name?: string;
  instructor_email?: string;
  exam_date?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
  file_url?: string;
  original_filename?: string;
  file_type?: string;
  file_size?: number;
  num_copies: number;
  num_pages: number;
  special_instructions?: string;
  is_double_sided: number; // 1 or 0
  paper_size: string;
  status: ExamStatus;
  rejection_reason?: string;
  created_by: number;
  creator_name?: string;
  submitted_at?: string;
  deadline_at: string;
  created_at: string;
  updated_at: string;
  // Summary counts
  status_history?: ExamStatusHistory[];
}

export interface ExamStatusHistory {
  id: number;
  exam_id: number;
  from_status?: string;
  to_status: string;
  action_by: number;
  action_name: string;
  action_at: string;
  note?: string;
}

export interface EnvelopeLabel {
  id: number;
  exam_id: number;
  label_code: string;
  generated_by: number;
  generator_name?: string;
  generated_at: string;
  details_json: string;
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

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: number; // 1 or 0
  created_at: string;
}

export interface AuditLog {
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
