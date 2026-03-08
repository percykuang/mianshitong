import type { ChatSession } from '@mianshitong/shared';
import { getUserSession, saveUserSession } from './chat-session-repository';

export async function setUserSessionPinnedState(
  userId: string,
  sessionId: string,
  pinned: boolean,
): Promise<ChatSession | null> {
  const session = await getUserSession(userId, sessionId);
  if (!session) {
    return null;
  }

  return saveUserSession(userId, {
    ...session,
    pinnedAt: pinned ? new Date().toISOString() : null,
  });
}
