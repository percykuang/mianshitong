import { prisma } from '@mianshitong/db';
import type { KnowledgeRetrievalTraceEntry } from '@mianshitong/shared';

export type KnowledgeRetrievalTriggerKind = 'new_message' | 'edit_regenerate';

export async function recordKnowledgeRetrievalTraceRecord(input: {
  sessionId: string;
  actorId: string;
  userId?: string | null;
  triggerKind: KnowledgeRetrievalTriggerKind;
  trace: KnowledgeRetrievalTraceEntry | null;
}): Promise<void> {
  const trace = input.trace;

  if (!trace) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const created = await tx.knowledgeRetrievalTraceRecord.create({
      data: {
        sessionId: input.sessionId,
        actorId: input.actorId,
        userId: input.userId ?? null,
        triggerKind: input.triggerKind,
        queryHash: trace.queryHash ?? '',
        queryPreview: trace.queryPreview,
        intentKind: trace.intentKind,
        mode: trace.mode,
        categories: [...trace.categories],
        preferredTags: [...trace.preferredTags],
        createdAt: new Date(trace.createdAt),
      },
    });

    if (trace.results.length === 0) {
      return;
    }

    await tx.knowledgeRetrievalTraceResultRecord.createMany({
      data: trace.results.map((result, index) => ({
        traceId: created.id,
        rank: index,
        documentId: result.documentId,
        documentTitle: result.documentTitle,
        category: result.category,
        headingPath: [...result.headingPath],
        score: result.score,
      })),
    });
  });
}

export async function recordKnowledgeRetrievalTraceRecordSafely(input: {
  sessionId: string;
  actorId: string;
  userId?: string | null;
  triggerKind: KnowledgeRetrievalTriggerKind;
  trace: KnowledgeRetrievalTraceEntry | null;
}): Promise<void> {
  try {
    await recordKnowledgeRetrievalTraceRecord(input);
  } catch (error) {
    console.error('Failed to persist knowledge retrieval trace record', error);
  }
}
