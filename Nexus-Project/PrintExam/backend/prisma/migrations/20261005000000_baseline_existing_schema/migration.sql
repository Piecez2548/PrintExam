-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('INSTRUCTOR', 'AV_STAFF', 'COORDINATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REJECTED', 'APPROVED', 'PRINTING', 'PRINTED', 'PACKED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('MIDTERM', 'FINAL', 'QUIZ');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Login" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "department" TEXT,
    "phone" TEXT,
    "office_room" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "two_factor_temp_code" TEXT,
    "two_factor_expires_at" TIMESTAMP(3),
    "two_factor_failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Login_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Password_Reset_Request" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" INTEGER,

    CONSTRAINT "Password_Reset_Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" SERIAL NOT NULL,
    "course_code" TEXT NOT NULL,
    "course_name" TEXT NOT NULL,
    "instructor_id" INTEGER NOT NULL,
    "department" TEXT,
    "section" TEXT,
    "semester" INTEGER NOT NULL DEFAULT 1,
    "student_count" INTEGER NOT NULL DEFAULT 1,
    "academic_year" TEXT NOT NULL DEFAULT '2569',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam_Schedule" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "exam_type" "ExamType" NOT NULL DEFAULT 'FINAL',
    "exam_date" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "section" TEXT,
    "coordinator_id" INTEGER,
    "deadline_date" TEXT NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exam_Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "schedule_id" INTEGER,
    "file_url" TEXT,
    "original_filename" TEXT,
    "file_type" TEXT,
    "file_size" INTEGER DEFAULT 0,
    "num_copies" INTEGER NOT NULL DEFAULT 1,
    "student_count" INTEGER NOT NULL DEFAULT 1,
    "reserve_copies" INTEGER NOT NULL DEFAULT 2,
    "section" TEXT,
    "num_pages" INTEGER NOT NULL DEFAULT 1,
    "exam_language" TEXT NOT NULL DEFAULT 'THAI',
    "print_format" TEXT NOT NULL DEFAULT 'DOUBLE_SIDED',
    "allowed_materials" TEXT,
    "requires_answer_sheet" BOOLEAN NOT NULL DEFAULT false,
    "exam_session_type" TEXT NOT NULL DEFAULT 'IN_SCHEDULE',
    "special_instructions" TEXT,
    "is_double_sided" BOOLEAN NOT NULL DEFAULT true,
    "paper_size" TEXT NOT NULL DEFAULT 'A4',
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "rejection_reason" TEXT,
    "created_by" INTEGER NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "deadline_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity_Log" (
    "id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "action_by" INTEGER NOT NULL,
    "action_name" TEXT NOT NULL,
    "action_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "Activity_Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Envelope_Label" (
    "id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "label_code" TEXT NOT NULL,
    "generated_by" INTEGER NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details_json" TEXT,

    CONSTRAINT "Envelope_Label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam_Print" (
    "id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "printed_by" INTEGER NOT NULL,
    "printed_copies" INTEGER NOT NULL,
    "paper_type" TEXT NOT NULL DEFAULT 'A4',
    "printed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "Exam_Print_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Envelope_Packing" (
    "id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "packed_by" INTEGER NOT NULL,
    "packed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envelope_count" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,

    CONSTRAINT "Envelope_Packing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam_Delivery" (
    "id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "handed_over_by" INTEGER NOT NULL,
    "received_by" INTEGER NOT NULL,
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiver_signature_note" TEXT,

    CONSTRAINT "Exam_Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "System_Audit_Log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "user_name" TEXT,
    "user_role" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "ip_address" TEXT,
    "detail_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "System_Audit_Log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Login_username_key" ON "Login"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Login_email_key" ON "Login"("email");

-- CreateIndex
CREATE INDEX "Login_role_idx" ON "Login"("role");

-- CreateIndex
CREATE INDEX "Login_is_active_idx" ON "Login"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "Password_Reset_Request_user_id_key" ON "Password_Reset_Request"("user_id");

-- CreateIndex
CREATE INDEX "Password_Reset_Request_status_requested_at_idx" ON "Password_Reset_Request"("status", "requested_at");

-- CreateIndex
CREATE INDEX "Subject_course_code_idx" ON "Subject"("course_code");

-- CreateIndex
CREATE INDEX "Subject_instructor_id_idx" ON "Subject"("instructor_id");

-- CreateIndex
CREATE INDEX "Exam_Schedule_exam_date_idx" ON "Exam_Schedule"("exam_date");

-- CreateIndex
CREATE INDEX "Exam_Schedule_course_id_idx" ON "Exam_Schedule"("course_id");

-- CreateIndex
CREATE INDEX "Exam_Schedule_coordinator_id_idx" ON "Exam_Schedule"("coordinator_id");

-- CreateIndex
CREATE INDEX "Exam_status_idx" ON "Exam"("status");

-- CreateIndex
CREATE INDEX "Exam_course_id_idx" ON "Exam"("course_id");

-- CreateIndex
CREATE INDEX "Exam_created_by_idx" ON "Exam"("created_by");

-- CreateIndex
CREATE INDEX "Exam_deadline_at_idx" ON "Exam"("deadline_at");

-- CreateIndex
CREATE INDEX "Exam_schedule_id_idx" ON "Exam"("schedule_id");

-- CreateIndex
CREATE INDEX "Activity_Log_exam_id_idx" ON "Activity_Log"("exam_id");

-- CreateIndex
CREATE INDEX "Activity_Log_action_by_idx" ON "Activity_Log"("action_by");

-- CreateIndex
CREATE INDEX "Activity_Log_action_at_idx" ON "Activity_Log"("action_at");

-- CreateIndex
CREATE UNIQUE INDEX "Envelope_Label_exam_id_key" ON "Envelope_Label"("exam_id");

-- CreateIndex
CREATE UNIQUE INDEX "Envelope_Label_label_code_key" ON "Envelope_Label"("label_code");

-- CreateIndex
CREATE INDEX "Envelope_Label_exam_id_idx" ON "Envelope_Label"("exam_id");

-- CreateIndex
CREATE INDEX "Envelope_Label_generated_by_idx" ON "Envelope_Label"("generated_by");

-- CreateIndex
CREATE INDEX "Exam_Print_exam_id_idx" ON "Exam_Print"("exam_id");

-- CreateIndex
CREATE INDEX "Exam_Print_printed_by_idx" ON "Exam_Print"("printed_by");

-- CreateIndex
CREATE INDEX "Envelope_Packing_exam_id_idx" ON "Envelope_Packing"("exam_id");

-- CreateIndex
CREATE INDEX "Envelope_Packing_packed_by_idx" ON "Envelope_Packing"("packed_by");

-- CreateIndex
CREATE INDEX "Exam_Delivery_exam_id_idx" ON "Exam_Delivery"("exam_id");

-- CreateIndex
CREATE INDEX "Exam_Delivery_handed_over_by_idx" ON "Exam_Delivery"("handed_over_by");

-- CreateIndex
CREATE INDEX "Exam_Delivery_received_by_idx" ON "Exam_Delivery"("received_by");

-- CreateIndex
CREATE INDEX "Notification_user_id_is_read_idx" ON "Notification"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "Notification_created_at_idx" ON "Notification"("created_at");

-- CreateIndex
CREATE INDEX "System_Audit_Log_user_id_action_idx" ON "System_Audit_Log"("user_id", "action");

-- CreateIndex
CREATE INDEX "System_Audit_Log_created_at_idx" ON "System_Audit_Log"("created_at");

-- CreateIndex
CREATE INDEX "System_Audit_Log_entity_type_idx" ON "System_Audit_Log"("entity_type");

-- AddForeignKey
ALTER TABLE "Password_Reset_Request" ADD CONSTRAINT "Password_Reset_Request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Password_Reset_Request" ADD CONSTRAINT "Password_Reset_Request_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "Login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "Login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam_Schedule" ADD CONSTRAINT "Exam_Schedule_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "Login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam_Schedule" ADD CONSTRAINT "Exam_Schedule_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "Exam_Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity_Log" ADD CONSTRAINT "Activity_Log_action_by_fkey" FOREIGN KEY ("action_by") REFERENCES "Login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity_Log" ADD CONSTRAINT "Activity_Log_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Envelope_Label" ADD CONSTRAINT "Envelope_Label_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Envelope_Label" ADD CONSTRAINT "Envelope_Label_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "Login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam_Print" ADD CONSTRAINT "Exam_Print_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam_Print" ADD CONSTRAINT "Exam_Print_printed_by_fkey" FOREIGN KEY ("printed_by") REFERENCES "Login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Envelope_Packing" ADD CONSTRAINT "Envelope_Packing_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Envelope_Packing" ADD CONSTRAINT "Envelope_Packing_packed_by_fkey" FOREIGN KEY ("packed_by") REFERENCES "Login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam_Delivery" ADD CONSTRAINT "Exam_Delivery_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam_Delivery" ADD CONSTRAINT "Exam_Delivery_handed_over_by_fkey" FOREIGN KEY ("handed_over_by") REFERENCES "Login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam_Delivery" ADD CONSTRAINT "Exam_Delivery_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "Login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "System_Audit_Log" ADD CONSTRAINT "System_Audit_Log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Login"("id") ON DELETE SET NULL ON UPDATE CASCADE;
