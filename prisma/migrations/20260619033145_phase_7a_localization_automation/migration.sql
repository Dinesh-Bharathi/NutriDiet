-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReminderJobType" AS ENUM ('MEAL_REMINDER', 'MEAL_FOLLOWUP', 'WATER_REMINDER', 'SLEEP_REMINDER');

-- CreateEnum
CREATE TYPE "ReminderJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "locale" TEXT,
ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "timezone" TEXT;

-- CreateTable
CREATE TABLE "diet_plan_automations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "dietPlanId" TEXT NOT NULL,
    "status" "AutomationStatus" NOT NULL DEFAULT 'ACTIVE',
    "activatedAt" TIMESTAMP(3),
    "activatedBy" TEXT,
    "startDate" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diet_plan_automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "dietPlanId" TEXT NOT NULL,
    "jobType" "ReminderJobType" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" "ReminderJobStatus" NOT NULL DEFAULT 'PENDING',
    "templateKey" TEXT,
    "mealType" TEXT,
    "executedAt" TIMESTAMP(3),
    "errorText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diet_plan_automations_tenantId_idx" ON "diet_plan_automations"("tenantId");

-- CreateIndex
CREATE INDEX "diet_plan_automations_tenantId_clientId_idx" ON "diet_plan_automations"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "diet_plan_automations_tenantId_clientId_status_idx" ON "diet_plan_automations"("tenantId", "clientId", "status");

-- CreateIndex
CREATE INDEX "diet_plan_automations_tenantId_status_idx" ON "diet_plan_automations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "reminder_jobs_tenantId_idx" ON "reminder_jobs"("tenantId");

-- CreateIndex
CREATE INDEX "reminder_jobs_tenantId_clientId_idx" ON "reminder_jobs"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "reminder_jobs_status_scheduledFor_idx" ON "reminder_jobs"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "reminder_jobs_tenantId_status_idx" ON "reminder_jobs"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "diet_plan_automations" ADD CONSTRAINT "diet_plan_automations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_plan_automations" ADD CONSTRAINT "diet_plan_automations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_plan_automations" ADD CONSTRAINT "diet_plan_automations_dietPlanId_fkey" FOREIGN KEY ("dietPlanId") REFERENCES "diet_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_jobs" ADD CONSTRAINT "reminder_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_jobs" ADD CONSTRAINT "reminder_jobs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_jobs" ADD CONSTRAINT "reminder_jobs_dietPlanId_fkey" FOREIGN KEY ("dietPlanId") REFERENCES "diet_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
