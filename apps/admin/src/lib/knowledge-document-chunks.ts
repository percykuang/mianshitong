import { Prisma, type KnowledgeDocument } from '@mianshitong/db';
import {
  buildKnowledgeDocumentChunks,
  type KnowledgeDocumentCategory,
  type KnowledgeDocumentContentShape,
} from '@mianshitong/retrieval';

type KnowledgeDocumentChunkSource = Pick<
  KnowledgeDocument,
  'id' | 'title' | 'category' | 'contentShape' | 'summary' | 'content' | 'tags'
>;

export async function replaceKnowledgeDocumentChunks(
  tx: Prisma.TransactionClient,
  document: KnowledgeDocumentChunkSource,
): Promise<void> {
  const chunks = buildKnowledgeDocumentChunks({
    documentId: document.id,
    title: document.title,
    category: document.category as KnowledgeDocumentCategory,
    contentShape: document.contentShape as KnowledgeDocumentContentShape,
    summary: document.summary,
    content: document.content,
    tags: [...document.tags],
  });

  await tx.knowledgeDocumentChunk.deleteMany({
    where: { documentId: document.id },
  });

  if (chunks.length === 0) {
    return;
  }

  await tx.knowledgeDocumentChunk.createMany({
    data: chunks.map((chunk) => ({
      documentId: chunk.documentId,
      chunkOrder: chunk.chunkOrder,
      headingPath: [...chunk.headingPath],
      headingText: chunk.headingText,
      content: chunk.content,
      searchText: chunk.searchText,
      tags: [...chunk.tags],
      normalizedTags: [...chunk.normalizedTags],
    })),
  });
}
