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
    actorId: record.actorId,
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

    return migrated as SessionRecord;
  });
}

async function getSessionRecordById(sessionId: string): Promise<SessionRecord | null> {
  const record = await prisma.chatSessionRecord.findUnique({
    where: { id: sessionId },
  });

  return (record as SessionRecord | null) ?? null;
}

async function createActorSessionRecord(
  actorId: string,
  session: ChatSession,
  userId?: string | null,
): Promise<ChatSession | null> {
  const existing = await getSessionRecordById(session.id);
  if (existing) {
    return existing.actorId === actorId ? toSession(existing) : null;
  }

  await prisma.chatSessionRecord.create({
    data: toSessionCreateData(actorId, session, userId),
  });

  return session;
}

export async function listActorSessionSummaries(actorId: string): Promise<SessionSummary[]> {
  const records = await prisma.chatSessionRecord.findMany({
    where: { actorId },
    orderBy: { createdAt: 'desc' },
  });
  const migratedRecords = await Promise.all(
    records.map((record) => migrateLegacySessionRecord(record as SessionRecord)),
  );

  return migratedRecords
    .map((record) => toSessionSummary(toSession(record)))
    .sort(compareSessionsByPinnedAndCreated);
}

export async function getActorSession(
  actorId: string,
  sessionId: string,
): Promise<ChatSession | null> {
  const record = await prisma.chatSessionRecord.findFirst({
    where: { id: sessionId, actorId },
  });

  return toSessionOrNull(record as SessionRecord | null);
}

export async function createActorSession(
  actorId: string,
  input?: CreateSessionInput,
  sessionId?: string | null,
  userId?: string | null,
): Promise<ChatSession> {
  const session = createDraftSession(input, sessionId);
  const created = await createActorSessionRecord(actorId, session, userId);
  if (!created) {
    throw new Error('会话创建失败');
  }

  return created;
}

export async function saveActorSession(
  actorId: string,
  session: ChatSession,
): Promise<ChatSession | null> {
  const result = await prisma.chatSessionRecord.updateMany({
    where: { id: session.id, actorId },
    data: toSessionUpdateData(session),
  });

  if (result.count === 0) {
    return null;
  }

  return getActorSession(actorId, session.id);
}

export async function saveOrCreateActorSession(
  actorId: string,
  session: ChatSession,
  userId?: string | null,
): Promise<ChatSession | null> {
  const existing = await getActorSession(actorId, session.id);

  if (existing) {
    return saveActorSession(actorId, session);
  }

  return createActorSessionRecord(actorId, session, userId);
}

export async function appendActorSessionExchange(
  actorId: string,
  sessionId: string,
  input: { userContent: string; assistantContent: string; now?: string; modelId?: ModelId },
  userId?: string | null,
): Promise<ChatSession | null> {
  const current = await getActorSession(actorId, sessionId);
  const nextSession = appendSessionMessages(
    current ?? createDraftSession({ modelId: input.modelId }, sessionId),
    input,
  );

  if (current) {
    return saveActorSession(actorId, nextSession);
  }

  return createActorSessionRecord(actorId, nextSession, userId);
}

export async function truncateActorSessionForEdit(
  actorId: string,
  sessionId: string,
  messageId: string,
): Promise<ChatSession | null> {
  const current = await getActorSession(actorId, sessionId);
  if (!current) {
    return null;
  }

  const truncated = truncateSessionForEdit(current, messageId);
  if (!truncated) {
    return null;
  }

  return saveActorSession(actorId, truncated);
}

export async function deleteActorSession(actorId: string, sessionId: string): Promise<boolean> {
  const result = await prisma.chatSessionRecord.deleteMany({
    where: { id: sessionId, actorId },
  });

  return result.count > 0;
}

export async function deleteAllActorSessions(actorId: string): Promise<number> {
  const result = await prisma.chatSessionRecord.deleteMany({
    where: { actorId },
  });

  return result.count;
}
