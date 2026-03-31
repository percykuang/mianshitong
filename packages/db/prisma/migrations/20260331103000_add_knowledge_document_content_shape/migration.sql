CREATE TYPE "KnowledgeDocumentContentShape" AS ENUM ('reference', 'process', 'checklist', 'template');

ALTER TABLE "KnowledgeDocument"
ADD COLUMN "contentShape" "KnowledgeDocumentContentShape" NOT NULL DEFAULT 'reference';
