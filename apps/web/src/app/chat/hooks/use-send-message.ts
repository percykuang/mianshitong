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
import { CHAT_ERROR_COPY } from '../lib/chat-copy';
import { getChatErrorMessage } from '../lib/chat-error-message';
import { clearRouteBootstrapBypass } from '../lib/chat-route-bootstrap-bypass';
import { createStreamEventHandler } from './stream-event-handler';

interface SendMessageDeps {
  sending: boolean;
  readActiveSession: () => ChatSession | null;
  createOptimisticSession: () => ChatSession;
  refreshSessions: () => Promise<unknown>;
  refreshChatUsage: () => Promise<unknown>;
  setSending: (value: boolean) => void;
  setErrorFeedback: (value: string | null) => void;
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

function getAssistantMessageById(session: ChatSession | null, assistantMessageId: string | null) {
  if (!session || !assistantMessageId) {
    return null;
  }

  return (
    session.messages.find(
      (message) => message.id === assistantMessageId && message.role === 'assistant',
    ) ?? null
  );
}

function shouldTrustRemoteSessionAfterAbort(input: {
  baseSession: ChatSession | null;
  remoteSession: ChatSession | null;
  localInterruptedAssistantContent: string;
}): boolean {
  if (!hasRemoteSessionAdvanced(input.baseSession, input.remoteSession)) {
    return false;
  }

  if (!input.localInterruptedAssistantContent) {
    return true;
  }

  const remoteAssistant =
    [...(input.remoteSession?.messages ?? [])]
      .reverse()
      .find((message) => message.role === 'assistant') ?? null;

  return remoteAssistant?.completionStatus === 'interrupted';
}

export function useSendMessage({
  sending,
  readActiveSession,
  createOptimisticSession,
  refreshSessions,
  refreshChatUsage,
  setSending,
  setErrorFeedback,
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
      setErrorFeedback(null);

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
            setErrorFeedback,
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
          const interruptedSession = finalizeInterruptedAssistantMessage({
            session: readActiveSession(),
            optimisticAssistantId,
            submittedContent: trimmed,
          });
          const interruptedAssistant = getAssistantMessageById(
            interruptedSession,
            optimisticAssistantId,
          );
          const interruptedAssistantContent = interruptedAssistant?.content.trim() ?? '';
          const remoteSession = session
            ? await fetchSessionById(session.id).catch(() => null)
            : null;

          if (
            shouldTrustRemoteSessionAfterAbort({
              baseSession: session,
              remoteSession,
              localInterruptedAssistantContent: interruptedAssistantContent,
            })
          ) {
            await syncResolvedRemoteSession({
              session: remoteSession!,
              refreshSessions,
              setActiveSession,
              setActiveSessionId,
              replaceSession,
            });
          } else {
            setActiveSession(interruptedSession);
            if (interruptedSession && session) {
              const persistedSession = await persistInterruptedSessionTurn({
                sessionId: session.id,
                userContent: trimmed,
                assistantContent: interruptedAssistantContent || undefined,
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
        setErrorFeedback(getChatErrorMessage(error, CHAT_ERROR_COPY.sendFailed));
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
      setErrorFeedback,
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
