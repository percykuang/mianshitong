CREATE TYPE "KnowledgeDocumentCategory" AS ENUM ('tech_knowledge', 'interview_playbook', 'project_resume');

CREATE TABLE "KnowledgeDocument" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" "KnowledgeDocumentCategory" NOT NULL,
  "summary" TEXT,
  "content" TEXT NOT NULL,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeDocumentChunk" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "chunkOrder" INTEGER NOT NULL,
  "headingPath" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "headingText" TEXT,
  "content" TEXT NOT NULL,
  "searchText" TEXT NOT NULL,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "normalizedTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "embedding" vector,
  "embeddingModel" TEXT,
  "embeddingVersion" TEXT,
  "embeddingDimensions" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KnowledgeDocumentChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeDocument_category_isPublished_updatedAt_idx"
ON "KnowledgeDocument"("category", "isPublished", "updatedAt" DESC);

CREATE INDEX "KnowledgeDocument_isPublished_updatedAt_idx"
ON "KnowledgeDocument"("isPublished", "updatedAt" DESC);

CREATE INDEX "KnowledgeDocumentChunk_documentId_chunkOrder_idx"
ON "KnowledgeDocumentChunk"("documentId", "chunkOrder");

CREATE INDEX "KnowledgeDocumentChunk_embeddingModel_embeddingVersion_embeddingDimensions_idx"
ON "KnowledgeDocumentChunk"("embeddingModel", "embeddingVersion", "embeddingDimensions");

ALTER TABLE "KnowledgeDocumentChunk"
ADD CONSTRAINT "KnowledgeDocumentChunk_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
