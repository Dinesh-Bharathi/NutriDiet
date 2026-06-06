-- CreateTable
CREATE TABLE "vault_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vault_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vault_documents_assetId_key" ON "vault_documents"("assetId");

-- CreateIndex
CREATE INDEX "vault_documents_tenantId_clientId_deletedAt_idx" ON "vault_documents"("tenantId", "clientId", "deletedAt");

-- AddForeignKey
ALTER TABLE "vault_documents" ADD CONSTRAINT "vault_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_documents" ADD CONSTRAINT "vault_documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_documents" ADD CONSTRAINT "vault_documents_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
