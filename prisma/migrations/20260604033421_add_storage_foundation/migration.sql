-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('CLOUDINARY');

-- CreateEnum
CREATE TYPE "FileEntityType" AS ENUM ('TENANT', 'USER', 'CLIENT', 'ASSESSMENT', 'LAB_REPORT', 'DIET_PLAN', 'PACKAGE', 'PROGRAM', 'PROGRAM_CONTENT', 'APPOINTMENT', 'INVOICE', 'OTHER');

-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('PUBLIC', 'PROTECTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('ACTIVE', 'DELETED');

-- CreateTable
CREATE TABLE "file_assets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" "FileEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "assetId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "storageProvider" "StorageProvider" NOT NULL DEFAULT 'CLOUDINARY',
    "resourceType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "checksum" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "visibility" "FileVisibility" NOT NULL DEFAULT 'PRIVATE',
    "status" "FileStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "file_assets_tenantId_idx" ON "file_assets"("tenantId");

-- CreateIndex
CREATE INDEX "file_assets_tenantId_entityType_entityId_idx" ON "file_assets"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "file_assets_status_idx" ON "file_assets"("status");

-- CreateIndex
CREATE INDEX "file_assets_visibility_idx" ON "file_assets"("visibility");

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
