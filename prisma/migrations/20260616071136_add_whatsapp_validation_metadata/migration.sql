-- AlterTable
ALTER TABLE "whatsapp_connections" ADD COLUMN     "credentialFingerprint" TEXT,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastErrorAt" TIMESTAMP(3),
ADD COLUMN     "lastErrorCode" TEXT,
ADD COLUMN     "lastSuccessfulValidationAt" TIMESTAMP(3),
ADD COLUMN     "lastValidatedAt" TIMESTAMP(3),
ADD COLUMN     "validationAttempts" INTEGER NOT NULL DEFAULT 0;
