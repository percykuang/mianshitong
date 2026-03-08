import type { ChatSession, SessionSummary } from '@mianshitong/shared';
import { useSession } from 'next-auth/react';
import { useCallback } from 'react';
import {
  deleteAllSessionsRequest,
  deleteSessionRequest,
  fetchSessionById,
  fetchSessions,
  renameSessionRequest,
} from '../lib/chat-api';
import { setSessionPinnedRequest } from '../lib/chat-session-settings-api';
import {
  clearLocalSessions,
  deleteLocalSession,
  getLocalSessionById,
  listLocalSessions,
  renameLocalSession,
  setLocalSessionPinnedState,
} from '../lib/chat-local-storage';

interface UseChatStorageResult {
  ready: boolean;
  isAuthenticated: boolean;
  fetchSessionList: () => Promise<SessionSummary[]>;
  fetchSessionDetail: (sessionId: string) => Promise<ChatSession>;
  renameSessionById: (sessionId: string, title: string) => Promise<ChatSession>;
  setSessionPinnedState: (sessionId: string, pinned: boolean) => Promise<ChatSession>;
  deleteSessionById: (sessionId: string) => Promise<void>;
  deleteAllSessions: () => Promise<void>;
}

export function useChatStorage(): UseChatStorageResult {
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const ready = status !== 'loading';

  const fetchSessionList = useCallback(async () => {
    return isAuthenticated ? fetchSessions() : listLocalSessions();
  }, [isAuthenticated]);

  const fetchSessionDetail = useCallback(
    async (sessionId: string) => {
      if (isAuthenticated) {
        return fetchSessionById(sessionId);
      }

      const local = await getLocalSessionById(sessionId);
      if (!local) {
        throw new Error('Session not found');
      }
      return local;
    },
    [isAuthenticated],
  );

  const renameSessionById = useCallback(
    async (sessionId: string, title: string) => {
      return isAuthenticated
        ? renameSessionRequest(sessionId, title)
        : renameLocalSession(sessionId, title);
    },
    [isAuthenticated],
  );

  const setSessionPinnedState = useCallback(
    async (sessionId: string, pinned: boolean) => {
      return isAuthenticated
        ? setSessionPinnedRequest(sessionId, pinned)
        : setLocalSessionPinnedState(sessionId, pinned);
    },
    [isAuthenticated],
  );

  const deleteSessionById = useCallback(
    async (sessionId: string) => {
      if (isAuthenticated) {
        await deleteSessionRequest(sessionId);
        return;
      }

      await deleteLocalSession(sessionId);
    },
    [isAuthenticated],
  );

  const deleteAllSessions = useCallback(async () => {
    if (isAuthenticated) {
      await deleteAllSessionsRequest();
      return;
    }

    await clearLocalSessions();
  }, [isAuthenticated]);

  return {
    ready,
    isAuthenticated,
    fetchSessionList,
    fetchSessionDetail,
    renameSessionById,
    setSessionPinnedState,
    deleteSessionById,
    deleteAllSessions,
  };
}
