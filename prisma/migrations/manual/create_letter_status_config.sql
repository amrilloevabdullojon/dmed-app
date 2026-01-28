-- CreateTable
CREATE TABLE IF NOT EXISTS "LetterStatusConfig" (
    "id" TEXT NOT NULL,
    "status" "LetterStatus" NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LetterStatusConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LetterStatusConfig_status_key" ON "LetterStatusConfig"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LetterStatusConfig_order_idx" ON "LetterStatusConfig"("order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LetterStatusConfig_isActive_idx" ON "LetterStatusConfig"("isActive");
