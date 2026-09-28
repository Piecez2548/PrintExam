import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { prisma } from './prisma';
import { UserRole, ExamStatus, ExamType, ScheduleStatus } from '../../generated/prisma';

export async function migrateSqliteToPostgres(): Promise<void> {
  const dbPath = path.join(__dirname, '../../data/exam_system.db');
  if (!fs.existsSync(dbPath)) {
    console.log(`[Migration] SQLite database file not found at ${dbPath}. Skipping migration.`);
    return;
  }

  console.log(`[Migration] Reading existing SQLite database from ${dbPath}...`);
  const sqlite = new Database(dbPath, { readonly: true });

  try {
    // 1. Users
    const users = sqlite.prepare('SELECT * FROM users').all() as any[];
    console.log(`[Migration] Found ${users.length} users in SQLite.`);
    for (const u of users) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: {},
        create: {
          id: u.id,
          username: u.username,
          passwordHash: u.password_hash,
          fullName: u.full_name,
          email: u.email,
          role: u.role as UserRole,
          department: u.department || null,
          phone: u.phone || null,
          isActive: Boolean(u.is_active),
          twoFactorSecret: u.two_factor_secret || null,
          twoFactorTempCode: u.two_factor_temp_code || null,
          twoFactorExpiresAt: u.two_factor_expires_at ? new Date(u.two_factor_expires_at) : null,
          createdAt: u.created_at ? new Date(u.created_at) : new Date(),
          updatedAt: u.updated_at ? new Date(u.updated_at) : new Date(),
        },
      });
    }

    // 2. Courses
    const courses = sqlite.prepare('SELECT * FROM courses').all() as any[];
    console.log(`[Migration] Found ${courses.length} courses in SQLite.`);
    for (const c of courses) {
      await prisma.course.upsert({
        where: { id: c.id },
        update: {},
        create: {
          id: c.id,
          courseCode: c.course_code,
          courseName: c.course_name,
          instructorId: c.instructor_id,
          department: c.department || null,
          semester: Number(c.semester || 1),
          academicYear: c.academic_year || '2569',
          createdAt: c.created_at ? new Date(c.created_at) : new Date(),
          updatedAt: c.updated_at ? new Date(c.updated_at) : new Date(),
        },
      });
    }

    // 3. Exam Schedules
    const schedules = sqlite.prepare('SELECT * FROM exam_schedules').all() as any[];
    console.log(`[Migration] Found ${schedules.length} exam schedules in SQLite.`);
    for (const s of schedules) {
      await prisma.examSchedule.upsert({
        where: { id: s.id },
        update: {},
        create: {
          id: s.id,
          courseId: s.course_id,
          examType: (s.exam_type as ExamType) || ExamType.FINAL,
          examDate: s.exam_date,
          startTime: s.start_time,
          endTime: s.end_time,
          room: s.room,
          coordinatorId: s.coordinator_id || null,
          deadlineDate: s.deadline_date,
          status: (s.status as ScheduleStatus) || ScheduleStatus.SCHEDULED,
          createdAt: s.created_at ? new Date(s.created_at) : new Date(),
          updatedAt: s.updated_at ? new Date(s.updated_at) : new Date(),
        },
      });
    }

    // 4. Exams
    const exams = sqlite.prepare('SELECT * FROM exams').all() as any[];
    console.log(`[Migration] Found ${exams.length} exams in SQLite.`);
    for (const e of exams) {
      await prisma.exam.upsert({
        where: { id: e.id },
        update: {},
        create: {
          id: e.id,
          courseId: e.course_id,
          scheduleId: e.schedule_id || null,
          fileUrl: e.file_url || null,
          originalFilename: e.original_filename || null,
          fileType: e.file_type || null,
          fileSize: Number(e.file_size || 0),
          numCopies: Number(e.num_copies || 1),
          numPages: Number(e.num_pages || 1),
          specialInstructions: e.special_instructions || null,
          isDoubleSided: Boolean(e.is_double_sided),
          paperSize: e.paper_size || 'A4',
          status: (e.status as ExamStatus) || ExamStatus.DRAFT,
          rejectionReason: e.rejection_reason || null,
          createdById: e.created_by,
          submittedAt: e.submitted_at ? new Date(e.submitted_at) : null,
          deadlineAt: e.deadline_at ? new Date(e.deadline_at) : new Date(),
          createdAt: e.created_at ? new Date(e.created_at) : new Date(),
          updatedAt: e.updated_at ? new Date(e.updated_at) : new Date(),
        },
      });
    }

    // 5. Exam Status History
    const histories = sqlite.prepare('SELECT * FROM exam_status_history').all() as any[];
    console.log(`[Migration] Found ${histories.length} status histories in SQLite.`);
    for (const h of histories) {
      await prisma.examStatusHistory.upsert({
        where: { id: h.id },
        update: {},
        create: {
          id: h.id,
          examId: h.exam_id,
          fromStatus: h.from_status || null,
          toStatus: h.to_status,
          actionById: h.action_by,
          actionName: h.action_name,
          actionAt: h.action_at ? new Date(h.action_at) : new Date(),
          note: h.note || null,
        },
      });
    }

    // 6. Envelope Labels
    const labels = sqlite.prepare('SELECT * FROM envelope_labels').all() as any[];
    console.log(`[Migration] Found ${labels.length} envelope labels in SQLite.`);
    for (const l of labels) {
      await prisma.envelopeLabel.upsert({
        where: { id: l.id },
        update: {},
        create: {
          id: l.id,
          examId: l.exam_id,
          labelCode: l.label_code,
          generatedById: l.generated_by,
          generatedAt: l.generated_at ? new Date(l.generated_at) : new Date(),
          detailsJson: l.details_json || null,
        },
      });
    }

    // 7. Print Records
    const printRecords = sqlite.prepare('SELECT * FROM print_records').all() as any[];
    console.log(`[Migration] Found ${printRecords.length} print records in SQLite.`);
    for (const p of printRecords) {
      await prisma.printRecord.upsert({
        where: { id: p.id },
        update: {},
        create: {
          id: p.id,
          examId: p.exam_id,
          printedById: p.printed_by,
          printedCopies: Number(p.printed_copies || 1),
          paperType: p.paper_type || 'A4',
          printedAt: p.printed_at ? new Date(p.printed_at) : new Date(),
          notes: p.notes || null,
        },
      });
    }

    // 8. Packing Records
    const packingRecords = sqlite.prepare('SELECT * FROM packing_records').all() as any[];
    console.log(`[Migration] Found ${packingRecords.length} packing records in SQLite.`);
    for (const pk of packingRecords) {
      await prisma.packingRecord.upsert({
        where: { id: pk.id },
        update: {},
        create: {
          id: pk.id,
          examId: pk.exam_id,
          packedById: pk.packed_by,
          packedAt: pk.packed_at ? new Date(pk.packed_at) : new Date(),
          envelopeCount: Number(pk.envelope_count || 1),
          notes: pk.notes || null,
        },
      });
    }

    // 9. Delivery Records
    const deliveryRecords = sqlite.prepare('SELECT * FROM delivery_records').all() as any[];
    console.log(`[Migration] Found ${deliveryRecords.length} delivery records in SQLite.`);
    for (const d of deliveryRecords) {
      await prisma.deliveryRecord.upsert({
        where: { id: d.id },
        update: {},
        create: {
          id: d.id,
          examId: d.exam_id,
          handedOverById: d.handed_over_by,
          receivedById: d.received_by,
          deliveredAt: d.delivered_at ? new Date(d.delivered_at) : new Date(),
          receiverSignatureNote: d.receiver_signature_note || null,
        },
      });
    }

    // 10. Notifications
    const notifications = sqlite.prepare('SELECT * FROM notifications').all() as any[];
    console.log(`[Migration] Found ${notifications.length} notifications in SQLite.`);
    for (const n of notifications) {
      await prisma.notification.upsert({
        where: { id: n.id },
        update: {},
        create: {
          id: n.id,
          userId: n.user_id,
          type: n.type,
          title: n.title,
          message: n.message,
          link: n.link || null,
          isRead: Boolean(n.is_read),
          createdAt: n.created_at ? new Date(n.created_at) : new Date(),
        },
      });
    }

    // 11. Audit Logs
    const auditLogs = sqlite.prepare('SELECT * FROM audit_logs').all() as any[];
    console.log(`[Migration] Found ${auditLogs.length} audit logs in SQLite.`);
    for (const a of auditLogs) {
      await prisma.auditLog.upsert({
        where: { id: a.id },
        update: {},
        create: {
          id: a.id,
          userId: a.user_id || null,
          userName: a.user_name || null,
          userRole: a.user_role || null,
          action: a.action,
          entityType: a.entity_type,
          entityId: a.entity_id || null,
          ipAddress: a.ip_address || null,
          detailJson: a.detail_json || null,
          createdAt: a.created_at ? new Date(a.created_at) : new Date(),
        },
      });
    }

    console.log('🎉 [Migration] Successfully migrated all SQLite data to PostgreSQL (Supabase)!');
  } catch (error) {
    console.error('❌ [Migration] Migration error:', error);
    throw error;
  } finally {
    sqlite.close();
  }
}

// Allow direct execution via CLI `npm run db:migrate-sqlite`
if (require.main === module) {
  migrateSqliteToPostgres()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error(err);
      prisma.$disconnect();
    });
}
