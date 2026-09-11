-- CreateEnum
CREATE TYPE "TargetClientStatus" AS ENUM ('available', 'claimed', 'won', 'lost', 'inactive');

-- CreateEnum
CREATE TYPE "TargetClientActivityKind" AS ENUM ('note', 'report', 'voice_call');

-- CreateTable
CREATE TABLE "target_clients" (
    "id" UUID NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_phones" TEXT[],
    "social_links" JSONB,
    "website" TEXT,
    "company_size" TEXT,
    "script" TEXT,
    "notes" TEXT,
    "status" "TargetClientStatus" NOT NULL DEFAULT 'available',
    "hidden_from_employees" BOOLEAN NOT NULL DEFAULT false,
    "claimed_by_id" UUID,
    "claimed_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "target_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "target_client_activities" (
    "id" UUID NOT NULL,
    "target_client_id" UUID NOT NULL,
    "employee_id" UUID,
    "kind" "TargetClientActivityKind" NOT NULL,
    "body" TEXT,
    "file_storage_key" TEXT,
    "file_name" TEXT,
    "drive_file_id" TEXT,
    "drive_web_link" TEXT,
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "target_client_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "target_clients_status_idx" ON "target_clients"("status");

-- CreateIndex
CREATE INDEX "target_clients_hidden_from_employees_idx" ON "target_clients"("hidden_from_employees");

-- CreateIndex
CREATE INDEX "target_clients_claimed_by_id_idx" ON "target_clients"("claimed_by_id");

-- CreateIndex
CREATE INDEX "target_client_activities_target_client_id_idx" ON "target_client_activities"("target_client_id");

-- CreateIndex
CREATE INDEX "target_client_activities_kind_idx" ON "target_client_activities"("kind");

-- AddForeignKey
ALTER TABLE "target_clients" ADD CONSTRAINT "target_clients_claimed_by_id_fkey" FOREIGN KEY ("claimed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_clients" ADD CONSTRAINT "target_clients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_client_activities" ADD CONSTRAINT "target_client_activities_target_client_id_fkey" FOREIGN KEY ("target_client_id") REFERENCES "target_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_client_activities" ADD CONSTRAINT "target_client_activities_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────── Row Level Security (Phase 5 نقطة 4) ───────────────
-- App server code uses Prisma as the `postgres` role and bypasses RLS;
-- these policies lock down the auto-generated PostgREST API. Shared-admin
-- pattern, matching employees/project_assignments/etc — the app itself is
-- the source of truth for the finer-grained employee-vs-admin rules (an
-- employee's own claimed-lead scoping happens in server actions, not RLS).
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['target_clients', 'target_client_activities'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true);', t || '_select_authenticated', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true);', t || '_insert_authenticated', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);', t || '_update_authenticated', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true);', t || '_delete_authenticated', t);
  END LOOP;
END $$;

-- ─────────────── Storage bucket for target-client report files (نقطة 4) ───────────────
-- private: reachable only through short-lived signed URLs generated
-- server-side after the session is verified. Same pattern as 'employee-cvs'.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'target-client-reports',
  'target-client-reports',
  false,
  10485760,                 -- 10 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No RLS policies on storage.objects for this bucket: anon/authenticated get
-- no access. All reads/writes go through the service-role client server-side.
