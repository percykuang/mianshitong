import { prisma } from '@mianshitong/db';
import type { InterviewQuestion } from '@mianshitong/shared';

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

export async function listActiveQuestionBank(): Promise<InterviewQuestion[]> {
  const records = await prisma.questionBankItem.findMany({
    where: { isActive: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });

  return records.map((record) => ({
    id: record.questionId,
    level: record.level as InterviewQuestion['level'],
    title: record.title,
    prompt: record.prompt ?? record.title,
    answer: record.answer ?? undefined,
    keyPoints: toStringArray(record.keyPoints),
    followUps: toStringArray(record.followUps),
    tags: toStringArray(record.tags),
  }));
}
