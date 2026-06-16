-- AlterEnum
ALTER TYPE "FileEntityType" ADD VALUE 'WHATSAPP';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WhatsAppMessageType" ADD VALUE 'VOICE';
ALTER TYPE "WhatsAppMessageType" ADD VALUE 'STICKER';
ALTER TYPE "WhatsAppMessageType" ADD VALUE 'REACTION';
ALTER TYPE "WhatsAppMessageType" ADD VALUE 'SYSTEM';

-- AlterTable
ALTER TABLE "whatsapp_messages" ADD COLUMN     "contactName" VARCHAR(255),
ADD COLUMN     "contactPayload" JSONB,
ADD COLUMN     "contactPhones" JSONB,
ADD COLUMN     "interactivePayload" JSONB,
ADD COLUMN     "locationAddress" TEXT,
ADD COLUMN     "locationLatitude" DOUBLE PRECISION,
ADD COLUMN     "locationLongitude" DOUBLE PRECISION,
ADD COLUMN     "locationName" VARCHAR(255),
ADD COLUMN     "mediaDurationSeconds" INTEGER,
ADD COLUMN     "mediaFileName" VARCHAR(255),
ADD COLUMN     "mediaHeight" INTEGER,
ADD COLUMN     "mediaUrl" TEXT,
ADD COLUMN     "mediaWidth" INTEGER,
ADD COLUMN     "previewText" VARCHAR(500),
ADD COLUMN     "replyPreviewText" TEXT,
ADD COLUMN     "replyToMessageId" TEXT,
ADD COLUMN     "replyToMetaMessageId" TEXT,
ADD COLUMN     "storageFileId" TEXT;

-- CreateTable
CREATE TABLE "whatsapp_reactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "metaMessageId" VARCHAR(100),
    "senderPhone" VARCHAR(30) NOT NULL,
    "senderName" VARCHAR(100),
    "emoji" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_reactions_tenantId_idx" ON "whatsapp_reactions"("tenantId");

-- CreateIndex
CREATE INDEX "whatsapp_reactions_messageId_idx" ON "whatsapp_reactions"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_reactions_messageId_senderPhone_key" ON "whatsapp_reactions"("messageId", "senderPhone");

-- AddForeignKey
ALTER TABLE "whatsapp_reactions" ADD CONSTRAINT "whatsapp_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "whatsapp_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
