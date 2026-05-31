-- CreateEnum
CREATE TYPE "AppointmentLetterStatus" AS ENUM ('PENDING_ACKNOWLEDGEMENT', 'ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "AppointmentLetter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "letterNumber" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "AppointmentLetterStatus" NOT NULL DEFAULT 'PENDING_ACKNOWLEDGEMENT',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "employeeName" TEXT NOT NULL,
    "designation" TEXT,
    "department" TEXT,
    "dateOfJoining" DATE,
    "employmentType" TEXT NOT NULL DEFAULT 'PROBATION',
    "reportingManagerName" TEXT,
    "reportingManagerDesignation" TEXT,
    "workLocation" TEXT,
    "grossSalary" DOUBLE PRECISION,
    "salaryBreakdown" JSONB,
    "travelRatePerKm" DOUBLE PRECISION,
    "monthlyExpenseCap" DOUBLE PRECISION,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentLetter_letterNumber_key" ON "AppointmentLetter"("letterNumber");
CREATE INDEX "AppointmentLetter_userId_idx" ON "AppointmentLetter"("userId");
CREATE INDEX "AppointmentLetter_status_idx" ON "AppointmentLetter"("status");

-- AddForeignKey
ALTER TABLE "AppointmentLetter" ADD CONSTRAINT "AppointmentLetter_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
