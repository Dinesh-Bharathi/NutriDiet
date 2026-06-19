/*
  Warnings:

  - You are about to drop the column `mealType` on the `reminder_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `templateKey` on the `reminder_jobs` table. All the data in the column will be lost.
  - Added the required column `automationId` to the `reminder_jobs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('WHATSAPP');

-- CreateEnum
CREATE TYPE "ReminderTemplateType" AS ENUM ('MEAL_REMINDER', 'MEAL_FOLLOWUP', 'WATER_REMINDER', 'SLEEP_REMINDER');

-- AlterTable
ALTER TABLE "reminder_jobs" DROP COLUMN "mealType",
DROP COLUMN "templateKey",
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "automationId" TEXT NOT NULL,
ADD COLUMN     "channel" "ReminderChannel" NOT NULL DEFAULT 'WHATSAPP',
ADD COLUMN     "compiledMessage" TEXT,
ADD COLUMN     "compiledTitle" TEXT,
ADD COLUMN     "payload" JSONB,
ADD COLUMN     "queueJobId" TEXT,
ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "reminder_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "type" "ReminderTemplateType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_executions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reminderJobId" TEXT NOT NULL,
    "status" "ReminderJobStatus" NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminder_templates_tenantId_idx" ON "reminder_templates"("tenantId");

-- CreateIndex
CREATE INDEX "reminder_executions_tenantId_idx" ON "reminder_executions"("tenantId");

-- CreateIndex
CREATE INDEX "reminder_executions_reminderJobId_idx" ON "reminder_executions"("reminderJobId");

-- AddForeignKey
ALTER TABLE "reminder_jobs" ADD CONSTRAINT "reminder_jobs_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "diet_plan_automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_jobs" ADD CONSTRAINT "reminder_jobs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "reminder_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_templates" ADD CONSTRAINT "reminder_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_executions" ADD CONSTRAINT "reminder_executions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_executions" ADD CONSTRAINT "reminder_executions_reminderJobId_fkey" FOREIGN KEY ("reminderJobId") REFERENCES "reminder_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
