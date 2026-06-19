-- AlterTable
ALTER TABLE "compliance_daily_summaries" ADD COLUMN     "mealsCompleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mealsTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sleepCompleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sleepTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "waterCompleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "waterTotal" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "reminder_jobs" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "reminder_templates" ADD COLUMN     "buttonVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "templateButtons" JSONB;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "reminderConfig" JSONB;

-- CreateIndex
CREATE INDEX "reminder_jobs_tenantId_isArchived_idx" ON "reminder_jobs"("tenantId", "isArchived");
