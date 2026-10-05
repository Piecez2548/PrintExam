-- Add nullable soft-delete markers; preserve all existing rows and relations.
ALTER TABLE "Login" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "Exam" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "Login_deleted_at_idx" ON "Login"("deleted_at");
CREATE INDEX "Exam_deleted_at_idx" ON "Exam"("deleted_at");
