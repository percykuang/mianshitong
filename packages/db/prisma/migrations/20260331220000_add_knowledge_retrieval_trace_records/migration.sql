CREATE TYPE "KnowledgeRetrievalIntentKind" AS ENUM (
  'technical_question',
  'interview_playbook',
  'project_highlight',
  'resume_optimize',
  'self_intro'
);

CREATE TYPE "KnowledgeRetrievalMode" AS ENUM ('strong', 'weak', 'none');

CREATE TYPE "KnowledgeRetrievalTriggerKind" AS ENUM ('new_message', 'edit_regenerate');

CREATE TABLE "KnowledgeRetrievalTraceRecord" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "userId" TEXT,
  "triggerKind" "KnowledgeRetrievalTriggerKind" NOT NULL,
  "queryHash" TEXT NOT NULL,
  "queryPreview" TEXT NOT NULL,
  "intentKind" "KnowledgeRetrievalIntentKind" NOT NULL,
  "mode" "KnowledgeRetrievalMode" NOT NULL,
  "categories" "KnowledgeDocumentCategory"[] DEFAULT ARRAY[]::"KnowledgeDocumentCategory"[],
  "preferredTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KnowledgeRetrievalTraceRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeRetrievalTraceResultRecord" (
  "id" TEXT NOT NULL,
  "traceId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "documentId" TEXT NOT NULL,
  "documentTitle" TEXT NOT NULL,
  "category" "KnowledgeDocumentCategory" NOT NULL,
  "headingPath" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "score" DOUBLE PRECISION NOT NULL,

  CONSTRAINT "KnowledgeRetrievalTraceResultRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeRetrievalTraceRecord_createdAt_idx"
ON "KnowledgeRetrievalTraceRecord"("createdAt" DESC);

CREATE INDEX "KnowledgeRetrievalTraceRecord_sessionId_createdAt_idx"
ON "KnowledgeRetrievalTraceRecord"("sessionId", "createdAt" DESC);

CREATE INDEX "KnowledgeRetrievalTraceRecord_actorId_createdAt_idx"
ON "KnowledgeRetrievalTraceRecord"("actorId", "createdAt" DESC);

CREATE INDEX "KnowledgeRetrievalTraceRecord_intentKind_mode_createdAt_idx"
ON "KnowledgeRetrievalTraceRecord"("intentKind", "mode", "createdAt" DESC);

CREATE INDEX "KnowledgeRetrievalTraceRecord_queryHash_createdAt_idx"
ON "KnowledgeRetrievalTraceRecord"("queryHash", "createdAt" DESC);

CREATE INDEX "KnowledgeRetrievalTraceResultRecord_traceId_rank_idx"
ON "KnowledgeRetrievalTraceResultRecord"("traceId", "rank");

CREATE INDEX "KnowledgeRetrievalTraceResultRecord_documentId_idx"
ON "KnowledgeRetrievalTraceResultRecord"("documentId");

ALTER TABLE "KnowledgeRetrievalTraceRecord"
ADD CONSTRAINT "KnowledgeRetrievalTraceRecord_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "ChatSessionRecord"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeRetrievalTraceRecord"
ADD CONSTRAINT "KnowledgeRetrievalTraceRecord_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "UserActor"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeRetrievalTraceRecord"
ADD CONSTRAINT "KnowledgeRetrievalTraceRecord_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "AuthUser"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KnowledgeRetrievalTraceResultRecord"
ADD CONSTRAINT "KnowledgeRetrievalTraceResultRecord_traceId_fkey"
FOREIGN KEY ("traceId") REFERENCES "KnowledgeRetrievalTraceRecord"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
