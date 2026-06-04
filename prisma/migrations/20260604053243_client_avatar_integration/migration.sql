/*
  Warnings:

  - You are about to drop the column `avatarUrl` on the `clients` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "clients" DROP COLUMN "avatarUrl",
ADD COLUMN     "avatarAssetId" TEXT;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_avatarAssetId_fkey" FOREIGN KEY ("avatarAssetId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
