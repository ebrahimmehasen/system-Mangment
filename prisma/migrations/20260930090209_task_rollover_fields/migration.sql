-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "postponement_count" INTEGER NOT NULL DEFAULT 0;

