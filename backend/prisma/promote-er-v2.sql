-- Promote ER-v2 names to the application's single source of truth.
-- This migration is intentionally destructive and must only be run once.

begin;

drop trigger if exists users_sync_er on public.users;
drop trigger if exists courses_sync_er on public.courses;
drop trigger if exists schedules_sync_er_room on public.exam_schedules;
drop trigger if exists exams_sync_er on public.exams;
drop trigger if exists history_sync_er_validation on public.exam_status_history;
drop trigger if exists prints_sync_er on public.print_records;
drop trigger if exists packing_sync_er on public.packing_records;
drop trigger if exists labels_sync_er_cover_sheet on public.envelope_labels;
drop trigger if exists deliveries_sync_er on public.delivery_records;
drop trigger if exists audits_sync_er on public.audit_logs;

-- Delete the former ER mirror. Its rows were derived from the working tables.
drop table if exists public."Activity_Log" cascade;
drop table if exists public."Exam_Validation" cascade;
drop table if exists public."Exam_Print" cascade;
drop table if exists public."Envelope_Packing" cascade;
drop table if exists public."Exam_Delivery" cascade;
drop table if exists public."Exam" cascade;
drop table if exists public."Subject" cascade;
drop table if exists public."Login" cascade;
drop table if exists public."Audiovisual" cascade;
drop table if exists public."Examination_Conductor" cascade;
drop table if exists public."Teacher" cascade;
drop table if exists public."Admin" cascade;
drop table if exists public."Room" cascade;

-- The actual application tables now carry ER names and become canonical.
alter table public.users rename to "Login";
alter table public.courses rename to "Subject";
alter table public.exam_schedules rename to "Exam_Schedule";
alter table public.exams rename to "Exam";
alter table public.exam_status_history rename to "Activity_Log";
alter table public.envelope_labels rename to "Envelope_Label";
alter table public.print_records rename to "Exam_Print";
alter table public.packing_records rename to "Envelope_Packing";
alter table public.delivery_records rename to "Exam_Delivery";
alter table public.notifications rename to "Notification";
alter table public.audit_logs rename to "System_Audit_Log";

drop function if exists public.sync_er_user() cascade;
drop function if exists public.sync_er_course() cascade;
drop function if exists public.sync_er_schedule_room() cascade;
drop function if exists public.sync_er_exam() cascade;
drop function if exists public.sync_er_validation() cascade;
drop function if exists public.sync_er_print() cascade;
drop function if exists public.sync_er_packing() cascade;
drop function if exists public.sync_er_cover_sheet() cascade;
drop function if exists public.sync_er_delivery() cascade;
drop function if exists public.sync_er_activity() cascade;
drop function if exists public.er_exam_status(text) cascade;

commit;
