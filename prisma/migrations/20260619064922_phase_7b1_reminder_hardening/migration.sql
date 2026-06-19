-- AlterTable
ALTER TABLE "diet_plan_automations" ADD COLUMN     "sleepEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sleepTime" TEXT DEFAULT '22:00',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "waterCustomTimes" JSONB,
ADD COLUMN     "waterEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "waterFrequencyType" TEXT NOT NULL DEFAULT 'FREQUENCY',
ADD COLUMN     "waterIntervalHours" INTEGER DEFAULT 2;

-- AlterTable
ALTER TABLE "reminder_jobs" ADD COLUMN     "automationVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "templateVersion" INTEGER;

-- AlterTable
ALTER TABLE "reminder_templates" ADD COLUMN     "buttons" JSONB;
