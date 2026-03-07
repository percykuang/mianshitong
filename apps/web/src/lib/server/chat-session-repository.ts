import { prisma } from '@mianshitong/db';
import type { ChatSession, CreateSessionInput, SessionSummary } from '@mianshitong/shared';
import {
  appendSessionMessages,
  createDraftSession,
  toSession,
  toSessionCreateData,
  toSessionSummary,
  toSessionUpdateData,
  truncateSessionForEdit,
  type SessionRecord,
} from './chat-session-model';

function toSessionOrNull(record: SessionRecord | null): ChatSession | null {
  return record ? toSession(record) : null;
}

export async function listUserSessionSummaries(userId: string): Promise<SessionSummary[]> {
  const records = await prisma.chatSessionRecord.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });

  return records.map((record) => toSessionSummary(toSession(record)));
}

export async function getUserSession(
  userId: string,
  sessionId: string,
): Promise<ChatSession | null> {
  const record = await prisma.chatSessionRecord.findFirst({
    where: { id: sessionId, userId },
  });

  return toSessionOrNull(record);
}

export async function createUserSession(
  userId: string,
  input?: CreateSessionInput,
): Promise<ChatSession> {
  const session = createDraftSession(input);
  await prisma.chatSessionRecord.create({
    data: toSessionCreateData(userId, session),
  });
  return session;
}

export async function saveUserSession(
  userId: string,
  session: ChatSession,
): Promise<ChatSession | null> {
  const result = await prisma.chatSessionRecord.updateMany({
    where: { id: session.id, userId },
    data: toSessionUpdateData(session),
  });

  if (result.count === 0) {
    return null;
  }

  return getUserSession(userId, session.id);
}

export async function appendUserSessionExchange(
  userId: string,
  sessionId: string,
  input: { userContent: string; assistantContent: string; now?: string },
): Promise<ChatSession | null> {
  const current = await getUserSession(userId, sessionId);
  if (!current) {
    return null;
  }

  return saveUserSession(userId, appendSessionMessages(current, input));
}

export async function truncateUserSessionForEdit(
  userId: string,
  sessionId: string,
  messageId: string,
): Promise<ChatSession | null> {
  const current = await getUserSession(userId, sessionId);
  if (!current) {
    return null;
  }

  const truncated = truncateSessionForEdit(current, messageId);
  if (!truncated) {
    return null;
  }

  return saveUserSession(userId, truncated);
}

export async function deleteUserSession(userId: string, sessionId: string): Promise<boolean> {
  const result = await prisma.chatSessionRecord.deleteMany({
    where: { id: sessionId, userId },
  });

  return result.count > 0;
}

export async function deleteAllUserSessions(userId: string): Promise<number> {
  const result = await prisma.chatSessionRecord.deleteMany({
    where: { userId },
  });

  return result.count;
}
