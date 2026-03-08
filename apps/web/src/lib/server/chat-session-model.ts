import { Prisma } from '@mianshitong/db';
import {
  MODEL_OPTIONS,
  normalizeInterviewConfig,
  type ChatMessage,
  type ChatSession,
  type CreateSessionInput,
  type ModelId,
  type SessionStatus,
  type SessionSummary,
} from '@mianshitong/shared';
import { createChatSessionId, normalizeChatSessionId } from '@/lib/chat-session-id';
import { decodeSessionRuntime, encodeSessionRuntime } from './chat-session-ui-state';

export type SessionRecord = {
  id: string;
  userId: string;
  title: string;
  modelId: string;
  isPrivate: boolean;
  status: string;
  config: Prisma.JsonValue;
  report: Prisma.JsonValue | null;
  runtime: Prisma.JsonValue;
  messages: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function resolveSessionId(sessionId?: string | null): string {
  return normalizeChatSessionId(sessionId) ?? createChatSessionId();
}

function toTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '新的对话';
  }

  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}

function resolveModelId(modelId: string): ModelId {
  return MODEL_OPTIONS.some((item) => item.id === modelId) ? (modelId as ModelId) : 'deepseek-chat';
}

export function createMessage(input: {
  role: ChatMessage['role'];
  kind: ChatMessage['kind'];
  content: string;
  createdAt: string;
}): ChatMessage {
  return {
    id: createId('msg'),
    role: input.role,
    kind: input.kind,
    content: input.content,
    createdAt: input.createdAt,
  };
}

function parseSessionStatus(value: string): SessionStatus {
  return value === 'interviewing' || value === 'completed' ? value : 'idle';
}

export function createDraftSession(
  input?: CreateSessionInput,
  sessionId?: string | null,
): ChatSession {
  const now = new Date().toISOString();

  return {
    id: resolveSessionId(sessionId),
    title: input?.title?.trim() || '新的对话',
    modelId: input?.modelId ?? 'deepseek-chat',
    isPrivate: input?.isPrivate ?? true,
    status: 'idle',
    config: normalizeInterviewConfig(input?.config),
    report: null,
    runtime: {
      questionPlan: [],
      currentQuestionIndex: 0,
      followUpRound: 0,
      activeQuestionAnswers: [],
      assessments: [],
    },
    createdAt: now,
    updatedAt: now,
    pinnedAt: null,
    messages: [
      createMessage({
        role: 'assistant',
        kind: 'system',
        content:
          '你好，我是面试通 AI 面试官。你可以直接说“开始模拟面试”，或先让我帮你优化简历/拆解面试题。',
        createdAt: now,
      }),
    ],
  };
}

export function toSession(record: SessionRecord): ChatSession {
  const config = normalizeInterviewConfig(record.config as Partial<ChatSession['config']>);
  const { runtime, pinnedAt } = decodeSessionRuntime(record.runtime);

  return {
    id: record.id,
    title: record.title,
    modelId: resolveModelId(record.modelId),
    isPrivate: record.isPrivate,
    status: parseSessionStatus(record.status),
    config,
    report: (record.report as unknown as ChatSession['report']) ?? null,
    runtime,
    messages: record.messages as unknown as ChatMessage[],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    pinnedAt,
  };
}

export function toSessionSummary(session: ChatSession): SessionSummary {
  const lastMessage = session.messages.at(-1);

  return {
    id: session.id,
    title: session.title,
    modelId: session.modelId,
    isPrivate: session.isPrivate,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    pinnedAt: session.pinnedAt,
    messageCount: session.messages.length,
    lastMessagePreview: lastMessage?.content.slice(0, 60) ?? '',
  };
}

export function toSessionCreateData(
  userId: string,
  session: ChatSession,
): Prisma.ChatSessionRecordCreateInput {
  return {
    id: session.id,
    title: session.title,
    modelId: session.modelId,
    isPrivate: session.isPrivate,
    status: session.status,
    config: session.config as unknown as Prisma.InputJsonValue,
    runtime: encodeSessionRuntime(session),
    messages: session.messages as unknown as Prisma.InputJsonValue,
    user: { connect: { id: userId } },
  };
}

export function toSessionUpdateData(
  session: ChatSession,
): Prisma.ChatSessionRecordUpdateManyMutationInput {
  const report =
    session.report === null
      ? Prisma.JsonNull
      : (session.report as unknown as Prisma.InputJsonValue);

  return {
    title: session.title,
    modelId: session.modelId,
    isPrivate: session.isPrivate,
    status: session.status,
    config: session.config as unknown as Prisma.InputJsonValue,
    report,
    runtime: encodeSessionRuntime(session),
    messages: session.messages as unknown as Prisma.InputJsonValue,
  };
}

export function appendSessionMessages(
  session: ChatSession,
  input: { userContent: string; assistantContent: string; now?: string },
): ChatSession {
  const now = input.now ?? new Date().toISOString();
  const userContent = input.userContent.trim();
  const assistantContent = input.assistantContent.trim();
  if (!userContent || !assistantContent) {
    return session;
  }

  const next = { ...session, messages: [...session.messages] };
  next.messages.push(
    createMessage({ role: 'user', kind: 'text', content: userContent, createdAt: now }),
  );
  next.messages.push(
    createMessage({ role: 'assistant', kind: 'text', content: assistantContent, createdAt: now }),
  );

  if (next.messages.filter((item) => item.role === 'user').length === 1) {
    next.title = toTitle(userContent);
  }

  next.updatedAt = now;
  next.status = 'idle';
  return next;
}

export function truncateSessionForEdit(
  session: ChatSession,
  messageId: string,
  now: string = new Date().toISOString(),
): ChatSession | null {
  const targetIndex = session.messages.findIndex(
    (item) => item.id === messageId && item.role === 'user',
  );
  if (targetIndex < 0) {
    return null;
  }

  const nextMessages = session.messages.slice(0, targetIndex);
  const firstUserIndex = session.messages.findIndex((item) => item.role === 'user');

  return {
    ...session,
    title: targetIndex === firstUserIndex ? '新的对话' : session.title,
    messages: nextMessages,
    report: null,
    runtime: {
      ...session.runtime,
      activeQuestionAnswers: [],
    },
    updatedAt: now,
    status: 'idle',
  };
}
