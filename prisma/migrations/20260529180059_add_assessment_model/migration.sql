-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHTLY_ACTIVE', 'MODERATELY_ACTIVE', 'VERY_ACTIVE', 'EXTRA_ACTIVE');

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assessmentDate" TIMESTAMP(3) NOT NULL,
    "heightCm" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "goal" TEXT,
    "activityLevel" "ActivityLevel",
    "waterIntakeLiters" DOUBLE PRECISION,
    "sleepHours" DOUBLE PRECISION,
    "medicalConditions" TEXT,
    "allergies" TEXT,
    "medications" TEXT,
    "foodPreferences" TEXT,
    "foodRestrictions" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessments_tenantId_idx" ON "assessments"("tenantId");

-- CreateIndex
CREATE INDEX "assessments_clientId_idx" ON "assessments"("clientId");

-- CreateIndex
CREATE INDEX "assessments_tenantId_clientId_idx" ON "assessments"("tenantId", "clientId");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
