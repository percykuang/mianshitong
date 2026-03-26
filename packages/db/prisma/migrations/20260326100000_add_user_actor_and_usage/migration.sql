-- CreateEnum
CREATE TYPE "UserActorType" AS ENUM ('guest', 'registered');

-- CreateTable
CREATE TABLE "UserActor" (
    "id" TEXT NOT NULL,
    "type" "UserActorType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "authUserId" TEXT,
    "guestTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyUsageCounter" (
    "actorId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "maxCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyUsageCounter_pkey" PRIMARY KEY ("actorId","dateKey")
);

-- AlterTable
ALTER TABLE "ChatSessionRecord" ADD COLUMN "actorId" TEXT;
ALTER TABLE "ChatSessionRecord" ALTER COLUMN "userId" DROP NOT NULL;

-- Backfill registered actors for existing users.
INSERT INTO "UserActor" (
    "id",
    "type",
    "displayName",
    "authUserId",
    "createdAt",
    "updatedAt",
    "lastSeenAt"
)
SELECT
    "id",
    'registered'::"UserActorType",
    "email",
    "id",
    "createdAt",
    "updatedAt",
    "updatedAt"
FROM "AuthUser";

-- Backfill existing sessions to the new actor owner.
UPDATE "ChatSessionRecord"
SET "actorId" = "userId"
WHERE "actorId" IS NULL AND "userId" IS NOT NULL;

-- AlterTable
ALTER TABLE "ChatSessionRecord" ALTER COLUMN "actorId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserActor_authUserId_key" ON "UserActor"("authUserId");
CREATE UNIQUE INDEX "UserActor_guestTokenHash_key" ON "UserActor"("guestTokenHash");
CREATE INDEX "UserActor_type_lastSeenAt_idx" ON "UserActor"("type", "lastSeenAt" DESC);
CREATE INDEX "ChatSessionRecord_actorId_updatedAt_idx" ON "ChatSessionRecord"("actorId", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "UserActor" ADD CONSTRAINT "UserActor_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyUsageCounter" ADD CONSTRAINT "DailyUsageCounter_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatSessionRecord" ADD CONSTRAINT "ChatSessionRecord_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
