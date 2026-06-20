-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReminderJobType" ADD VALUE 'WATER_FOLLOWUP';
ALTER TYPE "ReminderJobType" ADD VALUE 'SLEEP_FOLLOWUP';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReminderTemplateType" ADD VALUE 'WATER_FOLLOWUP';
ALTER TYPE "ReminderTemplateType" ADD VALUE 'SLEEP_FOLLOWUP';
