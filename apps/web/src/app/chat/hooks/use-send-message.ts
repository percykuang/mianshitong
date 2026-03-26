import type { ChatSession } from '@mianshitong/shared';
import { useCallback } from 'react';
import { fetchSessionById, isAbortError, openStreamRequest, readSseStream } from '../lib/chat-api';
import { createTemporaryMessage } from '../lib/chat-helpers';
import {
  syncFetchedRemoteSession,
  syncResolvedRemoteSession,
  trySyncFetchedRemoteSession,
} from '../lib/chat-remote-session-sync';
import { appendOptimisticMessages, removeOptimisticMessages } from '../lib/chat-message-mutations';
import { clearRouteBootstrapBypass } from '../lib/chat-route-bootstrap-bypass';
import { createStreamEventHandler } from './stream-event-handler';

interface SendMessageDeps {
  sending: boolean;
  readActiveSession: () => ChatSession | null;
  createOptimisticSession: () => ChatSession;
  refreshSessions: () => Promise<unknown>;
  refreshChatUsage: () => Promise<unknown>;
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
  refreshChatUsage,
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

      try {
        session = readActiveSession() ?? createOptimisticSession();
        sessionIdToClear = session.id;

        const optimisticUser = createTemporaryMessage({ role: 'user', content: trimmed });
        const optimisticAssistant = createTemporaryMessage({ role: 'assistant', content: '' });
        optimisticUserId = optimisticUser.id;
        optimisticAssistantId = optimisticAssistant.id;

        setActiveSession((previous) =>
          appendOptimisticMessages(
            previous ?? session!,
            [optimisticUser, optimisticAssistant],
            optimisticUser.createdAt,
          ),
        );

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

        if (syncedSession) {
          await syncResolvedRemoteSession({
            session: syncedSession,
            refreshSessions,
            setActiveSession,
            setActiveSessionId,
            replaceSession,
          });
        } else {
          await syncFetchedRemoteSession({
            sessionId: session.id,
            fetchSessionById,
            refreshSessions,
            setActiveSession,
            setActiveSessionId,
            replaceSession,
          });
        }
      } catch (error) {
        const synced = session
          ? await trySyncFetchedRemoteSession({
              sessionId: session.id,
              fetchSessionById,
              refreshSessions,
              setActiveSession,
              setActiveSessionId,
              replaceSession,
            })
          : false;

        if (isAbortError(error)) {
          if (!synced) {
            setActiveSession((previous) =>
              removeOptimisticMessages(previous, [optimisticUserId, optimisticAssistantId]),
            );
          }
          return;
        }

        if (readInputValue() === '') {
          setInputValue(content);
        }
        if (!synced) {
          setActiveSession((previous) =>
            removeOptimisticMessages(previous, [optimisticUserId, optimisticAssistantId]),
          );
        }
        setNotice(error instanceof Error ? error.message : '发送失败，请稍后重试');
      } finally {
        await refreshChatUsage().catch(() => undefined);
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
      refreshChatUsage,
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
