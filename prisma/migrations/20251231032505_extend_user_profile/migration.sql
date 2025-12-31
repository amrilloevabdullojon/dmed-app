-- Extend UserProfile fields
ALTER TABLE "UserProfile" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "coverUrl" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "publicBio" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserProfile" ADD COLUMN "publicPosition" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserProfile" ADD COLUMN "publicDepartment" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserProfile" ADD COLUMN "publicLocation" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserProfile" ADD COLUMN "publicTimezone" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserProfile" ADD COLUMN "publicSkills" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserProfile" ADD COLUMN "publicProfileEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserProfile" ADD COLUMN "publicProfileToken" TEXT;

CREATE UNIQUE INDEX "UserProfile_publicProfileToken_key" ON "UserProfile"("publicProfileToken");
