-- DropForeignKey constraints if they exist
ALTER TABLE IF EXISTS "invoices" DROP CONSTRAINT IF EXISTS "invoices_enrollmentId_fkey";
ALTER TABLE IF EXISTS "invoices" DROP CONSTRAINT IF EXISTS "invoices_clientId_fkey";
ALTER TABLE IF EXISTS "client_credit_ledgers" DROP CONSTRAINT IF EXISTS "client_credit_ledgers_enrollmentId_fkey";
ALTER TABLE IF EXISTS "client_enrollments" DROP CONSTRAINT IF EXISTS "client_enrollments_packageId_fkey";
ALTER TABLE IF EXISTS "client_enrollments" DROP CONSTRAINT IF EXISTS "client_enrollments_clientId_fkey";
ALTER TABLE IF EXISTS "package_templates" DROP CONSTRAINT IF EXISTS "package_templates_dietPlanTemplateId_fkey";
ALTER TABLE IF EXISTS "package_templates" DROP CONSTRAINT IF EXISTS "package_templates_packageId_fkey";
ALTER TABLE IF EXISTS "package_assets" DROP CONSTRAINT IF EXISTS "package_assets_fileAssetId_fkey";
ALTER TABLE IF EXISTS "package_assets" DROP CONSTRAINT IF EXISTS "package_assets_packageId_fkey";
ALTER TABLE IF EXISTS "package_credits" DROP CONSTRAINT IF EXISTS "package_credits_packageId_fkey";

-- DropTable
DROP TABLE IF EXISTS "invoices";
DROP TABLE IF EXISTS "client_credit_ledgers";
DROP TABLE IF EXISTS "client_enrollments";
DROP TABLE IF EXISTS "package_templates";
DROP TABLE IF EXISTS "package_assets";
DROP TABLE IF EXISTS "package_credits";
DROP TABLE IF EXISTS "packages";
