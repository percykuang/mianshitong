import type { ChatSession, ChatUsageSummary, SessionSummary } from '@mianshitong/shared';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import {
  deleteAllSessionsRequest,
  deleteSessionRequest,
  fetchChatUsageSummary,
  fetchSessionById,
  fetchSessions,
  renameSessionRequest,
} from '../lib/chat-api';
import { setSessionPinnedRequest } from '../lib/chat-session-settings-api';

interface UseChatStorageResult {
  ready: boolean;
  isAuthenticated: boolean;
  chatUsage: ChatUsageSummary | null;
  usageLoading: boolean;
  usageError: string | null;
  refreshChatUsage: () => Promise<ChatUsageSummary>;
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
  const [chatUsage, setChatUsage] = useState<ChatUsageSummary | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageBootstrapped, setUsageBootstrapped] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);

  const refreshChatUsage = useCallback(async () => {
    const nextUsage = await fetchChatUsageSummary();
    setChatUsage(nextUsage);
    setUsageError(null);
    return nextUsage;
  }, []);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    let cancelled = false;
    const requestTimer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      setUsageLoading(true);
      setUsageBootstrapped(false);
      void fetchChatUsageSummary()
        .then((nextUsage) => {
          if (cancelled) {
            return;
          }

          setChatUsage(nextUsage);
          setUsageError(null);
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }

          setChatUsage(null);
          setUsageError(error instanceof Error ? error.message : '额度初始化失败');
        })
        .finally(() => {
          if (cancelled) {
            return;
          }

          setUsageLoading(false);
          setUsageBootstrapped(true);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(requestTimer);
    };
  }, [status]);

  return {
    ready: status !== 'loading' && usageBootstrapped,
    isAuthenticated,
    chatUsage,
    usageLoading,
    usageError,
    refreshChatUsage,
    fetchSessionList: fetchSessions,
    fetchSessionDetail: fetchSessionById,
    renameSessionById: renameSessionRequest,
    setSessionPinnedState: setSessionPinnedRequest,
    deleteSessionById: deleteSessionRequest,
    deleteAllSessions: deleteAllSessionsRequest,
  };
}
