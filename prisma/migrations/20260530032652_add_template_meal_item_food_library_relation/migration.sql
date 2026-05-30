-- AlterTable
ALTER TABLE "diet_plan_meal_items" ADD COLUMN     "foodLibraryId" TEXT,
ADD COLUMN     "sourceType" "FoodSourceType" NOT NULL DEFAULT 'CUSTOM';

-- AlterTable
ALTER TABLE "diet_plan_template_meal_items" ADD COLUMN     "foodLibraryId" TEXT,
ADD COLUMN     "sourceType" "FoodSourceType" NOT NULL DEFAULT 'CUSTOM';

-- CreateIndex
CREATE INDEX "diet_plan_meal_items_foodLibraryId_idx" ON "diet_plan_meal_items"("foodLibraryId");

-- CreateIndex
CREATE INDEX "diet_plan_template_meal_items_foodLibraryId_idx" ON "diet_plan_template_meal_items"("foodLibraryId");

-- AddForeignKey
ALTER TABLE "diet_plan_meal_items" ADD CONSTRAINT "diet_plan_meal_items_foodLibraryId_fkey" FOREIGN KEY ("foodLibraryId") REFERENCES "food_library"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_plan_template_meal_items" ADD CONSTRAINT "diet_plan_template_meal_items_foodLibraryId_fkey" FOREIGN KEY ("foodLibraryId") REFERENCES "food_library"("id") ON DELETE SET NULL ON UPDATE CASCADE;
