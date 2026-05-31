-- AlterTable (repair: columns missing if los_metadata ran before this fix)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "enquiryType" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "motherName" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "treatmentName" TEXT;
