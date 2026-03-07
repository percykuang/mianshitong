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

export type SessionRecord = {
  id: string;
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

function createMessage(input: {
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

export function createDraftSession(input?: CreateSessionInput): ChatSession {
  const now = new Date().toISOString();

  return {
    id: `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
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

  return {
    id: record.id,
    title: record.title,
    modelId: resolveModelId(record.modelId),
    isPrivate: record.isPrivate,
    status: parseSessionStatus(record.status),
    config,
    report: (record.report as unknown as ChatSession['report']) ?? null,
    runtime: record.runtime as unknown as ChatSession['runtime'],
    messages: record.messages as unknown as ChatMessage[],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
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
    updatedAt: session.updatedAt,
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
    runtime: session.runtime as unknown as Prisma.InputJsonValue,
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
    runtime: session.runtime as unknown as Prisma.InputJsonValue,
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

  if (
    next.title === '新的对话' &&
    next.messages.filter((item) => item.role === 'user').length === 1
  ) {
    next.title = toTitle(userContent);
  }

  next.status = 'idle';
  next.updatedAt = now;
  return next;
}

export function truncateSessionForEdit(
  session: ChatSession,
  messageId: string,
): ChatSession | null {
  const targetIndex = session.messages.findIndex(
    (item) => item.id === messageId && item.role === 'user',
  );
  if (targetIndex < 0) {
    return null;
  }

  const firstUserIndex = session.messages.findIndex((item) => item.role === 'user');
  const next = { ...session, messages: session.messages.slice(0, targetIndex) };
  if (targetIndex === firstUserIndex) {
    next.title = '新的对话';
  }
  next.status = 'idle';
  next.report = null;
  next.updatedAt = new Date().toISOString();
  return next;
}
