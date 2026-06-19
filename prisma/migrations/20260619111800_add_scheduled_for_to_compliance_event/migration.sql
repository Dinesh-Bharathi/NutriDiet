/*
  Warnings:

  - Added the required column `scheduledFor` to the `client_compliance_events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable (Add as nullable first)
ALTER TABLE "client_compliance_events" ADD COLUMN "scheduledFor" TIMESTAMP(3);

-- Backfill from reminder_jobs
UPDATE "client_compliance_events" e
SET "scheduledFor" = j."scheduledFor"
FROM "reminder_jobs" j
WHERE e."reminderJobId" = j."id";

-- Fallback to createdAt for any orphan events
UPDATE "client_compliance_events"
SET "scheduledFor" = "createdAt"
WHERE "scheduledFor" IS NULL;

-- AlterTable (Make it NOT NULL)
ALTER TABLE "client_compliance_events" ALTER COLUMN "scheduledFor" SET NOT NULL;
