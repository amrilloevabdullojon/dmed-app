-- Create ProfileVisibility enum
CREATE TYPE "ProfileVisibility" AS ENUM ('INTERNAL', 'PRIVATE');

-- Create UserProfile table
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "phone" TEXT,
    "position" TEXT,
    "department" TEXT,
    "location" TEXT,
    "timezone" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publicEmail" BOOLEAN NOT NULL DEFAULT false,
    "publicPhone" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'INTERNAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- Indexes and relation
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");
CREATE INDEX "UserProfile_userId_idx" ON "UserProfile"("userId");
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
