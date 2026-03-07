import type { ChatSession, ModelId, SessionSummary } from '@mianshitong/shared';
import { useSession } from 'next-auth/react';
import { useCallback } from 'react';
import {
  createSessionRequest,
  deleteAllSessionsRequest,
  deleteSessionRequest,
  fetchSessionById,
  fetchSessions,
} from '../lib/chat-api';
import { createGuestSession } from '../lib/chat-local-session';
import {
  clearLocalSessions,
  deleteLocalSession,
  getLocalSessionById,
  listLocalSessions,
  saveLocalSession,
} from '../lib/chat-local-storage';

interface UseChatStorageResult {
  ready: boolean;
  isAuthenticated: boolean;
  fetchSessionList: () => Promise<SessionSummary[]>;
  fetchSessionDetail: (sessionId: string) => Promise<ChatSession>;
  createSession: (modelId: ModelId) => Promise<ChatSession>;
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

  const createSession = useCallback(
    async (modelId: ModelId) => {
      if (isAuthenticated) {
        return createSessionRequest({ modelId });
      }

      const local = createGuestSession(modelId);
      await saveLocalSession(local);
      return local;
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
    createSession,
    deleteSessionById,
    deleteAllSessions,
  };
}
