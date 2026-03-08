import { prisma } from '@mianshitong/db';
import type { ChatSession } from '@mianshitong/shared';
import { toSession, type SessionRecord } from './chat-session-model';

export async function renameUserSession(
  userId: string,
  sessionId: string,
  title: string,
): Promise<ChatSession | null> {
  const result = await prisma.$executeRaw`
    UPDATE "ChatSessionRecord"
    SET "title" = ${title}
    WHERE "id" = ${sessionId} AND "userId" = ${userId}
  `;

  if (result === 0) {
    return null;
  }

  const record = await prisma.chatSessionRecord.findFirst({
    where: { id: sessionId, userId },
  });

  return record ? toSession(record as SessionRecord) : null;
}
