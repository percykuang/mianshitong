import {
  createInterviewSession,
  processSessionMessage,
  toSessionSummary,
} from '@mianshitong/interview-engine';
import type {
  ChatMessage,
  ChatSession,
  CreateSessionInput,
  PostMessageResult,
  SessionSummary,
} from '@mianshitong/shared';

type SessionStore = Map<string, ChatSession>;

declare global {
  var __mianshitong_chat_store__: SessionStore | undefined;
}

const store: SessionStore = globalThis.__mianshitong_chat_store__ ?? new Map<string, ChatSession>();

if (!globalThis.__mianshitong_chat_store__) {
  globalThis.__mianshitong_chat_store__ = store;
}

export function listSessionSummaries(): SessionSummary[] {
  return [...store.values()]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((item) => toSessionSummary(item));
}

export function getSession(sessionId: string): ChatSession | undefined {
  return store.get(sessionId);
}

export function createSession(input?: CreateSessionInput): ChatSession {
  const session = createInterviewSession(input);
  store.set(session.id, session);
  return session;
}

export function sendMessage(sessionId: string, content: string): PostMessageResult | undefined {
  const session = store.get(sessionId);
  if (!session) {
    return undefined;
  }

  const result = processSessionMessage({
    session,
    content,
  });

  store.set(sessionId, result.session);
  return result;
}

function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
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

function toTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '新的对话';
  }

  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}

export function appendChatExchange(
  sessionId: string,
  input: { userContent: string; assistantContent: string; now?: string },
): ChatSession | undefined {
  const session = store.get(sessionId);
  if (!session) {
    return undefined;
  }

  const userContent = input.userContent.trim();
  const assistantContent = input.assistantContent.trim();
  if (!userContent || !assistantContent) {
    return session;
  }

  const now = input.now ?? new Date().toISOString();
  const nextUserMessage = createMessage({
    role: 'user',
    kind: 'text',
    content: userContent,
    createdAt: now,
  });
  const nextAssistantMessage = createMessage({
    role: 'assistant',
    kind: 'text',
    content: assistantContent,
    createdAt: now,
  });

  session.messages.push(nextUserMessage);
  session.messages.push(nextAssistantMessage);

  if (
    session.title === '新的对话' &&
    session.messages.filter((item) => item.role === 'user').length === 1
  ) {
    session.title = toTitle(userContent);
  }

  session.status = 'idle';
  session.updatedAt = now;
  store.set(sessionId, session);
  return session;
}
