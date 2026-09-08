-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "AssignmentRole" AS ENUM ('employee', 'supervisor');

-- CreateEnum
CREATE TYPE "EmployeePayType" AS ENUM ('commission', 'fixed', 'bonus', 'deduction');

-- CreateEnum
CREATE TYPE "CompanyAccountDirection" AS ENUM ('deposit', 'withdrawal');

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "country" TEXT,
    "governorate" TEXT,
    "phone" TEXT,
    "qualification" TEXT,
    "cv_storage_key" TEXT,
    "cv_file_name" TEXT,
    "rating" INTEGER DEFAULT 0,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_assignments" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "employee_id" UUID,
    "user_id" UUID,
    "role" "AssignmentRole" NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "project_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_payments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "pay_type" "EmployeePayType" NOT NULL,
    "amount_original" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "exchange_rate_to_egp" DECIMAL(18,6) NOT NULL,
    "amount_egp" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_account_entries" (
    "id" UUID NOT NULL,
    "direction" "CompanyAccountDirection" NOT NULL,
    "transaction_id" UUID NOT NULL,
    "amount_original" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "exchange_rate_to_egp" DECIMAL(18,6) NOT NULL,
    "amount_egp" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_account_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE INDEX "project_assignments_project_id_idx" ON "project_assignments"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_assignments_project_id_employee_id_key" ON "project_assignments"("project_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_assignments_project_id_user_id_key" ON "project_assignments"("project_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_payments_transaction_id_key" ON "employee_payments"("transaction_id");

-- CreateIndex
CREATE INDEX "employee_payments_employee_id_idx" ON "employee_payments"("employee_id");

-- CreateIndex
CREATE INDEX "employee_payments_project_id_idx" ON "employee_payments"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_account_entries_transaction_id_key" ON "company_account_entries"("transaction_id");

-- CreateIndex
CREATE INDEX "company_account_entries_direction_idx" ON "company_account_entries"("direction");

-- CreateIndex
CREATE INDEX "company_account_entries_date_idx" ON "company_account_entries"("date");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_payments" ADD CONSTRAINT "employee_payments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_payments" ADD CONSTRAINT "employee_payments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_payments" ADD CONSTRAINT "employee_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_payments" ADD CONSTRAINT "employee_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_account_entries" ADD CONSTRAINT "company_account_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_account_entries" ADD CONSTRAINT "company_account_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────── Row Level Security (Phase 4 نقطة 1) ───────────────
-- App server code uses Prisma as the `postgres` role and bypasses RLS;
-- these policies lock down the auto-generated PostgREST API.

-- Shared admin data: any authenticated admin has full access.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['employees', 'project_assignments', 'employee_payments', 'company_account_entries'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true);', t || '_select_authenticated', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true);', t || '_insert_authenticated', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);', t || '_update_authenticated', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true);', t || '_delete_authenticated', t);
  END LOOP;
END $$;

-- ─────────────── Storage bucket for employee CV files (نقطة 1) ───────────────
-- private: reachable only through short-lived signed URLs generated
-- server-side after the session is verified. Same pattern as 'project-files'.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-cvs',
  'employee-cvs',
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
