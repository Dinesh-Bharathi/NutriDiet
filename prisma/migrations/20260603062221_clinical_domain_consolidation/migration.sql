/*
  Warnings:

  - You are about to drop the column `goal` on the `diet_plan_templates` table. All the data in the column will be lost.
  - You are about to drop the column `goal` on the `diet_plans` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "diet_plan_templates" DROP COLUMN "goal",
ADD COLUMN     "goalType" "ClientGoalType";

-- AlterTable
ALTER TABLE "diet_plans" DROP COLUMN "goal",
ADD COLUMN     "goalProfileId" TEXT;

-- AddForeignKey
ALTER TABLE "diet_plans" ADD CONSTRAINT "diet_plans_goalProfileId_fkey" FOREIGN KEY ("goalProfileId") REFERENCES "client_goal_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
