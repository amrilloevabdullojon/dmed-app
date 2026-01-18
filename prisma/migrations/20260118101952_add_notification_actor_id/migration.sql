-- Create NotificationPriority enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationPriority') THEN
        CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
    END IF;
END $$;

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

-- Add foreign key constraint for actorId if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'Notification_actorId_fkey'
    ) THEN
        ALTER TABLE "Notification"
        ADD CONSTRAINT "Notification_actorId_fkey"
        FOREIGN KEY ("actorId")
        REFERENCES "User"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Ensure priority column exists in Notification table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Notification' AND column_name = 'priority'
    ) THEN
        ALTER TABLE "Notification" ADD COLUMN "priority" "NotificationPriority" DEFAULT 'NORMAL' NOT NULL;
    END IF;
END $$;

-- Ensure metadata column exists in Notification table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Notification' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE "Notification" ADD COLUMN "metadata" JSONB;
    END IF;
END $$;
