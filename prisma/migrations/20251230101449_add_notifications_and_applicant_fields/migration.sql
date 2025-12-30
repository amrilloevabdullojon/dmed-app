-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('COMMENT', 'STATUS', 'ASSIGNMENT', 'SYSTEM');

-- AlterTable
ALTER TABLE "Letter" ADD COLUMN     "applicantAccessToken" TEXT,
ADD COLUMN     "applicantAccessTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "applicantEmail" TEXT,
ADD COLUMN     "applicantName" TEXT,
ADD COLUMN     "applicantPhone" TEXT,
ADD COLUMN     "applicantTelegramChatId" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "letterId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_letterId_idx" ON "Notification"("letterId");

-- CreateIndex
CREATE UNIQUE INDEX "Letter_applicantAccessToken_key" ON "Letter"("applicantAccessToken");


-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "Letter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
