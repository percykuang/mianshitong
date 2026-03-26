import type { ChatMessageFeedback, ChatSession } from '@mianshitong/shared';
import { setSessionMessageFeedback } from '@/lib/chat-message-feedback';
import { getActorSession, saveActorSession } from './chat-session-repository';

export async function setActorMessageFeedback(
  actorId: string,
  sessionId: string,
  messageId: string,
  feedback: ChatMessageFeedback | null,
): Promise<ChatSession | null> {
  const session = await getActorSession(actorId, sessionId);
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

  return saveActorSession(actorId, nextSession);
}
