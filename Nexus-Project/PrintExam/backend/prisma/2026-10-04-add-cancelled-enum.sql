-- PostgreSQL requires a newly-added enum value to be committed before it is
-- referenced by later statements. Keep this as a separate idempotent step.
ALTER TYPE "ExamStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
