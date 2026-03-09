import type { ChatMessageFeedback, ChatSession } from '@mianshitong/shared';

interface SetSessionMessageFeedbackInput {
  session: ChatSession;
  messageId: string;
  feedback: ChatMessageFeedback | null;
  now?: string;
}

export function setSessionMessageFeedback({
  session,
  messageId,
  feedback,
  now = new Date().toISOString(),
}: SetSessionMessageFeedbackInput): ChatSession | null {
  const targetIndex = session.messages.findIndex(
    (message) => message.id === messageId && message.role === 'assistant',
  );
  if (targetIndex < 0) {
    return null;
  }

  const target = session.messages[targetIndex];
  if ((target.feedback ?? null) === feedback) {
    return session;
  }

  const messages = session.messages.slice();
  messages[targetIndex] = {
    ...target,
    feedback,
  };

  return {
    ...session,
    messages,
    updatedAt: now,
  };
}
