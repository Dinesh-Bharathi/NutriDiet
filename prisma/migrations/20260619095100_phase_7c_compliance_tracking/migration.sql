-- CreateEnum
CREATE TYPE "ComplianceResponseType" AS ENUM ('MEAL_COMPLETED', 'MEAL_PARTIAL', 'MEAL_SKIPPED', 'WATER_INTAKE', 'SLEEP_HOURS', 'NO_RESPONSE');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('PENDING', 'COMPLETED');

-- AlterTable
ALTER TABLE "reminder_executions" ADD COLUMN     "metaMessageId" VARCHAR(100);

-- AlterTable
ALTER TABLE "reminder_jobs" ADD COLUMN     "complianceEventId" TEXT,
ADD COLUMN     "sentMetaMessageId" VARCHAR(100);

-- AlterTable
ALTER TABLE "reminder_templates" ADD COLUMN     "config" JSONB;

-- CreateTable
CREATE TABLE "client_compliance_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "reminderJobId" TEXT NOT NULL,
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "responseType" "ComplianceResponseType" NOT NULL DEFAULT 'NO_RESPONSE',
    "responseRaw" TEXT,
    "responseValue" JSONB,
    "responseLatencySeconds" INTEGER,
    "source" TEXT,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'PENDING',
    "metaMessageId" VARCHAR(100),
    "mealType" TEXT,
    "mealName" TEXT,
    "mealTime" TEXT,
    "compiledTitle" TEXT,
    "compiledMessage" TEXT,
    "localDate" TEXT NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "responseWindowClosesAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_compliance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_daily_summaries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mealCompliancePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waterCompliancePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sleepCompliancePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overallCompliancePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "noResponseCount" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_daily_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_compliance_events_reminderJobId_key" ON "client_compliance_events"("reminderJobId");

-- CreateIndex
CREATE INDEX "client_compliance_events_tenantId_idx" ON "client_compliance_events"("tenantId");

-- CreateIndex
CREATE INDEX "client_compliance_events_tenantId_clientId_idx" ON "client_compliance_events"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "client_compliance_events_tenantId_clientId_createdAt_idx" ON "client_compliance_events"("tenantId", "clientId", "createdAt");

-- CreateIndex
CREATE INDEX "client_compliance_events_status_responseWindowClosesAt_idx" ON "client_compliance_events"("status", "responseWindowClosesAt");

-- CreateIndex
CREATE INDEX "compliance_daily_summaries_tenantId_clientId_idx" ON "compliance_daily_summaries"("tenantId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_daily_summaries_tenantId_clientId_date_key" ON "compliance_daily_summaries"("tenantId", "clientId", "date");

-- AddForeignKey
ALTER TABLE "client_compliance_events" ADD CONSTRAINT "client_compliance_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_compliance_events" ADD CONSTRAINT "client_compliance_events_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_compliance_events" ADD CONSTRAINT "client_compliance_events_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "diet_plan_automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_compliance_events" ADD CONSTRAINT "client_compliance_events_reminderJobId_fkey" FOREIGN KEY ("reminderJobId") REFERENCES "reminder_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_daily_summaries" ADD CONSTRAINT "compliance_daily_summaries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_daily_summaries" ADD CONSTRAINT "compliance_daily_summaries_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
