/*
  Warnings:

  - You are about to drop the column `sourceType` on the `food_library` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MeasurementSystem" AS ENUM ('METRIC', 'IMPERIAL');

-- CreateEnum
CREATE TYPE "SwapStrategy" AS ENUM ('BALANCED_MATCH', 'PROTEIN_MATCH', 'CARB_MATCH', 'FAT_MATCH', 'CALORIE_MATCH');

-- CreateEnum
CREATE TYPE "SwapScope" AS ENUM ('SINGLE_ITEM', 'DIET_PLAN', 'TEMPLATE', 'CYCLE', 'CYCLE_DAY');

-- AlterTable
ALTER TABLE "food_library" DROP COLUMN "sourceType",
ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en-US',
ADD COLUMN     "measurementSystem" "MeasurementSystem" NOT NULL DEFAULT 'METRIC',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "meal_swap_histories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mealItemId" TEXT,
    "originalFoodId" TEXT NOT NULL,
    "targetFoodId" TEXT NOT NULL,
    "swapStrategy" "SwapStrategy" NOT NULL,
    "scope" "SwapScope" NOT NULL,
    "matchScore" INTEGER,
    "quantityBefore" DOUBLE PRECISION NOT NULL,
    "quantityAfter" DOUBLE PRECISION NOT NULL,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_swap_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meal_swap_histories_tenantId_idx" ON "meal_swap_histories"("tenantId");

-- CreateIndex
CREATE INDEX "meal_swap_histories_performedBy_idx" ON "meal_swap_histories"("performedBy");

-- CreateIndex
CREATE INDEX "meal_swap_histories_originalFoodId_idx" ON "meal_swap_histories"("originalFoodId");

-- CreateIndex
CREATE INDEX "meal_swap_histories_targetFoodId_idx" ON "meal_swap_histories"("targetFoodId");

-- AddForeignKey
ALTER TABLE "meal_swap_histories" ADD CONSTRAINT "meal_swap_histories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_swap_histories" ADD CONSTRAINT "meal_swap_histories_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_swap_histories" ADD CONSTRAINT "meal_swap_histories_originalFoodId_fkey" FOREIGN KEY ("originalFoodId") REFERENCES "food_library"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_swap_histories" ADD CONSTRAINT "meal_swap_histories_targetFoodId_fkey" FOREIGN KEY ("targetFoodId") REFERENCES "food_library"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
