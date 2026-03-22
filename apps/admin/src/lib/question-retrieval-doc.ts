import { createHash } from 'node:crypto';
import { prisma, type QuestionBankItem } from '@mianshitong/db';
import {
  buildQuestionRetrievalSearchText,
  normalizeQuestionRetrievalTag,
} from '@mianshitong/retrieval';

type QuestionRetrievalSourceRecord = Pick<
  QuestionBankItem,
  'id' | 'title' | 'prompt' | 'answer' | 'keyPoints' | 'followUps' | 'tags'
>;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function buildRetrievalPayload(questionItem: QuestionRetrievalSourceRecord) {
  const tags = toStringArray(questionItem.tags);
  const searchText = buildQuestionRetrievalSearchText({
    title: questionItem.title,
    prompt: questionItem.prompt,
    answer: questionItem.answer,
    keyPoints: toStringArray(questionItem.keyPoints),
    followUps: toStringArray(questionItem.followUps),
    tags,
  });
  const normalizedTags: string[] = [
    ...new Set(tags.map(normalizeQuestionRetrievalTag).filter(Boolean)),
  ];
  const contentHash = createHash('sha256')
    .update(JSON.stringify({ searchText, normalizedTags }))
    .digest('hex');

  return {
    questionItemId: questionItem.id,
    searchText,
    normalizedTags,
    contentHash,
  };
}

export async function syncQuestionRetrievalDoc(
  questionItem: QuestionRetrievalSourceRecord,
): Promise<void> {
  const payload = buildRetrievalPayload(questionItem);
  const existing = await prisma.questionRetrievalDoc.findUnique({
    where: { questionItemId: questionItem.id },
  });

  if (!existing) {
    await prisma.questionRetrievalDoc.create({ data: payload });
    return;
  }

  if (existing.contentHash === payload.contentHash) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.questionRetrievalDoc.update({
      where: { questionItemId: questionItem.id },
      data: {
        searchText: payload.searchText,
        normalizedTags: payload.normalizedTags,
        contentHash: payload.contentHash,
        embeddingModel: null,
        embeddingVersion: null,
        embeddingDimensions: null,
      },
    });

    await tx.$executeRaw`
      UPDATE "QuestionRetrievalDoc"
      SET "embedding" = NULL
      WHERE "questionItemId" = ${questionItem.id}
    `;
  });
}
