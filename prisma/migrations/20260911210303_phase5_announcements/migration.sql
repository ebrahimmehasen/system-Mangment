-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "meeting_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────── Row Level Security (Phase 5 نقطة 9) ───────────────
DO $$
BEGIN
  ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "announcements_select_authenticated" ON "announcements" FOR SELECT TO authenticated USING (true);
  CREATE POLICY "announcements_insert_authenticated" ON "announcements" FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "announcements_update_authenticated" ON "announcements" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "announcements_delete_authenticated" ON "announcements" FOR DELETE TO authenticated USING (true);
END $$;
