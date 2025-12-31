-- Extend UserProfile with last login visibility
ALTER TABLE "UserProfile" ADD COLUMN "publicLastLogin" BOOLEAN NOT NULL DEFAULT false;
