import type { ChatMessageFeedback, ChatSession } from '@mianshitong/shared';
import { setSessionMessageFeedback } from '@/lib/chat-message-feedback';
import { getLocalSessionById, saveLocalSession } from './chat-local-storage';

export async function setLocalMessageFeedback(
  sessionId: string,
  messageId: string,
  feedback: ChatMessageFeedback | null,
): Promise<ChatSession> {
  const session = await getLocalSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const nextSession = setSessionMessageFeedback({
    session,
    messageId,
    feedback,
  });
  if (!nextSession) {
    throw new Error('Message not found');
  }

  await saveLocalSession(nextSession);
  return nextSession;
}
