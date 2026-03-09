import type { ChatSession } from '@mianshitong/shared';

interface RemoteSessionSyncDeps {
  refreshSessions: () => Promise<unknown>;
  setActiveSession: (
    value: ChatSession | null | ((previous: ChatSession | null) => ChatSession | null),
  ) => void;
  setActiveSessionId: (value: string | null) => void;
  replaceSession?: (sessionId: string) => void;
}

interface SyncResolvedRemoteSessionInput extends RemoteSessionSyncDeps {
  session: ChatSession;
}

interface SyncFetchedRemoteSessionInput extends RemoteSessionSyncDeps {
  sessionId: string;
  fetchSessionById: (sessionId: string) => Promise<ChatSession>;
}

export async function syncResolvedRemoteSession(
  input: SyncResolvedRemoteSessionInput,
): Promise<ChatSession> {
  input.setActiveSession(input.session);
  input.setActiveSessionId(input.session.id);
  input.replaceSession?.(input.session.id);
  await input.refreshSessions();
  return input.session;
}

export async function syncFetchedRemoteSession(
  input: SyncFetchedRemoteSessionInput,
): Promise<ChatSession> {
  const session = await input.fetchSessionById(input.sessionId);
  return syncResolvedRemoteSession({ ...input, session });
}

export async function trySyncFetchedRemoteSession(
  input: SyncFetchedRemoteSessionInput,
): Promise<boolean> {
  try {
    await syncFetchedRemoteSession(input);
    return true;
  } catch {
    return false;
  }
}
