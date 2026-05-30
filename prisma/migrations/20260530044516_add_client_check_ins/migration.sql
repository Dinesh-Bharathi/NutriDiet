-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('PENDING', 'SUBMITTED', 'REVIEWED');

-- CreateTable
CREATE TABLE "client_check_ins" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "dietPlanId" TEXT,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "status" "CheckInStatus" NOT NULL DEFAULT 'PENDING',
    "requiresFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "weightKg" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "hipCm" DOUBLE PRECISION,
    "chestCm" DOUBLE PRECISION,
    "armCm" DOUBLE PRECISION,
    "thighCm" DOUBLE PRECISION,
    "waterIntakeLiters" DOUBLE PRECISION,
    "sleepHours" DOUBLE PRECISION,
    "exerciseDays" INTEGER,
    "energyLevel" INTEGER,
    "stressLevel" INTEGER,
    "moodLevel" INTEGER,
    "planAdherence" INTEGER,
    "adherenceNotes" TEXT,
    "clientNotes" TEXT,
    "practitionerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "client_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_check_ins_clientId_idx" ON "client_check_ins"("clientId");

-- CreateIndex
CREATE INDEX "client_check_ins_tenantId_idx" ON "client_check_ins"("tenantId");

-- CreateIndex
CREATE INDEX "client_check_ins_status_idx" ON "client_check_ins"("status");

-- CreateIndex
CREATE INDEX "client_check_ins_submittedAt_idx" ON "client_check_ins"("submittedAt");

-- CreateIndex
CREATE INDEX "client_check_ins_checkInDate_idx" ON "client_check_ins"("checkInDate");

-- CreateIndex
CREATE INDEX "client_check_ins_clientId_checkInDate_idx" ON "client_check_ins"("clientId", "checkInDate");

-- AddForeignKey
ALTER TABLE "client_check_ins" ADD CONSTRAINT "client_check_ins_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_check_ins" ADD CONSTRAINT "client_check_ins_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_check_ins" ADD CONSTRAINT "client_check_ins_dietPlanId_fkey" FOREIGN KEY ("dietPlanId") REFERENCES "diet_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_check_ins" ADD CONSTRAINT "client_check_ins_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
