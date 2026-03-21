import {
  normalizeInterviewConfig,
  type ChatSession,
  type CreateSessionInput,
  type InterviewQuestion,
  type SessionSummary,
} from '@mianshitong/shared';
import { createRuntimeState } from './session-core';

function createSessionId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

export function createInterviewSession(
  input?: CreateSessionInput & { now?: string; questionBank?: InterviewQuestion[] },
): ChatSession {
  const now = input?.now ?? new Date().toISOString();
  const config = normalizeInterviewConfig(input?.config);
  const runtime = createRuntimeState(config, input?.questionBank);

  return {
    id: createSessionId(),
    title: input?.title?.trim() || '新的对话',
    modelId: input?.modelId ?? 'deepseek-chat',
    isPrivate: input?.isPrivate ?? true,
    status: 'idle',
    config,
    report: null,
    runtime,
    createdAt: now,
    updatedAt: now,
    pinnedAt: null,
    messages: [],
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
