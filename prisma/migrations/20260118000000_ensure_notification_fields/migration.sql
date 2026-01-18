-- Ensure actorId column exists in Notification table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Notification' AND column_name = 'actorId'
    ) THEN
        ALTER TABLE "Notification" ADD COLUMN "actorId" TEXT;
    END IF;
END $$;

-- Ensure foreign key for actorId exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'Notification_actorId_fkey'
    ) THEN
        ALTER TABLE "Notification"
        ADD CONSTRAINT "Notification_actorId_fkey"
        FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Ensure NotificationPreference table exists
CREATE TABLE IF NOT EXISTS "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- Ensure unique constraint on userId
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'NotificationPreference_userId_key'
    ) THEN
        ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_key" UNIQUE ("userId");
    END IF;
END $$;

-- Ensure foreign key for userId in NotificationPreference
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'NotificationPreference_userId_fkey'
    ) THEN
        ALTER TABLE "NotificationPreference"
        ADD CONSTRAINT "NotificationPreference_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Ensure NotificationSubscription table exists
CREATE TABLE IF NOT EXISTS "NotificationSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" TEXT NOT NULL DEFAULT 'ALL',
    "scope" TEXT NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationSubscription_pkey" PRIMARY KEY ("id")
);

-- Create index on userId and scope if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'NotificationSubscription_userId_scope_idx'
    ) THEN
        CREATE INDEX "NotificationSubscription_userId_scope_idx" ON "NotificationSubscription"("userId", "scope");
    END IF;
END $$;

-- Ensure foreign key for userId in NotificationSubscription
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'NotificationSubscription_userId_fkey'
    ) THEN
        ALTER TABLE "NotificationSubscription"
        ADD CONSTRAINT "NotificationSubscription_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create enum for NotificationSubscriptionScope if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationSubscriptionScope') THEN
        CREATE TYPE "NotificationSubscriptionScope" AS ENUM ('ROLE', 'USER', 'ALL');
    END IF;
END $$;

-- Update scope column type to enum
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'NotificationSubscription'
        AND column_name = 'scope'
        AND data_type = 'text'
    ) THEN
        ALTER TABLE "NotificationSubscription"
        ALTER COLUMN "scope" TYPE "NotificationSubscriptionScope"
        USING "scope"::"NotificationSubscriptionScope";
    END IF;
END $$;
