import type { ChatMessage, ChatSession } from '@mianshitong/shared';
import { CHAT_ERROR_COPY } from './chat-copy';

export function toSessionTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '新的对话';
  }

  return normalized;
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

export function buildOptimisticEditSession(input: {
  session: ChatSession;
  messageId: string;
  userContent: string;
  optimisticAssistant: ChatMessage;
  updatedAt: string;
}): ChatSession | null {
  const { session, messageId, userContent, optimisticAssistant, updatedAt } = input;
  if (!isEditableUserMessage(session.messages, messageId)) {
    return null;
  }

  const targetIndex = getEditableUserMessageIndex(session.messages, messageId);
  const targetMessage = session.messages[targetIndex];
  if (!targetMessage) {
    return null;
  }

  const firstUserIndex = session.messages.findIndex((item) => item.role === 'user');

  return {
    ...session,
    title: targetIndex === firstUserIndex ? toSessionTitle(userContent) : session.title,
    messages: [
      ...session.messages.slice(0, targetIndex),
      { ...targetMessage, content: userContent },
      optimisticAssistant,
    ],
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

export function finalizeInterruptedAssistantMessage(input: {
  session: ChatSession | null;
  optimisticAssistantId: string | null;
  submittedContent: string;
}): ChatSession | null {
  const { session, optimisticAssistantId, submittedContent } = input;
  if (!session) {
    return session;
  }

  const nextMessages = session.messages
    .filter((message) => {
      if (message.id !== optimisticAssistantId) {
        return true;
      }

      return message.content.trim().length > 0;
    })
    .map((message) =>
      message.id === optimisticAssistantId
        ? { ...message, completionStatus: 'interrupted' as const }
        : message,
    );

  const next: ChatSession = {
    ...session,
    status: 'idle',
    messages: nextMessages,
  };

  if (
    next.title === '新的对话' &&
    next.messages.filter((item) => item.role === 'user').length === 1
  ) {
    next.title = toSessionTitle(submittedContent);
  }

  return next;
}

export function buildStoredChatSession(input: {
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
        ? [
            {
              ...optimisticAssistant,
              content: normalizedAssistantContent,
              completionStatus: 'completed' as const,
            },
          ]
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

export function getEditableUserMessage(
  messages: ChatMessage[],
  messageId: string,
): { index: number; message: ChatMessage } | null {
  const index = getEditableUserMessageIndex(messages, messageId);
  const message = messages[index];
  if (!message || !isEditableUserMessage(messages, messageId)) {
    return null;
  }

  return { index, message };
}

export function getEditableUserMessageError(
  messages: ChatMessage[],
  messageId: string,
): string | null {
  const targetIndex = getEditableUserMessageIndex(messages, messageId);
  if (targetIndex < 0) {
    return CHAT_ERROR_COPY.invalidEditableMessage;
  }

  if (!isEditableUserMessage(messages, messageId)) {
    return CHAT_ERROR_COPY.editOnlyLastUserMessage;
  }

  return null;
}

export function getLastEditableUserMessageId(messages: ChatMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user') {
      return message.id;
    }
  }

  return null;
}

export function isEditableUserMessage(messages: ChatMessage[], messageId: string): boolean {
  return getLastEditableUserMessageId(messages) === messageId;
}
