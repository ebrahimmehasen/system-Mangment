-- CreateEnum
CREATE TYPE "ClientSubmissionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "client_submissions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "company_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "status" "ClientSubmissionStatus" NOT NULL DEFAULT 'pending',
    "submitted_by_id" UUID,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "resulting_client_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_submissions_resulting_client_id_key" ON "client_submissions"("resulting_client_id");

-- CreateIndex
CREATE INDEX "client_submissions_status_idx" ON "client_submissions"("status");

-- AddForeignKey
ALTER TABLE "client_submissions" ADD CONSTRAINT "client_submissions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_submissions" ADD CONSTRAINT "client_submissions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_submissions" ADD CONSTRAINT "client_submissions_resulting_client_id_fkey" FOREIGN KEY ("resulting_client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────── Row Level Security ───────────────
DO $$
BEGIN
  ALTER TABLE "client_submissions" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "client_submissions_select_authenticated" ON "client_submissions" FOR SELECT TO authenticated USING (true);
  CREATE POLICY "client_submissions_insert_authenticated" ON "client_submissions" FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "client_submissions_update_authenticated" ON "client_submissions" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "client_submissions_delete_authenticated" ON "client_submissions" FOR DELETE TO authenticated USING (true);
END $$;
