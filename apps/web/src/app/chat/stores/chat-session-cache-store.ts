import type { ChatSession } from '@mianshitong/shared';
import { createStore } from 'zustand/vanilla';

interface ChatSessionCacheStoreState {
  sessionsById: Record<string, ChatSession>;
}

interface ChatSessionCacheStoreActions {
  upsertSession: (session: ChatSession) => void;
  removeSession: (sessionId: string) => void;
  clearSessions: () => void;
}

type ChatSessionCacheStore = ChatSessionCacheStoreState & ChatSessionCacheStoreActions;

const defaultState: ChatSessionCacheStoreState = {
  sessionsById: {},
};

export const createChatSessionCacheStore = (
  initialState: ChatSessionCacheStoreState = defaultState,
) => {
  return createStore<ChatSessionCacheStore>()((set) => ({
    ...initialState,
    upsertSession: (session) => {
      set((state) => ({
        sessionsById:
          state.sessionsById[session.id] === session
            ? state.sessionsById
            : { ...state.sessionsById, [session.id]: session },
      }));
    },
    removeSession: (sessionId) => {
      set((state) => {
        if (!(sessionId in state.sessionsById)) {
          return state;
        }

        const next = { ...state.sessionsById };
        delete next[sessionId];
        return { sessionsById: next };
      });
    },
    clearSessions: () => {
      set({ sessionsById: {} });
    },
  }));
};

export const chatSessionCacheStore = createChatSessionCacheStore();

export function readCachedSession(sessionId: string | null | undefined): ChatSession | null {
  if (!sessionId) {
    return null;
  }

  return chatSessionCacheStore.getState().sessionsById[sessionId] ?? null;
}

export function cacheSession(session: ChatSession): void {
  chatSessionCacheStore.getState().upsertSession(session);
}

export function removeCachedSession(sessionId: string): void {
  chatSessionCacheStore.getState().removeSession(sessionId);
}

export function clearCachedSessions(): void {
  chatSessionCacheStore.getState().clearSessions();
}
