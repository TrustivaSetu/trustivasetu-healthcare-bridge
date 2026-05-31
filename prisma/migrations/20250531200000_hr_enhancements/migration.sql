-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Add reportingManagerId to User
ALTER TABLE "User" ADD COLUMN "reportingManagerId" TEXT;

-- AddForeignKey for reportingManagerId
ALTER TABLE "User" ADD CONSTRAINT "User_reportingManagerId_fkey"
    FOREIGN KEY ("reportingManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add approval columns to Attendance
ALTER TABLE "Attendance" ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Attendance" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Attendance" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "approvalToken" TEXT;

-- CreateUniqueIndex for approvalToken
CREATE UNIQUE INDEX "Attendance_approvalToken_key" ON "Attendance"("approvalToken");

-- AddForeignKey for approvedById
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable OtpToken
CREATE TABLE "OtpToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailOtp" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'PASSWORD_RESET',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtpToken_email_idx" ON "OtpToken"("email");
