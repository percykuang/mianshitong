-- CreateTable
CREATE TABLE "ChatSessionRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "config" JSONB NOT NULL,
    "report" JSONB,
    "runtime" JSONB NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSessionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatSessionRecord_userId_updatedAt_idx" ON "ChatSessionRecord"("userId", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "ChatSessionRecord" ADD CONSTRAINT "ChatSessionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
