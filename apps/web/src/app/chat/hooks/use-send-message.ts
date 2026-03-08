import type { ChatSession } from '@mianshitong/shared';
import { useCallback } from 'react';
import { fetchSessionById, isAbortError, openStreamRequest, readSseStream } from '../lib/chat-api';
import { clearRouteBootstrapBypass } from '../lib/chat-route-bootstrap-bypass';
import { createTemporaryMessage } from '../lib/chat-helpers';
import { createStreamEventHandler } from './stream-event-handler';

interface SendMessageDeps {
  sending: boolean;
  readActiveSession: () => ChatSession | null;
  createOptimisticSession: () => ChatSession;
  refreshSessions: () => Promise<unknown>;
  setSending: (value: boolean) => void;
  setNotice: (value: string | null) => void;
  setInputValue: (value: string) => void;
  readInputValue: () => string;
  registerAbortController: (controller: AbortController) => void;
  clearAbortController: (controller: AbortController) => void;
  setActiveSession: (
    value: ChatSession | null | ((prev: ChatSession | null) => ChatSession | null),
  ) => void;
  setActiveSessionId: (value: string | null) => void;
  replaceSession: (sessionId: string) => void;
}

export function useSendMessage({
  sending,
  readActiveSession,
  createOptimisticSession,
  refreshSessions,
  setSending,
  setNotice,
  setInputValue,
  readInputValue,
  registerAbortController,
  clearAbortController,
  setActiveSession,
  setActiveSessionId,
  replaceSession,
}: SendMessageDeps) {
  return useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || sending) {
        return;
      }

      const abortController = new AbortController();
      registerAbortController(abortController);
      setInputValue('');
      setSending(true);
      setNotice(null);

      let session = readActiveSession();
      let optimisticUserId: string | null = null;
      let optimisticAssistantId: string | null = null;
      let sessionIdToClear: string | null = null;

      const removeOptimisticExchange = () => {
        if (!optimisticUserId && !optimisticAssistantId) {
          return;
        }

        setActiveSession((previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            status: 'idle',
            messages: previous.messages.filter(
              (message) => message.id !== optimisticUserId && message.id !== optimisticAssistantId,
            ),
          };
        });
      };

      const syncPersistedSession = async (): Promise<boolean> => {
        if (!session) {
          return false;
        }

        const latest = await fetchSessionById(session.id).catch(() => null);
        if (!latest) {
          return false;
        }

        setActiveSession(latest);
        setActiveSessionId(latest.id);
        replaceSession(latest.id);
        await refreshSessions();
        return true;
      };

      try {
        session = readActiveSession() ?? createOptimisticSession();
        sessionIdToClear = session.id;

        const optimisticUser = createTemporaryMessage({ role: 'user', content: trimmed });
        const optimisticAssistant = createTemporaryMessage({ role: 'assistant', content: '' });
        optimisticUserId = optimisticUser.id;
        optimisticAssistantId = optimisticAssistant.id;

        setActiveSession((previous) => {
          const base = previous ?? session!;
          return {
            ...base,
            messages: [...base.messages, optimisticUser, optimisticAssistant],
            updatedAt: optimisticUser.createdAt,
          };
        });

        const response = await openStreamRequest(
          session.id,
          trimmed,
          session.modelId,
          abortController.signal,
        );
        let syncedSession: ChatSession | null = null;

        await readSseStream(
          response,
          createStreamEventHandler({
            optimisticAssistantId: optimisticAssistant.id,
            setActiveSession,
            setNotice,
            setSyncedSession: (nextSession) => {
              syncedSession = nextSession;
            },
          }),
        );

        const latest = syncedSession ?? (await fetchSessionById(session.id));
        setActiveSession(latest);
        setActiveSessionId(latest.id);
        replaceSession(latest.id);
        await refreshSessions();
      } catch (error) {
        const synced = await syncPersistedSession();

        if (isAbortError(error)) {
          if (!synced) {
            removeOptimisticExchange();
          }
          return;
        }

        if (readInputValue() === '') {
          setInputValue(content);
        }
        if (!synced) {
          removeOptimisticExchange();
        }
        setNotice(error instanceof Error ? error.message : '发送失败，请稍后重试');
      } finally {
        if (sessionIdToClear) {
          clearRouteBootstrapBypass(sessionIdToClear);
        }
        clearAbortController(abortController);
        setSending(false);
      }
    },
    [
      sending,
      readActiveSession,
      createOptimisticSession,
      refreshSessions,
      setSending,
      setNotice,
      setInputValue,
      readInputValue,
      registerAbortController,
      clearAbortController,
      setActiveSession,
      setActiveSessionId,
      replaceSession,
    ],
  );
}
