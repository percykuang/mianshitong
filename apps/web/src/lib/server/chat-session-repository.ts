import { Prisma, prisma } from '@mianshitong/db';
import type { ChatSession, CreateSessionInput, ModelId, SessionSummary } from '@mianshitong/shared';
import { compareSessionsByPinnedAndCreated } from '@/lib/chat-session-order';
import {
  createChatSessionId,
  isLegacyChatSessionId,
  normalizeChatSessionId,
} from '@/lib/chat-session-id';
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

function toMigratedSessionCreateData(
  record: SessionRecord,
  nextId: string,
): Prisma.ChatSessionRecordUncheckedCreateInput {
  return {
    id: nextId,
    userId: record.userId,
    title: record.title,
    modelId: record.modelId,
    isPrivate: record.isPrivate,
    status: record.status,
    config: record.config as Prisma.InputJsonValue,
    report: record.report === null ? Prisma.JsonNull : (record.report as Prisma.InputJsonValue),
    runtime: record.runtime as Prisma.InputJsonValue,
    messages: record.messages as Prisma.InputJsonValue,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function migrateLegacySessionRecord(record: SessionRecord): Promise<SessionRecord> {
  if (!isLegacyChatSessionId(record.id)) {
    return record;
  }

  return prisma.$transaction(async (tx) => {
    let nextId = normalizeChatSessionId(record.id) ?? createChatSessionId();

    while (await tx.chatSessionRecord.findUnique({ where: { id: nextId } })) {
      nextId = createChatSessionId();
    }

    await tx.chatSessionRecord.create({
      data: toMigratedSessionCreateData(record, nextId),
    });
    await tx.chatSessionRecord.delete({ where: { id: record.id } });

    const migrated = await tx.chatSessionRecord.findUnique({ where: { id: nextId } });
    if (!migrated) {
      throw new Error('会话迁移失败');
    }

    return migrated;
  });
}

async function getSessionRecordById(sessionId: string): Promise<SessionRecord | null> {
  const record = await prisma.chatSessionRecord.findUnique({
    where: { id: sessionId },
  });

  return record as SessionRecord | null;
}

async function createUserSessionRecord(
  userId: string,
  session: ChatSession,
): Promise<ChatSession | null> {
  const existing = await getSessionRecordById(session.id);
  if (existing) {
    return existing.userId === userId ? toSession(existing) : null;
  }

  await prisma.chatSessionRecord.create({
    data: toSessionCreateData(userId, session),
  });

  return session;
}

export async function listUserSessionSummaries(userId: string): Promise<SessionSummary[]> {
  const records = await prisma.chatSessionRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  const migratedRecords = await Promise.all(
    records.map((record) => migrateLegacySessionRecord(record as SessionRecord)),
  );

  return migratedRecords
    .map((record) => toSessionSummary(toSession(record)))
    .sort(compareSessionsByPinnedAndCreated);
}

export async function getUserSession(
  userId: string,
  sessionId: string,
): Promise<ChatSession | null> {
  const record = await prisma.chatSessionRecord.findFirst({
    where: { id: sessionId, userId },
  });

  return toSessionOrNull(record as SessionRecord | null);
}

export async function createUserSession(
  userId: string,
  input?: CreateSessionInput,
  sessionId?: string | null,
): Promise<ChatSession> {
  const session = createDraftSession(input, sessionId);
  const created = await createUserSessionRecord(userId, session);
  if (!created) {
    throw new Error('会话创建失败');
  }

  return created;
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
  input: { userContent: string; assistantContent: string; now?: string; modelId?: ModelId },
): Promise<ChatSession | null> {
  const current = await getUserSession(userId, sessionId);
  const nextSession = appendSessionMessages(
    current ?? createDraftSession({ modelId: input.modelId }, sessionId),
    input,
  );

  if (current) {
    return saveUserSession(userId, nextSession);
  }

  return createUserSessionRecord(userId, nextSession);
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
