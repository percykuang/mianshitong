import {
  normalizeInterviewConfig,
  type ChatSession,
  type CreateSessionInput,
  type SessionSummary,
} from '@mianshitong/shared';
import { createMessage, createRuntimeState } from './session-core';

export function createInterviewSession(input?: CreateSessionInput & { now?: string }): ChatSession {
  const now = input?.now ?? new Date().toISOString();
  const config = normalizeInterviewConfig(input?.config);
  const runtime = createRuntimeState(config);

  return {
    id: `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
    title: input?.title?.trim() || '新的对话',
    modelId: input?.modelId ?? 'deepseek-chat',
    isPrivate: input?.isPrivate ?? true,
    status: 'idle',
    config,
    report: null,
    runtime,
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
