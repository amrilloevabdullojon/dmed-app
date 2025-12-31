-- Create enums
CREATE TYPE "FileStorageProvider" AS ENUM ('DRIVE', 'LOCAL');
CREATE TYPE "FileStatus" AS ENUM ('READY', 'UPLOADING', 'FAILED', 'PENDING_SYNC');

-- Add letter attachments folder field
ALTER TABLE "Letter" ADD COLUMN "attachmentsFolderId" TEXT;

-- Extend File metadata
ALTER TABLE "File" ADD COLUMN "driveFileId" TEXT;
ALTER TABLE "File" ADD COLUMN "storageProvider" "FileStorageProvider" NOT NULL DEFAULT 'DRIVE';
ALTER TABLE "File" ADD COLUMN "storagePath" TEXT;
ALTER TABLE "File" ADD COLUMN "status" "FileStatus" NOT NULL DEFAULT 'READY';
ALTER TABLE "File" ADD COLUMN "uploadError" TEXT;
ALTER TABLE "File" ADD COLUMN "syncAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "File" ADD COLUMN "lastSyncAttemptAt" TIMESTAMP(3);
ALTER TABLE "File" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Indexes
CREATE INDEX "File_status_idx" ON "File"("status");
