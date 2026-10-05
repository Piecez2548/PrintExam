type AuditTranslator = (key: string, options?: Record<string, unknown>) => string;

export type AuditFieldChange = { before: unknown; after: unknown };

const FIELD_ALIASES: Record<string, string> = {
  numCopies: 'num_copies',
  studentCount: 'student_count',
  reserveCopies: 'reserve_copies',
  specialInstructions: 'special_instructions',
};

const FIELD_FALLBACKS: Record<string, { th: string; en: string }> = {
  course_id: { th: 'รายวิชา', en: 'Course' },
  schedule_id: { th: 'ตารางสอบ', en: 'Exam schedule' },
  deadline_at: { th: 'กำหนดส่ง', en: 'Submission deadline' },
  original_filename: { th: 'ชื่อไฟล์ข้อสอบ', en: 'Exam file name' },
  file_type: { th: 'ชนิดไฟล์', en: 'File type' },
  file_size: { th: 'ขนาดไฟล์', en: 'File size' },
  file: { th: 'ไฟล์ข้อสอบ', en: 'Exam file' },
  num_copies: { th: 'จำนวนชุดที่ต้องการพิมพ์', en: 'Number of Copies' },
  student_count: { th: 'จำนวนนักศึกษา', en: 'Student Count' },
  reserve_copies: { th: 'จำนวนสำเนาสำรอง', en: 'Reserve Copies' },
  section: { th: 'ตอนเรียน/กลุ่ม', en: 'Section' },
  num_pages: { th: 'จำนวนหน้า', en: 'Page count' },
  exam_language: { th: 'ภาษาข้อสอบ', en: 'Exam language' },
  print_format: { th: 'รูปแบบการพิมพ์', en: 'Print format' },
  allowed_materials: { th: 'อุปกรณ์ที่อนุญาต', en: 'Allowed materials' },
  requires_answer_sheet: { th: 'ต้องใช้กระดาษคำตอบ', en: 'Answer sheet required' },
  exam_session_type: { th: 'ประเภทชุดสอบ', en: 'Exam session type' },
  special_instructions: { th: 'คำสั่งพิเศษ', en: 'Special Instructions' },
  is_double_sided: { th: 'พิมพ์สองหน้า', en: 'Double-sided printing' },
  paper_size: { th: 'ขนาดกระดาษ', en: 'Paper size' },
  exam_type: { th: 'ประเภทการสอบ', en: 'Exam type' },
  exam_date: { th: 'วันสอบ', en: 'Exam date' },
  start_time: { th: 'เวลาเริ่ม', en: 'Start time' },
  end_time: { th: 'เวลาสิ้นสุด', en: 'End time' },
  room: { th: 'ห้องสอบ', en: 'Exam room' },
  coordinator_id: { th: 'ผู้ประสานงาน', en: 'Coordinator' },
  deadline_date: { th: 'กำหนดส่งข้อสอบ', en: 'Submission deadline' },
  course_code: { th: 'รหัสวิชา', en: 'Course code' },
  course_name: { th: 'ชื่อรายวิชา', en: 'Course name' },
  instructor_id: { th: 'อาจารย์ผู้สอน', en: 'Instructor' },
  department: { th: 'คณะ/หน่วยงาน', en: 'Department' },
  semester: { th: 'ภาคการศึกษา', en: 'Semester' },
  academic_year: { th: 'ปีการศึกษา', en: 'Academic year' },
};

function translatedOrFallback(t: AuditTranslator, key: string, fallback: string, ns = 'common'): string {
  const translated = t(key, { ns, defaultValue: fallback });
  return translated && translated !== key ? translated : fallback;
}

export function getAuditTitle(entityType: string, t: AuditTranslator, language: 'th' | 'en'): string {
  const keys: Record<string, string> = {
    EXAM: 'audit.examUpdated',
    SCHEDULE: 'audit.scheduleUpdated',
    COURSE: 'audit.courseUpdated',
  };
  const key = keys[entityType];
  const fallback = language === 'en' ? 'Information updated' : 'แก้ไขข้อมูล';
  return key ? translatedOrFallback(t, key, fallback) : fallback;
}

export function getAuditFieldLabel(field: string, t: AuditTranslator, language: 'th' | 'en'): string {
  const canonicalField = FIELD_ALIASES[field] || field;
  const fallback = FIELD_FALLBACKS[canonicalField]?.[language]
    || (language === 'en' ? 'Other information' : 'ข้อมูลอื่น');
  return translatedOrFallback(t, `audit.fields.${canonicalField}`, fallback);
}

export function getAuditRoleLabel(role: string, t: AuditTranslator, language: 'th' | 'en'): string {
  const fallback = role.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase());
  return translatedOrFallback(t, `role.${role}`, fallback, 'statuses');
}

function isUnset(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

export function getVisibleAuditChanges<T extends AuditFieldChange>(changes: Record<string, T>): Array<[string, T]> {
  return Object.entries(changes).filter(([, change]) => !(isUnset(change.before) && isUnset(change.after)));
}

export function formatAuditValue(
  value: unknown,
  t: AuditTranslator,
  language: 'th' | 'en',
  field?: string,
): string {
  if (isUnset(value)) {
    return translatedOrFallback(t, 'audit.valueNotSet', language === 'en' ? 'Not specified' : 'ไม่ได้ระบุ');
  }
  if (typeof value === 'boolean') {
    return translatedOrFallback(t, value ? 'audit.enabled' : 'audit.disabled', value ? (language === 'en' ? 'Enabled' : 'เปิดใช้งาน') : (language === 'en' ? 'Disabled' : 'ปิดใช้งาน'));
  }
  if (typeof value === 'object') {
    const file = value as { name?: unknown; type?: unknown; size?: unknown };
    if ('name' in file || 'type' in file || 'size' in file) {
      const name = isUnset(file.name) ? translatedOrFallback(t, 'audit.valueNotSet', language === 'en' ? 'Not specified' : 'ไม่ได้ระบุ') : String(file.name);
      const details = [file.type, file.size !== null && file.size !== undefined ? `${file.size} bytes` : null]
        .filter(Boolean)
        .map(String)
        .join(', ');
      return details ? `${name} (${details})` : name;
    }
    return JSON.stringify(value);
  }

  const text = String(value);
  if (field === 'allowed_materials') {
    try {
      const materials: unknown = JSON.parse(text);
      if (Array.isArray(materials) && materials.every((material) => typeof material === 'string')) {
        if (materials.length === 0) {
          return translatedOrFallback(t, 'audit.valueNotSet', language === 'en' ? 'Not specified' : 'ไม่ได้ระบุ');
        }
        return materials.map((material: string) => {
          if (material.startsWith('OTHER:')) return material.slice(6).trim();
          const fallback = material.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase());
          return translatedOrFallback(t, `audit.values.allowed_materials.${material}`, fallback);
        }).join(', ');
      }
    } catch {
      // Preserve readable legacy values that were not stored as JSON.
    }
  }
  if (field && /^[A-Z][A-Z0-9_]*$/.test(text)) {
    const enumKey = `audit.values.${FIELD_ALIASES[field] || field}.${text}`;
    const humanized = text.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase());
    return translatedOrFallback(t, enumKey, humanized);
  }
  return text;
}
