CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "QuestionRetrievalDoc" (
    "id" TEXT NOT NULL,
    "questionItemId" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "normalizedTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "embedding" vector,
    "embeddingModel" TEXT,
    "embeddingVersion" TEXT,
    "embeddingDimensions" INTEGER,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionRetrievalDoc_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuestionRetrievalDoc_questionItemId_key" ON "QuestionRetrievalDoc"("questionItemId");
CREATE INDEX "QuestionRetrievalDoc_embeddingModel_embeddingVersion_embeddingDimensions_idx"
ON "QuestionRetrievalDoc"("embeddingModel", "embeddingVersion", "embeddingDimensions");

ALTER TABLE "QuestionRetrievalDoc"
ADD CONSTRAINT "QuestionRetrievalDoc_questionItemId_fkey"
FOREIGN KEY ("questionItemId") REFERENCES "QuestionBankItem"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
