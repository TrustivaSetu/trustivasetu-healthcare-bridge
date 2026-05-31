-- AlterTable: add operational columns to Lead
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "treatmentCategory" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "utrNumber" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "nachStatus" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "agreementSigned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Lead_nachStatus_idx" ON "Lead"("nachStatus");
CREATE INDEX IF NOT EXISTS "Lead_agreementSigned_idx" ON "Lead"("agreementSigned");
