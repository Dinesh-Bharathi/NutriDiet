-- CreateEnum
CREATE TYPE "FoodSourceType" AS ENUM ('CUSTOM', 'SYSTEM');

-- AlterTable
ALTER TABLE "diet_plans" ADD COLUMN     "totalCalories" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCarbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalFat" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalProtein" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "versionNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "food_library" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "foodName" TEXT NOT NULL,
    "sourceType" "FoodSourceType" NOT NULL DEFAULT 'CUSTOM',
    "defaultQuantity" DOUBLE PRECISION NOT NULL,
    "defaultUnit" TEXT NOT NULL,
    "servingSize" DOUBLE PRECISION NOT NULL,
    "servingUnit" TEXT NOT NULL,
    "calories" DOUBLE PRECISION,
    "protein" DOUBLE PRECISION,
    "carbs" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "food_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_plan_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "goal" TEXT,
    "dailyCalories" INTEGER,
    "proteinGrams" DOUBLE PRECISION,
    "carbGrams" DOUBLE PRECISION,
    "fatGrams" DOUBLE PRECISION,
    "totalCalories" INTEGER NOT NULL DEFAULT 0,
    "totalProtein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCarbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "diet_plan_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_plan_template_meals" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" "MealType" NOT NULL,
    "mealOrder" INTEGER NOT NULL,
    "mealTime" TEXT,
    "notes" TEXT,

    CONSTRAINT "diet_plan_template_meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_plan_template_meal_items" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "foodName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "calories" DOUBLE PRECISION,
    "protein" DOUBLE PRECISION,
    "carbs" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "diet_plan_template_meal_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "food_library_tenantId_idx" ON "food_library"("tenantId");

-- CreateIndex
CREATE INDEX "food_library_tenantId_foodName_idx" ON "food_library"("tenantId", "foodName");

-- CreateIndex
CREATE INDEX "diet_plan_templates_tenantId_idx" ON "diet_plan_templates"("tenantId");

-- CreateIndex
CREATE INDEX "diet_plan_template_meals_templateId_idx" ON "diet_plan_template_meals"("templateId");

-- CreateIndex
CREATE INDEX "diet_plan_template_meal_items_mealId_idx" ON "diet_plan_template_meal_items"("mealId");

-- AddForeignKey
ALTER TABLE "food_library" ADD CONSTRAINT "food_library_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_plan_templates" ADD CONSTRAINT "diet_plan_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_plan_templates" ADD CONSTRAINT "diet_plan_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_plan_template_meals" ADD CONSTRAINT "diet_plan_template_meals_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "diet_plan_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_plan_template_meal_items" ADD CONSTRAINT "diet_plan_template_meal_items_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "diet_plan_template_meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
