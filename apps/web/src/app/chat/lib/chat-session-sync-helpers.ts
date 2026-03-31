import type { ChatSession, SessionSummary } from '@mianshitong/shared';
import { cacheSession } from '../stores/chat-session-cache-store';

type SetActiveSession = (
  value: ChatSession | null | ((current: ChatSession | null) => ChatSession | null),
) => void;

interface SyncChatSessionUpdateInput {
  session: ChatSession;
  setActiveSession: SetActiveSession;
  fetchSessionList?: () => Promise<SessionSummary[]>;
  setSessions?: (value: SessionSummary[]) => void;
}

export async function syncChatSessionUpdate(input: SyncChatSessionUpdateInput): Promise<void> {
  const { session, setActiveSession, fetchSessionList, setSessions } = input;

  cacheSession(session);

  if (fetchSessionList && setSessions) {
    setSessions(await fetchSessionList());
  }

  setActiveSession((current) => (current?.id === session.id ? session : current));
}
