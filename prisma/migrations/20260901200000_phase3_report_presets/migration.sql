-- CreateTable
CREATE TABLE "report_presets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_presets_user_id_last_used_at_idx" ON "report_presets"("user_id", "last_used_at");

-- CreateIndex
CREATE UNIQUE INDEX "report_presets_user_id_name_key" ON "report_presets"("user_id", "name");

-- AddForeignKey
ALTER TABLE "report_presets" ADD CONSTRAINT "report_presets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────── Row Level Security (Phase 3 نقطة 3.5) ───────────────
-- App server code uses Prisma as the `postgres` role and bypasses RLS;
-- these policies lock down the auto-generated PostgREST API.
-- Per-user data: a user only ever touches their own presets.
ALTER TABLE "report_presets" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_presets_own_select" ON "report_presets" FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "report_presets_own_insert" ON "report_presets" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "report_presets_own_update" ON "report_presets" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "report_presets_own_delete" ON "report_presets" FOR DELETE TO authenticated USING (user_id = auth.uid());
