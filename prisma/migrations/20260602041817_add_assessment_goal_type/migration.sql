-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "goalType" "ClientGoalType";

-- CreateIndex
CREATE INDEX "client_clinical_profiles_clientId_idx" ON "client_clinical_profiles"("clientId");
