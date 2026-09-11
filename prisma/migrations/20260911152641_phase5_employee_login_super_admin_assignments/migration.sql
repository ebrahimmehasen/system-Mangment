-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "user_id" UUID;

-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "assigned_to_user_id" UUID;

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "assigned_to_user_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_super_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "meetings_assigned_to_user_id_idx" ON "meetings"("assigned_to_user_id");

-- CreateIndex
CREATE INDEX "reminders_assigned_to_user_id_idx" ON "reminders"("assigned_to_user_id");

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Phase 5 point 1: designate the sole super admin (DB-only, no UI toggle).
UPDATE "users" SET "is_super_admin" = true WHERE "email" = 'ebrahimmehasen108@gmail.com';
