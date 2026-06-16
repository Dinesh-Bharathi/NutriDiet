-- CreateEnum
CREATE TYPE "WhatsAppSenderType" AS ENUM ('USER', 'SYSTEM', 'CLIENT');

-- CreateEnum
CREATE TYPE "WhatsAppMessageSource" AS ENUM ('MANUAL', 'AUTOMATION', 'AI', 'API');

-- CreateEnum
CREATE TYPE "WhatsAppMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "WhatsAppMessageType" AS ENUM ('TEXT', 'TEMPLATE', 'DOCUMENT', 'IMAGE', 'AUDIO', 'VIDEO', 'LOCATION', 'CONTACT');

-- CreateEnum
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- AlterEnum
ALTER TYPE "FileEntityType" ADD VALUE 'WHATSAPP_MESSAGE';

-- AlterTable
ALTER TABLE "file_assets" ADD COLUMN     "whatsAppMessageId" TEXT;

-- CreateTable
CREATE TABLE "whatsapp_conversations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "optInStatus" BOOLEAN NOT NULL DEFAULT false,
    "optInCapturedAt" TIMESTAMP(3),
    "lastMessageId" TEXT,
    "lastMessageText" VARCHAR(500),
    "lastMessageAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "conversationStartedAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "lastClientMessageAt" TIMESTAMP(3),
    "lastPractitionerMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "metaMessageId" TEXT,
    "direction" "WhatsAppMessageDirection" NOT NULL,
    "type" "WhatsAppMessageType" NOT NULL,
    "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "senderType" "WhatsAppSenderType" NOT NULL,
    "source" "WhatsAppMessageSource" NOT NULL DEFAULT 'MANUAL',
    "body" TEXT,
    "templateName" TEXT,
    "templateLanguage" VARCHAR(10),
    "mediaMimeType" VARCHAR(100),
    "mediaSize" INTEGER,
    "senderUserId" TEXT,
    "senderRole" "Role",
    "senderName" VARCHAR(100),
    "senderPhone" VARCHAR(30),
    "createdByUserId" TEXT,
    "errorText" TEXT,
    "lastErrorCode" VARCHAR(50),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_conversations_tenantId_idx" ON "whatsapp_conversations"("tenantId");

-- CreateIndex
CREATE INDEX "whatsapp_conversations_clientId_idx" ON "whatsapp_conversations"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversations_tenantId_clientId_key" ON "whatsapp_conversations"("tenantId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_metaMessageId_key" ON "whatsapp_messages"("metaMessageId");

-- CreateIndex
CREATE INDEX "whatsapp_messages_tenantId_idx" ON "whatsapp_messages"("tenantId");

-- CreateIndex
CREATE INDEX "whatsapp_messages_conversationId_idx" ON "whatsapp_messages"("conversationId");

-- CreateIndex
CREATE INDEX "whatsapp_messages_metaMessageId_idx" ON "whatsapp_messages"("metaMessageId");

-- CreateIndex
CREATE INDEX "whatsapp_messages_senderUserId_idx" ON "whatsapp_messages"("senderUserId");

-- CreateIndex
CREATE INDEX "whatsapp_messages_createdAt_idx" ON "whatsapp_messages"("createdAt");

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_whatsAppMessageId_fkey" FOREIGN KEY ("whatsAppMessageId") REFERENCES "whatsapp_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
