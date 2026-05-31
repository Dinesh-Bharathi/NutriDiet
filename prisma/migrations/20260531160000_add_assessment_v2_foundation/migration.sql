-- CreateEnum
CREATE TYPE "AssessmentSectionType" AS ENUM ('ANTHROPOMETRICS', 'MEDICAL', 'LIFESTYLE', 'LABS');

-- CreateEnum
CREATE TYPE "AssessmentSectionWorkflowStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ClientGoalType" AS ENUM ('WEIGHT_LOSS', 'WEIGHT_GAIN', 'MAINTENANCE', 'MUSCLE_GAIN', 'PERFORMANCE', 'MEDICAL_NUTRITION', 'GENERAL_WELLNESS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ClientGoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LabResultSeverity" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskFlagSeverity" AS ENUM ('INFO', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskFlagStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "client_clinical_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "latestAssessmentId" TEXT,
    "createdById" TEXT,
    "summaryNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "client_clinical_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_section_statuses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "section" "AssessmentSectionType" NOT NULL,
    "status" "AssessmentSectionWorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "assessment_section_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_anthropometric_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heightCm" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "bodyFatPercent" DOUBLE PRECISION,
    "leanMassKg" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "hipCm" DOUBLE PRECISION,
    "chestCm" DOUBLE PRECISION,
    "armCm" DOUBLE PRECISION,
    "thighCm" DOUBLE PRECISION,
    "neckCm" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "client_anthropometric_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_conditions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "diagnosedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "client_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_allergies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "allergen" TEXT NOT NULL,
    "reaction" TEXT,
    "severity" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "client_allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_medications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "name" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "startedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "client_medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_supplements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "name" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "startedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "client_supplements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_digestive_issues" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "name" TEXT NOT NULL,
    "severity" TEXT,
    "triggers" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "client_digestive_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_lifestyle_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "occupation" TEXT,
    "workSchedule" TEXT,
    "sleepHours" DOUBLE PRECISION,
    "stressLevel" INTEGER,
    "hydrationLiters" DOUBLE PRECISION,
    "trainingFrequency" TEXT,
    "activityLevel" "ActivityLevel",
    "mealTiming" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "client_lifestyle_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_goal_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "goalType" "ClientGoalType" NOT NULL,
    "targetWeightKg" DOUBLE PRECISION,
    "targetDate" TIMESTAMP(3),
    "status" "ClientGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "client_goal_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_marker_definitions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "markerKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "defaultUnit" TEXT,
    "referenceRange" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 1,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "lab_marker_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_lab_results" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "markerDefinitionId" TEXT,
    "markerKey" TEXT NOT NULL,
    "markerName" TEXT NOT NULL,
    "valueNumeric" DOUBLE PRECISION,
    "valueText" TEXT,
    "unit" TEXT,
    "collectedDate" TIMESTAMP(3),
    "resultDate" TIMESTAMP(3),
    "referenceRangeSnapshot" JSONB,
    "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
    "severity" "LabResultSeverity",
    "flagReason" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "client_lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_risk_flags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "flagType" TEXT NOT NULL,
    "severity" "RiskFlagSeverity" NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceDomain" TEXT,
    "sourceRecordId" TEXT,
    "status" "RiskFlagStatus" NOT NULL DEFAULT 'ACTIVE',
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "client_risk_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3),
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assessment_snapshots_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "client_clinical_profiles_clientId_key" ON "client_clinical_profiles"("clientId");
CREATE UNIQUE INDEX "client_clinical_profiles_tenantId_clientId_key" ON "client_clinical_profiles"("tenantId", "clientId");
CREATE INDEX "client_clinical_profiles_tenantId_idx" ON "client_clinical_profiles"("tenantId");
CREATE INDEX "client_clinical_profiles_latestAssessmentId_idx" ON "client_clinical_profiles"("latestAssessmentId");
CREATE UNIQUE INDEX "assessment_section_statuses_tenantId_profileId_section_key" ON "assessment_section_statuses"("tenantId", "profileId", "section");
CREATE INDEX "assessment_section_statuses_tenantId_clientId_idx" ON "assessment_section_statuses"("tenantId", "clientId");
CREATE INDEX "assessment_section_statuses_assessmentId_idx" ON "assessment_section_statuses"("assessmentId");
CREATE INDEX "client_anthropometric_records_tenantId_clientId_idx" ON "client_anthropometric_records"("tenantId", "clientId");
CREATE INDEX "client_anthropometric_records_profileId_idx" ON "client_anthropometric_records"("profileId");
CREATE INDEX "client_anthropometric_records_assessmentId_idx" ON "client_anthropometric_records"("assessmentId");
CREATE INDEX "client_anthropometric_records_measuredAt_idx" ON "client_anthropometric_records"("measuredAt");
CREATE INDEX "client_conditions_tenantId_clientId_idx" ON "client_conditions"("tenantId", "clientId");
CREATE INDEX "client_conditions_tenantId_name_idx" ON "client_conditions"("tenantId", "name");
CREATE INDEX "client_conditions_profileId_idx" ON "client_conditions"("profileId");
CREATE INDEX "client_allergies_tenantId_clientId_idx" ON "client_allergies"("tenantId", "clientId");
CREATE INDEX "client_allergies_tenantId_allergen_idx" ON "client_allergies"("tenantId", "allergen");
CREATE INDEX "client_allergies_profileId_idx" ON "client_allergies"("profileId");
CREATE INDEX "client_medications_tenantId_clientId_idx" ON "client_medications"("tenantId", "clientId");
CREATE INDEX "client_medications_tenantId_name_idx" ON "client_medications"("tenantId", "name");
CREATE INDEX "client_medications_profileId_idx" ON "client_medications"("profileId");
CREATE INDEX "client_supplements_tenantId_clientId_idx" ON "client_supplements"("tenantId", "clientId");
CREATE INDEX "client_supplements_tenantId_name_idx" ON "client_supplements"("tenantId", "name");
CREATE INDEX "client_supplements_profileId_idx" ON "client_supplements"("profileId");
CREATE INDEX "client_digestive_issues_tenantId_clientId_idx" ON "client_digestive_issues"("tenantId", "clientId");
CREATE INDEX "client_digestive_issues_tenantId_name_idx" ON "client_digestive_issues"("tenantId", "name");
CREATE INDEX "client_digestive_issues_profileId_idx" ON "client_digestive_issues"("profileId");
CREATE UNIQUE INDEX "client_lifestyle_profiles_clientId_key" ON "client_lifestyle_profiles"("clientId");
CREATE UNIQUE INDEX "client_lifestyle_profiles_profileId_key" ON "client_lifestyle_profiles"("profileId");
CREATE UNIQUE INDEX "client_lifestyle_profiles_tenantId_clientId_key" ON "client_lifestyle_profiles"("tenantId", "clientId");
CREATE INDEX "client_lifestyle_profiles_tenantId_clientId_idx" ON "client_lifestyle_profiles"("tenantId", "clientId");
CREATE INDEX "client_lifestyle_profiles_assessmentId_idx" ON "client_lifestyle_profiles"("assessmentId");
CREATE INDEX "client_goal_profiles_tenantId_clientId_idx" ON "client_goal_profiles"("tenantId", "clientId");
CREATE INDEX "client_goal_profiles_profileId_idx" ON "client_goal_profiles"("profileId");
CREATE INDEX "client_goal_profiles_status_idx" ON "client_goal_profiles"("status");
CREATE UNIQUE INDEX "lab_marker_definitions_tenantId_markerKey_key" ON "lab_marker_definitions"("tenantId", "markerKey");
CREATE INDEX "lab_marker_definitions_tenantId_idx" ON "lab_marker_definitions"("tenantId");
CREATE INDEX "lab_marker_definitions_markerKey_idx" ON "lab_marker_definitions"("markerKey");
CREATE INDEX "lab_marker_definitions_isSystem_isActive_idx" ON "lab_marker_definitions"("isSystem", "isActive");
CREATE INDEX "client_lab_results_tenantId_clientId_idx" ON "client_lab_results"("tenantId", "clientId");
CREATE INDEX "client_lab_results_profileId_idx" ON "client_lab_results"("profileId");
CREATE INDEX "client_lab_results_assessmentId_idx" ON "client_lab_results"("assessmentId");
CREATE INDEX "client_lab_results_markerDefinitionId_idx" ON "client_lab_results"("markerDefinitionId");
CREATE INDEX "client_lab_results_markerKey_idx" ON "client_lab_results"("markerKey");
CREATE INDEX "client_lab_results_resultDate_idx" ON "client_lab_results"("resultDate");
CREATE INDEX "client_lab_results_isAbnormal_idx" ON "client_lab_results"("isAbnormal");
CREATE INDEX "client_risk_flags_tenantId_clientId_idx" ON "client_risk_flags"("tenantId", "clientId");
CREATE INDEX "client_risk_flags_profileId_idx" ON "client_risk_flags"("profileId");
CREATE INDEX "client_risk_flags_status_idx" ON "client_risk_flags"("status");
CREATE INDEX "client_risk_flags_severity_idx" ON "client_risk_flags"("severity");
CREATE INDEX "client_risk_flags_sourceDomain_sourceRecordId_idx" ON "client_risk_flags"("sourceDomain", "sourceRecordId");
CREATE UNIQUE INDEX "assessment_snapshots_tenantId_clientId_version_key" ON "assessment_snapshots"("tenantId", "clientId", "version");
CREATE INDEX "assessment_snapshots_tenantId_clientId_idx" ON "assessment_snapshots"("tenantId", "clientId");
CREATE INDEX "assessment_snapshots_profileId_idx" ON "assessment_snapshots"("profileId");
CREATE INDEX "assessment_snapshots_assessmentId_idx" ON "assessment_snapshots"("assessmentId");

-- Foreign keys
ALTER TABLE "client_clinical_profiles" ADD CONSTRAINT "client_clinical_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_clinical_profiles" ADD CONSTRAINT "client_clinical_profiles_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_clinical_profiles" ADD CONSTRAINT "client_clinical_profiles_latestAssessmentId_fkey" FOREIGN KEY ("latestAssessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_clinical_profiles" ADD CONSTRAINT "client_clinical_profiles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_section_statuses" ADD CONSTRAINT "assessment_section_statuses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_section_statuses" ADD CONSTRAINT "assessment_section_statuses_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_section_statuses" ADD CONSTRAINT "assessment_section_statuses_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "client_clinical_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_section_statuses" ADD CONSTRAINT "assessment_section_statuses_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_section_statuses" ADD CONSTRAINT "assessment_section_statuses_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_anthropometric_records" ADD CONSTRAINT "client_anthropometric_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_anthropometric_records" ADD CONSTRAINT "client_anthropometric_records_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_anthropometric_records" ADD CONSTRAINT "client_anthropometric_records_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "client_clinical_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_anthropometric_records" ADD CONSTRAINT "client_anthropometric_records_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_conditions" ADD CONSTRAINT "client_conditions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_conditions" ADD CONSTRAINT "client_conditions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_conditions" ADD CONSTRAINT "client_conditions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "client_clinical_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_conditions" ADD CONSTRAINT "client_conditions_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_allergies" ADD CONSTRAINT "client_allergies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_allergies" ADD CONSTRAINT "client_allergies_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_allergies" ADD CONSTRAINT "client_allergies_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "client_clinical_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_allergies" ADD CONSTRAINT "client_allergies_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_medications" ADD CONSTRAINT "client_medications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_medications" ADD CONSTRAINT "client_medications_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_medications" ADD CONSTRAINT "client_medications_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "client_clinical_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_medications" ADD CONSTRAINT "client_medications_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_supplements" ADD CONSTRAINT "client_supplements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_supplements" ADD CONSTRAINT "client_supplements_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_supplements" ADD CONSTRAINT "client_supplements_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "client_clinical_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_supplements" ADD CONSTRAINT "client_supplements_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_digestive_issues" ADD CONSTRAINT "client_digestive_issues_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_digestive_issues" ADD CONSTRAINT "client_digestive_issues_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_digestive_issues" ADD CONSTRAINT "client_digestive_issues_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "client_clinical_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_digestive_issues" ADD CONSTRAINT "client_digestive_issues_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_lifestyle_profiles" ADD CONSTRAINT "client_lifestyle_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_lifestyle_profiles" ADD CONSTRAINT "client_lifestyle_profiles_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_lifestyle_profiles" ADD CONSTRAINT "client_lifestyle_profiles_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "client_clinical_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_lifestyle_profiles" ADD CONSTRAINT "client_lifestyle_profiles_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_goal_profiles" ADD CONSTRAINT "client_goal_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_goal_profiles" ADD CONSTRAINT "client_goal_profiles_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_goal_profiles" ADD CONSTRAINT "client_goal_profiles_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "client_clinical_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_goal_profiles" ADD CONSTRAINT "client_goal_profiles_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_marker_definitions" ADD CONSTRAINT "lab_marker_definitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_lab_results" ADD CONSTRAINT "client_lab_results_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_lab_results" ADD CONSTRAINT "client_lab_results_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_lab_results" ADD CONSTRAINT "client_lab_results_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "client_clinical_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_lab_results" ADD CONSTRAINT "client_lab_results_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_lab_results" ADD CONSTRAINT "client_lab_results_markerDefinitionId_fkey" FOREIGN KEY ("markerDefinitionId") REFERENCES "lab_marker_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_risk_flags" ADD CONSTRAINT "client_risk_flags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_risk_flags" ADD CONSTRAINT "client_risk_flags_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_risk_flags" ADD CONSTRAINT "client_risk_flags_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "client_clinical_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_risk_flags" ADD CONSTRAINT "client_risk_flags_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_risk_flags" ADD CONSTRAINT "client_risk_flags_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_snapshots" ADD CONSTRAINT "assessment_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_snapshots" ADD CONSTRAINT "assessment_snapshots_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_snapshots" ADD CONSTRAINT "assessment_snapshots_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "client_clinical_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_snapshots" ADD CONSTRAINT "assessment_snapshots_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_snapshots" ADD CONSTRAINT "assessment_snapshots_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed flexible system lab marker definitions.
INSERT INTO "lab_marker_definitions" ("id", "markerKey", "name", "category", "defaultUnit", "sortOrder", "isSystem", "isActive", "updatedAt")
VALUES
('sys_lab_hba1c', 'hba1c', 'HbA1c', 'Glucose Control', '%', 1, true, true, CURRENT_TIMESTAMP),
('sys_lab_fasting_glucose', 'fasting_glucose', 'Fasting Glucose', 'Glucose Control', 'mg/dL', 2, true, true, CURRENT_TIMESTAMP),
('sys_lab_vitamin_d', 'vitamin_d', 'Vitamin D', 'Vitamins', 'ng/mL', 3, true, true, CURRENT_TIMESTAMP),
('sys_lab_b12', 'b12', 'Vitamin B12', 'Vitamins', 'pg/mL', 4, true, true, CURRENT_TIMESTAMP),
('sys_lab_tsh', 'tsh', 'TSH', 'Thyroid', 'uIU/mL', 5, true, true, CURRENT_TIMESTAMP),
('sys_lab_lipid_profile', 'lipid_profile', 'Lipid Profile', 'Cardiometabolic', NULL, 6, true, true, CURRENT_TIMESTAMP);

-- Backfill one profile per client with an existing assessment.
INSERT INTO "client_clinical_profiles" ("id", "tenantId", "clientId", "latestAssessmentId", "createdById", "createdAt", "updatedAt")
SELECT
  concat('clp_', substr(md5(a."tenantId" || a."clientId" || random()::text), 1, 20)),
  a."tenantId",
  a."clientId",
  a."id",
  a."createdBy",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON ("tenantId", "clientId") *
  FROM "assessments"
  WHERE "deletedAt" IS NULL
  ORDER BY "tenantId", "clientId", "assessmentDate" DESC
) a
ON CONFLICT ("clientId") DO NOTHING;

-- Backfill section statuses from legacy assessment presence.
INSERT INTO "assessment_section_statuses" ("id", "tenantId", "clientId", "profileId", "assessmentId", "section", "status", "completedAt", "createdAt", "updatedAt")
SELECT concat('sec_', substr(md5(p."id" || s.section::text || random()::text), 1, 20)),
       p."tenantId",
       p."clientId",
       p."id",
       p."latestAssessmentId",
       s.section,
       CASE WHEN s.has_data THEN 'COMPLETED'::"AssessmentSectionWorkflowStatus" ELSE 'DRAFT'::"AssessmentSectionWorkflowStatus" END,
       CASE WHEN s.has_data THEN CURRENT_TIMESTAMP ELSE NULL END,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "client_clinical_profiles" p
JOIN "assessments" a ON a."id" = p."latestAssessmentId"
CROSS JOIN LATERAL (
  VALUES
    ('ANTHROPOMETRICS'::"AssessmentSectionType", a."heightCm" IS NOT NULL OR a."weightKg" IS NOT NULL),
    ('MEDICAL'::"AssessmentSectionType", a."medicalConditions" IS NOT NULL OR a."allergies" IS NOT NULL OR a."medications" IS NOT NULL),
    ('LIFESTYLE'::"AssessmentSectionType", a."activityLevel" IS NOT NULL OR a."sleepHours" IS NOT NULL OR a."waterIntakeLiters" IS NOT NULL),
    ('LABS'::"AssessmentSectionType", false)
) AS s(section, has_data)
ON CONFLICT ("tenantId", "profileId", "section") DO NOTHING;

-- Backfill latest legacy anthropometrics as append-only V2 records.
INSERT INTO "client_anthropometric_records" ("id", "tenantId", "clientId", "profileId", "assessmentId", "measuredAt", "heightCm", "weightKg", "bmi", "createdAt", "updatedAt")
SELECT concat('ant_', substr(md5(p."id" || random()::text), 1, 20)),
       p."tenantId",
       p."clientId",
       p."id",
       a."id",
       a."assessmentDate",
       a."heightCm",
       a."weightKg",
       a."bmi",
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "client_clinical_profiles" p
JOIN "assessments" a ON a."id" = p."latestAssessmentId"
WHERE a."heightCm" IS NOT NULL OR a."weightKg" IS NOT NULL;

-- Backfill lifestyle and goal summaries where available.
INSERT INTO "client_lifestyle_profiles" ("id", "tenantId", "clientId", "profileId", "assessmentId", "sleepHours", "hydrationLiters", "activityLevel", "createdAt", "updatedAt")
SELECT concat('life_', substr(md5(p."id" || random()::text), 1, 20)),
       p."tenantId",
       p."clientId",
       p."id",
       a."id",
       a."sleepHours",
       a."waterIntakeLiters",
       a."activityLevel",
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "client_clinical_profiles" p
JOIN "assessments" a ON a."id" = p."latestAssessmentId"
WHERE a."sleepHours" IS NOT NULL OR a."waterIntakeLiters" IS NOT NULL OR a."activityLevel" IS NOT NULL
ON CONFLICT ("clientId") DO NOTHING;

INSERT INTO "client_goal_profiles" ("id", "tenantId", "clientId", "profileId", "assessmentId", "goalType", "status", "notes", "versionNumber", "startedAt", "createdAt", "updatedAt")
SELECT concat('goal_', substr(md5(p."id" || random()::text), 1, 20)),
       p."tenantId",
       p."clientId",
       p."id",
       a."id",
       'CUSTOM'::"ClientGoalType",
       'ACTIVE'::"ClientGoalStatus",
       a."goal",
       1,
       a."assessmentDate",
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "client_clinical_profiles" p
JOIN "assessments" a ON a."id" = p."latestAssessmentId"
WHERE a."goal" IS NOT NULL;

-- Backfill relational medical rows as queryable summaries.
INSERT INTO "client_conditions" ("id", "tenantId", "clientId", "profileId", "assessmentId", "name", "createdAt", "updatedAt")
SELECT concat('cond_', substr(md5(p."id" || random()::text), 1, 20)), p."tenantId", p."clientId", p."id", a."id", a."medicalConditions", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "client_clinical_profiles" p JOIN "assessments" a ON a."id" = p."latestAssessmentId"
WHERE a."medicalConditions" IS NOT NULL;

INSERT INTO "client_allergies" ("id", "tenantId", "clientId", "profileId", "assessmentId", "allergen", "createdAt", "updatedAt")
SELECT concat('alg_', substr(md5(p."id" || random()::text), 1, 20)), p."tenantId", p."clientId", p."id", a."id", a."allergies", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "client_clinical_profiles" p JOIN "assessments" a ON a."id" = p."latestAssessmentId"
WHERE a."allergies" IS NOT NULL;

INSERT INTO "client_medications" ("id", "tenantId", "clientId", "profileId", "assessmentId", "name", "createdAt", "updatedAt")
SELECT concat('med_', substr(md5(p."id" || random()::text), 1, 20)), p."tenantId", p."clientId", p."id", a."id", a."medications", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "client_clinical_profiles" p JOIN "assessments" a ON a."id" = p."latestAssessmentId"
WHERE a."medications" IS NOT NULL;

-- Initial immutable snapshot version per backfilled profile.
INSERT INTO "assessment_snapshots" ("id", "tenantId", "clientId", "profileId", "assessmentId", "version", "snapshot", "sourceUpdatedAt", "generatedAt", "createdAt")
SELECT concat('snap_', substr(md5(p."id" || random()::text), 1, 20)),
       p."tenantId",
       p."clientId",
       p."id",
       p."latestAssessmentId",
       1,
       jsonb_build_object(
         'profile', jsonb_build_object('id', p."id", 'clientId', p."clientId", 'latestAssessmentId', p."latestAssessmentId"),
         'legacySummary', jsonb_build_object(
           'heightCm', a."heightCm",
           'weightKg', a."weightKg",
           'bmi', a."bmi",
           'goal', a."goal",
           'activityLevel', a."activityLevel",
           'waterIntakeLiters', a."waterIntakeLiters",
           'sleepHours', a."sleepHours",
           'medicalConditions', a."medicalConditions",
           'allergies', a."allergies",
           'medications', a."medications"
         )
       ),
       a."updatedAt",
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "client_clinical_profiles" p
JOIN "assessments" a ON a."id" = p."latestAssessmentId"
ON CONFLICT ("tenantId", "clientId", "version") DO NOTHING;
