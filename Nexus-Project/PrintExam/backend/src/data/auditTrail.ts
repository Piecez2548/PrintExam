export type AuditFieldChange = {
  before: unknown;
  after: unknown;
};

export type AuditChanges = Record<string, AuditFieldChange>;

const SENSITIVE_KEY = /(password|token|secret|otp|authorization|cookie|session|credential)/i;
const SENSITIVE_TEXT = /\b(password|passcode|otp|token|authorization|secret|api[_ -]?key|bearer)\b/i;
const AUDITABLE_FIELDS = new Set([
  'course_id', 'schedule_id', 'deadline_at', 'original_filename', 'file_type', 'file_size', 'file',
  'num_copies', 'student_count', 'reserve_copies', 'section', 'num_pages', 'exam_language', 'print_format',
  'allowed_materials', 'requires_answer_sheet', 'exam_session_type', 'special_instructions',
  'is_double_sided', 'paper_size', 'exam_type', 'exam_date', 'start_time', 'end_time', 'room',
  'coordinator_id', 'deadline_date', 'course_code', 'course_name', 'instructor_id', 'department',
  'semester', 'academic_year',
]);

// Empty strings are equivalent to an unset value only for these optional text fields.
// Other fields retain empty-string semantics where the application allows them.
const OPTIONAL_EMPTY_FIELDS = new Set([
  'original_filename', 'file_type', 'allowed_materials', 'special_instructions',
  'section', 'room', 'department',
]);

function canonicalAuditFieldValue(field: string, value: unknown): unknown {
  if (OPTIONAL_EMPTY_FIELDS.has(field) && value === '') return null;
  return value ?? null;
}

function normalizeAuditValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeAuditValue);
  if (typeof value === 'string') return SENSITIVE_TEXT.test(value) ? '[REDACTED]' : value;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[REDACTED]' : normalizeAuditValue(child),
    ]));
  }
  return value;
}

function comparable(field: string, value: unknown): string {
  const canonical = canonicalAuditFieldValue(field, value);
  if (canonical instanceof Date) return canonical.toISOString();
  return JSON.stringify(canonical);
}

/** Build one logical, safe before/after payload from explicitly selected fields. */
export function buildAuditChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[]
): AuditChanges {
  const changes: AuditChanges = {};
  for (const field of fields) {
    if (!(field in after) || comparable(field, before[field]) === comparable(field, after[field])) continue;
    changes[field] = {
      before: normalizeAuditValue(canonicalAuditFieldValue(field, before[field])),
      after: normalizeAuditValue(canonicalAuditFieldValue(field, after[field])),
    };
  }
  return changes;
}

export function buildAuditValueChange(before: unknown, after: unknown): AuditFieldChange {
  return {
    before: normalizeAuditValue(before ?? null),
    after: normalizeAuditValue(after ?? null),
  };
}

/** Stable newest-first ordering for mixed status-history and data-edit events. */
export function sortAuditTrail<T extends { action_at: string; id: number; event_type: string }>(events: T[]): T[] {
  return [...events].sort((a, b) => {
    const timeDelta = Date.parse(b.action_at) - Date.parse(a.action_at);
    if (timeDelta) return timeDelta;
    const idDelta = b.id - a.id;
    if (idDelta) return idDelta;
    return b.event_type.localeCompare(a.event_type);
  });
}

export function parseAuditChanges(detailJson: string | null): AuditChanges | null {
  if (!detailJson) return null;
  try {
    const parsed = JSON.parse(detailJson) as { audit_version?: unknown; changes?: unknown };
    if (parsed.audit_version !== 1) return null;
    if (!parsed.changes || typeof parsed.changes !== 'object' || Array.isArray(parsed.changes)) return null;
    const changes: AuditChanges = {};
    for (const [field, value] of Object.entries(parsed.changes as Record<string, unknown>)) {
      if (!AUDITABLE_FIELDS.has(field) || !value || typeof value !== 'object' || !('before' in value) || !('after' in value)) continue;
      changes[field] = value as AuditFieldChange;
    }
    return Object.keys(changes).length ? changes : null;
  } catch {
    return null;
  }
}
