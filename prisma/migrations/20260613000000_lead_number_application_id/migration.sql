-- Safe idempotent migration: add leadNumber (auto-increment), applicationNumber, applicationCreatedAt to Lead

-- Step 1: Create sequence if it doesn't already exist
-- (may already exist from a failed previous db push attempt)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_sequences WHERE sequencename = 'Lead_leadNumber_seq'
  ) THEN
    CREATE SEQUENCE "Lead_leadNumber_seq";
  END IF;
END $$;

-- Step 2: Add leadNumber column (nullable so existing rows stay NULL)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "leadNumber" INTEGER DEFAULT nextval('"Lead_leadNumber_seq"');

-- Step 3: Tie the sequence ownership to the column (safe to run multiple times via DO block)
DO $$ BEGIN
  PERFORM pg_get_serial_sequence('"Lead"', 'leadNumber');
  ALTER SEQUENCE "Lead_leadNumber_seq" OWNED BY "Lead"."leadNumber";
EXCEPTION WHEN OTHERS THEN
  NULL; -- ignore if already owned or column doesn't exist yet
END $$;

-- Step 4: Add applicationNumber and applicationCreatedAt
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "applicationNumber" INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "applicationCreatedAt" TIMESTAMP(3);

-- Step 5: Add index on leadNumber
CREATE INDEX IF NOT EXISTS "Lead_leadNumber_idx" ON "Lead"("leadNumber");
