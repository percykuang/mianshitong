import type { ChatTurn } from '@mianshitong/llm';
import {
  type ChatMessage,
  type ChatSession,
  type ModelId,
  type SessionSummary,
  normalizeInterviewConfig,
} from '@mianshitong/shared';
import { createChatSessionId, normalizeChatSessionId } from '@/lib/chat-session-id';

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

  return normalized;
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

export function createDraftChatSession(modelId: ModelId, sessionId?: string | null): ChatSession {
  const now = new Date().toISOString();

  return {
    id: resolveSessionId(sessionId),
    title: '新的对话',
    modelId,
    isPrivate: true,
    status: 'idle',
    config: normalizeInterviewConfig(undefined),
    report: null,
    runtime: {
      questionPlan: [],
      currentQuestionIndex: 0,
      followUpRound: 0,
      activeQuestionAnswers: [],
      assessments: [],
      followUpTrace: [],
      assessmentTrace: [],
      resumeProfile: null,
      interviewBlueprint: null,
      planningSummary: null,
      planGeneratedAt: null,
      planningTrace: null,
      reportTrace: null,
    },
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

export function toStreamTurns(messages: ChatMessage[]): ChatTurn[] {
  return messages
    .filter((message) => message.kind !== 'report')
    .map((message) => ({
      role: message.role === 'system' ? 'system' : message.role,
      content: message.content,
    }));
}

export function appendUserAssistantMessages(
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
  next.updatedAt = now;
  next.status = 'idle';
  return next;
}

export function rebuildSessionAfterEdit(
  session: ChatSession,
  input: { messageId: string; userContent: string; assistantContent: string; now?: string },
): ChatSession | null {
  const targetIndex = session.messages.findIndex(
    (item) => item.id === input.messageId && item.role === 'user',
  );
  if (targetIndex < 0) {
    return null;
  }

  const now = input.now ?? new Date().toISOString();
  const editedUserContent = input.userContent.trim();
  const assistantContent = input.assistantContent.trim();
  if (!editedUserContent || !assistantContent) {
    return null;
  }

  const firstUserIndex = session.messages.findIndex((item) => item.role === 'user');
  const history = session.messages
    .slice(0, targetIndex + 1)
    .map((item) => (item.id === input.messageId ? { ...item, content: editedUserContent } : item));

  const next: ChatSession = {
    ...session,
    messages: [
      ...history,
      createMessage({
        role: 'assistant',
        kind: 'text',
        content: assistantContent,
        createdAt: now,
      }),
    ],
    updatedAt: now,
    status: 'idle',
    report: null,
  };

  if (targetIndex === firstUserIndex) {
    next.title = toTitle(editedUserContent);
  }

  return next;
}
