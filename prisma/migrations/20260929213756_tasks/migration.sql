-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'in_progress', 'done');

-- CreateEnum
CREATE TYPE "TaskForwardRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "project_id" UUID,
    "due_date" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'todo',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignees" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_forward_requests" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "status" "TaskForwardRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_forward_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");

-- CreateIndex
CREATE INDEX "task_assignees_user_id_idx" ON "task_assignees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignees_task_id_user_id_key" ON "task_assignees"("task_id", "user_id");

-- CreateIndex
CREATE INDEX "task_forward_requests_status_idx" ON "task_forward_requests"("status");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_forward_requests" ADD CONSTRAINT "task_forward_requests_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_forward_requests" ADD CONSTRAINT "task_forward_requests_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_forward_requests" ADD CONSTRAINT "task_forward_requests_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_forward_requests" ADD CONSTRAINT "task_forward_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────── Row Level Security ───────────────
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['tasks', 'task_assignees', 'task_forward_requests'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true);', t || '_select_authenticated', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true);', t || '_insert_authenticated', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);', t || '_update_authenticated', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true);', t || '_delete_authenticated', t);
  END LOOP;
END $$;
