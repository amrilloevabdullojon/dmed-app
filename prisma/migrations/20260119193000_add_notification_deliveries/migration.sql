-- Create enum for NotificationChannel if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationChannel') THEN
        CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'TELEGRAM', 'SMS', 'PUSH');
    END IF;
END $$;

-- Create enum for NotificationDeliveryStatus if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationDeliveryStatus') THEN
        CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');
    END IF;
END $$;

-- Ensure NotificationDelivery table exists
CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT,
    "userId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "recipient" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- Ensure column types are enums when table already exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'NotificationDelivery'
          AND column_name = 'channel'
          AND data_type = 'text'
    ) THEN
        ALTER TABLE "NotificationDelivery"
        ALTER COLUMN "channel" TYPE "NotificationChannel"
        USING "channel"::"NotificationChannel";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'NotificationDelivery'
          AND column_name = 'status'
          AND data_type = 'text'
    ) THEN
        ALTER TABLE "NotificationDelivery"
        ALTER COLUMN "status" TYPE "NotificationDeliveryStatus"
        USING "status"::"NotificationDeliveryStatus";
    END IF;
END $$;

-- Ensure default for status
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'NotificationDelivery'
          AND column_name = 'status'
    ) THEN
        ALTER TABLE "NotificationDelivery"
        ALTER COLUMN "status" SET DEFAULT 'QUEUED';
    END IF;
END $$;

-- Create indexes if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'NotificationDelivery_userId_channel_createdAt_idx'
    ) THEN
        CREATE INDEX "NotificationDelivery_userId_channel_createdAt_idx"
        ON "NotificationDelivery"("userId", "channel", "createdAt");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'NotificationDelivery_notificationId_idx'
    ) THEN
        CREATE INDEX "NotificationDelivery_notificationId_idx"
        ON "NotificationDelivery"("notificationId");
    END IF;
END $$;

-- Ensure foreign keys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'NotificationDelivery_notificationId_fkey'
    ) THEN
        ALTER TABLE "NotificationDelivery"
        ADD CONSTRAINT "NotificationDelivery_notificationId_fkey"
        FOREIGN KEY ("notificationId") REFERENCES "Notification"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'NotificationDelivery_userId_fkey'
    ) THEN
        ALTER TABLE "NotificationDelivery"
        ADD CONSTRAINT "NotificationDelivery_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
