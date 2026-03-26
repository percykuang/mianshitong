import type { ChatSession } from '@mianshitong/shared';
import { getActorSession, saveActorSession } from './chat-session-repository';

export async function setActorSessionPinnedState(
  actorId: string,
  sessionId: string,
  pinned: boolean,
): Promise<ChatSession | null> {
  const session = await getActorSession(actorId, sessionId);
  if (!session) {
    return null;
  }

  return saveActorSession(actorId, {
    ...session,
    pinnedAt: pinned ? new Date().toISOString() : null,
  });
}
