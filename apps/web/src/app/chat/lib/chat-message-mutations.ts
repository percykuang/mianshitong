import type { ChatMessage, ChatSession } from '@mianshitong/shared';

export function toSessionTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '新的对话';
  }

  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}

export function appendOptimisticMessages(
  session: ChatSession,
  optimisticMessages: ChatMessage[],
  updatedAt: string,
): ChatSession {
  return {
    ...session,
    messages: [...session.messages, ...optimisticMessages],
    updatedAt,
  };
}

export function appendAssistantDelta(
  session: ChatSession | null,
  optimisticAssistantId: string,
  delta: string,
): ChatSession | null {
  if (!session || !delta) {
    return session;
  }

  return {
    ...session,
    messages: session.messages.map((message) =>
      message.id === optimisticAssistantId
        ? { ...message, content: message.content + delta }
        : message,
    ),
  };
}

export function removeOptimisticMessages(
  session: ChatSession | null,
  messageIds: Array<string | null | undefined>,
): ChatSession | null {
  if (!session) {
    return session;
  }

  const removableIds = new Set(messageIds.filter((id): id is string => Boolean(id)));
  if (removableIds.size === 0) {
    return session;
  }

  return {
    ...session,
    status: 'idle',
    messages: session.messages.filter((message) => !removableIds.has(message.id)),
  };
}

export function buildStoredLocalSession(input: {
  session: ChatSession | null;
  optimisticUser: ChatMessage | null;
  optimisticAssistant: ChatMessage | null;
  assistantContent: string;
  now: string;
  submittedContent: string;
}): ChatSession | null {
  const { session, optimisticUser, optimisticAssistant, assistantContent, now, submittedContent } =
    input;
  if (!session || !optimisticUser) {
    return null;
  }

  const normalizedAssistantContent = assistantContent.trim();
  const next: ChatSession = {
    ...session,
    messages: [
      ...session.messages,
      optimisticUser,
      ...(normalizedAssistantContent && optimisticAssistant
        ? [{ ...optimisticAssistant, content: normalizedAssistantContent }]
        : []),
    ],
    updatedAt: now,
    status: 'idle',
  };

  const userCount = session.messages.filter((item) => item.role === 'user').length;
  if (next.title === '新的对话' && userCount === 0) {
    next.title = toSessionTitle(submittedContent);
  }

  return next;
}

export function getEditableUserMessageIndex(messages: ChatMessage[], messageId: string): number {
  return messages.findIndex((item) => item.id === messageId && item.role === 'user');
}
