-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAGER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AUDITOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VIEWER';

-- CreateEnum
CREATE TYPE "DigestFrequency" AS ENUM ('NONE', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "AdminApprovalAction" AS ENUM ('DEMOTE_ADMIN', 'DELETE_ADMIN');

-- CreateEnum
CREATE TYPE "AdminApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyTelegram" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notifySms" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notifyInApp" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "quietHoursStart" TEXT,
  ADD COLUMN "quietHoursEnd" TEXT,
  ADD COLUMN "digestFrequency" "DigestFrequency" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "LoginAudit" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LoginAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminApproval" (
  "id" TEXT NOT NULL,
  "action" "AdminApprovalAction" NOT NULL,
  "status" "AdminApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "targetUserId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),

  CONSTRAINT "AdminApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginAudit_email_createdAt_idx" ON "LoginAudit"("email", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAudit_userId_createdAt_idx" ON "LoginAudit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminApproval_status_createdAt_idx" ON "AdminApproval"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AdminApproval_targetUserId_idx" ON "AdminApproval"("targetUserId");

-- AddForeignKey
ALTER TABLE "LoginAudit" ADD CONSTRAINT "LoginAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminApproval" ADD CONSTRAINT "AdminApproval_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminApproval" ADD CONSTRAINT "AdminApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminApproval" ADD CONSTRAINT "AdminApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
