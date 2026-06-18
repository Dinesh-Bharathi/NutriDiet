-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "soundId" TEXT NOT NULL DEFAULT 'message-default',
ALTER COLUMN "categories" DROP NOT NULL;
