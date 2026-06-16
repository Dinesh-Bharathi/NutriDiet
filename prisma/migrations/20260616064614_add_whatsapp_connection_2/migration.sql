/*
  Warnings:

  - The values [PENDING] on the enum `WhatsAppConnectionStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "WhatsAppConnectionStatus_new" AS ENUM ('NOT_CONFIGURED', 'CONNECTED', 'DISCONNECTED', 'ERROR');
ALTER TABLE "whatsapp_connections" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "whatsapp_connections" ALTER COLUMN "status" TYPE "WhatsAppConnectionStatus_new" USING ("status"::text::"WhatsAppConnectionStatus_new");
ALTER TYPE "WhatsAppConnectionStatus" RENAME TO "WhatsAppConnectionStatus_old";
ALTER TYPE "WhatsAppConnectionStatus_new" RENAME TO "WhatsAppConnectionStatus";
DROP TYPE "WhatsAppConnectionStatus_old";
ALTER TABLE "whatsapp_connections" ALTER COLUMN "status" SET DEFAULT 'NOT_CONFIGURED';
COMMIT;

-- AlterTable
ALTER TABLE "whatsapp_connections" ALTER COLUMN "status" SET DEFAULT 'NOT_CONFIGURED';
