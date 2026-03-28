import type { ChatSession } from '@mianshitong/shared';
import { useCallback } from 'react';
import {
  fetchSessionById,
  isAbortError,
  openStreamRequest,
  persistInterruptedSessionTurn,
  readSseStream,
} from '../lib/chat-api';
import { createTemporaryMessage } from '../lib/chat-helpers';
import {
  syncFetchedRemoteSession,
  syncResolvedRemoteSession,
  trySyncFetchedRemoteSession,
} from '../lib/chat-remote-session-sync';
import {
  appendOptimisticMessages,
  finalizeInterruptedAssistantMessage,
  removeOptimisticMessages,
} from '../lib/chat-message-mutations';
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

function hasRemoteSessionAdvanced(
  baseSession: ChatSession | null,
  remoteSession: ChatSession | null,
): boolean {
  if (!remoteSession) {
    return false;
  }

  if (!baseSession) {
    return remoteSession.messages.length > 0;
  }

  return remoteSession.messages.length > baseSession.messages.length;
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
      let optimisticUserCreatedAt: string | null = null;
      let optimisticAssistantCreatedAt: string | null = null;
      let sessionIdToClear: string | null = null;

      try {
        session = readActiveSession() ?? createOptimisticSession();
        sessionIdToClear = session.id;

        const optimisticUser = createTemporaryMessage({ role: 'user', content: trimmed });
        const optimisticAssistant = createTemporaryMessage({ role: 'assistant', content: '' });
        optimisticUserId = optimisticUser.id;
        optimisticAssistantId = optimisticAssistant.id;
        optimisticUserCreatedAt = optimisticUser.createdAt;
        optimisticAssistantCreatedAt = optimisticAssistant.createdAt;

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
        if (isAbortError(error)) {
          const remoteSession = session
            ? await fetchSessionById(session.id).catch(() => null)
            : null;

          if (hasRemoteSessionAdvanced(session, remoteSession)) {
            await syncResolvedRemoteSession({
              session: remoteSession!,
              refreshSessions,
              setActiveSession,
              setActiveSessionId,
              replaceSession,
            });
          } else {
            const interruptedSession = finalizeInterruptedAssistantMessage({
              session: readActiveSession(),
              optimisticAssistantId,
              submittedContent: trimmed,
            });

            setActiveSession(interruptedSession);

            const interruptedAssistant = interruptedSession?.messages.find(
              (message) => message.id === optimisticAssistantId,
            );
            if (interruptedSession && session) {
              const persistedSession = await persistInterruptedSessionTurn({
                sessionId: session.id,
                userContent: trimmed,
                assistantContent: interruptedAssistant?.content,
                modelId: session.modelId,
                expectedMessageCount: session.messages.length,
                userCreatedAt: optimisticUserCreatedAt ?? undefined,
                assistantCreatedAt:
                  interruptedAssistant && optimisticAssistantCreatedAt
                    ? optimisticAssistantCreatedAt
                    : undefined,
              }).catch(() => null);

              if (persistedSession) {
                await syncResolvedRemoteSession({
                  session: persistedSession,
                  refreshSessions,
                  setActiveSession,
                  setActiveSessionId,
                  replaceSession,
                });
              }
            }
          }
          return;
        }

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
