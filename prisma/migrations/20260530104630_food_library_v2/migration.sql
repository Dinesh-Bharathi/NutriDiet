-- CreateEnum
CREATE TYPE "EquivalencyType" AS ENUM ('PROTEIN', 'CARB', 'FAT', 'CALORIE');

-- CreateEnum
CREATE TYPE "FoodServingUnitType" AS ENUM ('GRAM', 'CUP', 'BOWL', 'TBSP', 'TSP', 'PIECE', 'SLICE', 'SCOOP', 'SERVING');

-- CreateEnum
CREATE TYPE "FoodStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "food_library" ADD COLUMN     "brandName" TEXT,
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "commonName" TEXT,
ADD COLUMN     "searchKeywords" TEXT,
ADD COLUMN     "status" "FoodStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "food_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "parentCategoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "food_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_tags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "food_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_tag_mappings" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_tag_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_servings" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "unitType" "FoodServingUnitType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_servings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_equivalents" (
    "id" TEXT NOT NULL,
    "sourceFoodId" TEXT NOT NULL,
    "targetFoodId" TEXT NOT NULL,
    "equivalencyType" "EquivalencyType" NOT NULL,
    "similarityScore" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_equivalents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "food_categories_tenantId_idx" ON "food_categories"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "food_categories_tenantId_name_key" ON "food_categories"("tenantId", "name");

-- CreateIndex
CREATE INDEX "food_tags_tenantId_idx" ON "food_tags"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "food_tags_tenantId_name_key" ON "food_tags"("tenantId", "name");

-- CreateIndex
CREATE INDEX "food_tag_mappings_foodId_idx" ON "food_tag_mappings"("foodId");

-- CreateIndex
CREATE INDEX "food_tag_mappings_tagId_idx" ON "food_tag_mappings"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "food_tag_mappings_foodId_tagId_key" ON "food_tag_mappings"("foodId", "tagId");

-- CreateIndex
CREATE INDEX "food_servings_foodId_idx" ON "food_servings"("foodId");

-- CreateIndex
CREATE INDEX "food_equivalents_sourceFoodId_idx" ON "food_equivalents"("sourceFoodId");

-- CreateIndex
CREATE INDEX "food_equivalents_targetFoodId_idx" ON "food_equivalents"("targetFoodId");

-- CreateIndex
CREATE UNIQUE INDEX "food_equivalents_sourceFoodId_targetFoodId_equivalencyType_key" ON "food_equivalents"("sourceFoodId", "targetFoodId", "equivalencyType");

-- CreateIndex
CREATE INDEX "food_library_tenantId_categoryId_idx" ON "food_library"("tenantId", "categoryId");

-- CreateIndex
CREATE INDEX "food_library_tenantId_status_idx" ON "food_library"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "food_library" ADD CONSTRAINT "food_library_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "food_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_categories" ADD CONSTRAINT "food_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_categories" ADD CONSTRAINT "food_categories_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "food_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_tags" ADD CONSTRAINT "food_tags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_tag_mappings" ADD CONSTRAINT "food_tag_mappings_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food_library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_tag_mappings" ADD CONSTRAINT "food_tag_mappings_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "food_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_servings" ADD CONSTRAINT "food_servings_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food_library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_equivalents" ADD CONSTRAINT "food_equivalents_sourceFoodId_fkey" FOREIGN KEY ("sourceFoodId") REFERENCES "food_library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_equivalents" ADD CONSTRAINT "food_equivalents_targetFoodId_fkey" FOREIGN KEY ("targetFoodId") REFERENCES "food_library"("id") ON DELETE CASCADE ON UPDATE CASCADE;
