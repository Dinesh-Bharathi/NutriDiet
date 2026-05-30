-- AlterTable
ALTER TABLE "diet_plan_meals" ADD COLUMN     "cycleDayId" TEXT;

-- AlterTable
ALTER TABLE "diet_plan_template_meals" ADD COLUMN     "cycleDayId" TEXT;

-- AlterTable
ALTER TABLE "diet_plans" ADD COLUMN     "cycleStartDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "diet_plan_cycles" (
    "id" TEXT NOT NULL,
    "dietPlanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDay" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diet_plan_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_plan_cycle_days" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "dayLabel" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "plannedCalories" INTEGER NOT NULL DEFAULT 0,
    "plannedProtein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plannedCarbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plannedFat" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "diet_plan_cycle_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_cycles" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_cycle_days" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "dayLabel" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "plannedCalories" INTEGER NOT NULL DEFAULT 0,
    "plannedProtein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plannedCarbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plannedFat" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "template_cycle_days_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diet_plan_cycles_dietPlanId_idx" ON "diet_plan_cycles"("dietPlanId");

-- CreateIndex
CREATE INDEX "diet_plan_cycle_days_cycleId_idx" ON "diet_plan_cycle_days"("cycleId");

-- CreateIndex
CREATE INDEX "template_cycles_templateId_idx" ON "template_cycles"("templateId");

-- CreateIndex
CREATE INDEX "template_cycle_days_cycleId_idx" ON "template_cycle_days"("cycleId");

-- CreateIndex
CREATE INDEX "diet_plan_meals_cycleDayId_idx" ON "diet_plan_meals"("cycleDayId");

-- CreateIndex
CREATE INDEX "diet_plan_template_meals_cycleDayId_idx" ON "diet_plan_template_meals"("cycleDayId");

-- AddForeignKey
ALTER TABLE "diet_plan_meals" ADD CONSTRAINT "diet_plan_meals_cycleDayId_fkey" FOREIGN KEY ("cycleDayId") REFERENCES "diet_plan_cycle_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_plan_template_meals" ADD CONSTRAINT "diet_plan_template_meals_cycleDayId_fkey" FOREIGN KEY ("cycleDayId") REFERENCES "template_cycle_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_plan_cycles" ADD CONSTRAINT "diet_plan_cycles_dietPlanId_fkey" FOREIGN KEY ("dietPlanId") REFERENCES "diet_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_plan_cycle_days" ADD CONSTRAINT "diet_plan_cycle_days_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "diet_plan_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_cycles" ADD CONSTRAINT "template_cycles_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "diet_plan_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_cycle_days" ADD CONSTRAINT "template_cycle_days_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "template_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
