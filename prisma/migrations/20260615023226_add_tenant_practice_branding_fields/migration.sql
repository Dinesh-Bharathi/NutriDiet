-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "practiceEmail" TEXT,
ADD COLUMN     "practicePhone" TEXT,
ADD COLUMN     "state" TEXT;
