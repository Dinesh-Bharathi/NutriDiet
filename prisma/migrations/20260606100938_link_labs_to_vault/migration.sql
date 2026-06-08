-- AlterTable
ALTER TABLE "client_lab_results" ADD COLUMN     "documentPageReference" TEXT,
ADD COLUMN     "vaultDocumentId" TEXT;

-- CreateIndex
CREATE INDEX "client_lab_results_vaultDocumentId_idx" ON "client_lab_results"("vaultDocumentId");

-- AddForeignKey
ALTER TABLE "client_lab_results" ADD CONSTRAINT "client_lab_results_vaultDocumentId_fkey" FOREIGN KEY ("vaultDocumentId") REFERENCES "vault_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
