-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('call', 'onsite', 'online');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('scheduled', 'done', 'cancelled');

-- CreateTable
CREATE TABLE "meetings" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "meeting_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER,
    "location" TEXT,
    "type" "MeetingType" NOT NULL DEFAULT 'call',
    "status" "MeetingStatus" NOT NULL DEFAULT 'scheduled',
    "client_id" UUID,
    "project_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" DATE,
    "completed_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "done_at" TIMESTAMP(3),
    "client_id" UUID,
    "project_id" UUID,
    "meeting_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_dismissals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "alert_key" TEXT NOT NULL,
    "dismissed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meetings_meeting_at_idx" ON "meetings"("meeting_at");

-- CreateIndex
CREATE INDEX "meetings_project_id_idx" ON "meetings"("project_id");

-- CreateIndex
CREATE INDEX "meetings_client_id_idx" ON "meetings"("client_id");

-- CreateIndex
CREATE INDEX "meetings_status_idx" ON "meetings"("status");

-- CreateIndex
CREATE INDEX "project_milestones_project_id_sort_order_idx" ON "project_milestones"("project_id", "sort_order");

-- CreateIndex
CREATE INDEX "project_milestones_due_date_idx" ON "project_milestones"("due_date");

-- CreateIndex
CREATE INDEX "reminders_remind_at_idx" ON "reminders"("remind_at");

-- CreateIndex
CREATE INDEX "reminders_done_at_idx" ON "reminders"("done_at");

-- CreateIndex
CREATE UNIQUE INDEX "alert_dismissals_user_id_alert_key_key" ON "alert_dismissals"("user_id", "alert_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_dismissals" ADD CONSTRAINT "alert_dismissals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────── Row Level Security (Phase 2 نقطة 2.1) ───────────────
-- App server code uses Prisma as the `postgres` role and bypasses RLS;
-- these policies lock down the auto-generated PostgREST API.

-- Shared calendar data: any authenticated admin has full access.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['meetings', 'project_milestones', 'reminders'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true);', t || '_select_authenticated', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true);', t || '_insert_authenticated', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);', t || '_update_authenticated', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true);', t || '_delete_authenticated', t);
  END LOOP;
END $$;

-- Per-user data: a user only ever touches their own rows.
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own_select" ON "notifications" FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_own_insert" ON "notifications" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_own_update" ON "notifications" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_own_delete" ON "notifications" FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER TABLE "alert_dismissals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alert_dismissals_own_select" ON "alert_dismissals" FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "alert_dismissals_own_insert" ON "alert_dismissals" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "alert_dismissals_own_delete" ON "alert_dismissals" FOR DELETE TO authenticated USING (user_id = auth.uid());
