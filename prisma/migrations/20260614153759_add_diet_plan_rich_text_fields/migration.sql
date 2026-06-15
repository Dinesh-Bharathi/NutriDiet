-- AlterTable
ALTER TABLE "diet_plan_templates" ADD COLUMN     "hydration" TEXT,
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "lifestyleAdvice" TEXT,
ADD COLUMN     "mealPrepNotes" TEXT,
ADD COLUMN     "recommendations" TEXT,
ADD COLUMN     "supplementNotes" TEXT;

-- AlterTable
ALTER TABLE "diet_plans" ADD COLUMN     "hydration" TEXT,
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "lifestyleAdvice" TEXT,
ADD COLUMN     "mealPrepNotes" TEXT,
ADD COLUMN     "recommendations" TEXT,
ADD COLUMN     "supplementNotes" TEXT;
