import type { ChatMessageFeedback, ChatSession } from '@mianshitong/shared';
import { setSessionMessageFeedback } from '@/lib/chat-message-feedback';
import { getUserSession, saveUserSession } from './chat-session-repository';

export async function setUserMessageFeedback(
  userId: string,
  sessionId: string,
  messageId: string,
  feedback: ChatMessageFeedback | null,
): Promise<ChatSession | null> {
  const session = await getUserSession(userId, sessionId);
  if (!session) {
    return null;
  }

  const nextSession = setSessionMessageFeedback({
    session,
    messageId,
    feedback,
  });
  if (!nextSession) {
    return null;
  }

  return saveUserSession(userId, nextSession);
}
