-- CreateTable
CREATE TABLE "UserAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAudit_userId_createdAt_idx" ON "UserAudit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserAudit_actorId_createdAt_idx" ON "UserAudit"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserAudit" ADD CONSTRAINT "UserAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAudit" ADD CONSTRAINT "UserAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
