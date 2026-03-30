import type { ChatSession } from '@mianshitong/shared';
import { useCallback } from 'react';
import {
  fetchSessionById,
  isAbortError,
  openEditStreamRequest,
  readSseStream,
} from '../lib/chat-api';
import { createTemporaryMessage } from '../lib/chat-helpers';
import {
  syncFetchedRemoteSession,
  syncResolvedRemoteSession,
} from '../lib/chat-remote-session-sync';
import {
  buildOptimisticEditSession,
  finalizeInterruptedAssistantMessage,
  getEditableUserMessageIndex,
  isEditableUserMessage,
} from '../lib/chat-message-mutations';
import { createStreamEventHandler } from './stream-event-handler';

export type EditMessageResult =
  | 'completed'
  | 'no_change'
  | 'aborted_without_output'
  | 'interrupted'
  | 'error';

interface EditMessageDeps {
  activeSession: ChatSession | null;
  readActiveSession: () => ChatSession | null;
  sending: boolean;
  refreshSessions: () => Promise<unknown>;
  refreshChatUsage: () => Promise<unknown>;
  registerAbortController: (controller: AbortController) => void;
  clearAbortController: (controller: AbortController) => void;
  setSending: (value: boolean) => void;
  setNotice: (value: string | null) => void;
  setActiveSession: (
    value: ChatSession | null | ((prev: ChatSession | null) => ChatSession | null),
  ) => void;
  setActiveSessionId: (value: string | null) => void;
}

function buildSessionShapeKey(session: ChatSession | null): string {
  if (!session) {
    return '';
  }

  return JSON.stringify({
    title: session.title,
    status: session.status,
    messages: session.messages.map((message) => ({
      role: message.role,
      kind: message.kind,
      content: message.content,
      completionStatus: message.completionStatus ?? null,
    })),
  });
}

function hasSessionChanged(baseSession: ChatSession, remoteSession: ChatSession | null): boolean {
  return (
    remoteSession !== null &&
    buildSessionShapeKey(baseSession) !== buildSessionShapeKey(remoteSession)
  );
}

async function fetchChangedSessionAfterAbort(
  sessionId: string,
  baseSession: ChatSession,
): Promise<ChatSession | null> {
  const maxAttempts = 2;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const remoteSession = await fetchSessionById(sessionId).catch(() => null);
    if (hasSessionChanged(baseSession, remoteSession)) {
      return remoteSession;
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 40));
    }
  }

  return null;
}

export function useEditMessage({
  activeSession,
  readActiveSession,
  sending,
  refreshSessions,
  refreshChatUsage,
  registerAbortController,
  clearAbortController,
  setSending,
  setNotice,
  setActiveSession,
  setActiveSessionId,
}: EditMessageDeps) {
  return useCallback(
    async (messageId: string, content: string): Promise<EditMessageResult> => {
      const session = activeSession;

      if (!session || sending) {
        return 'error';
      }

      const targetIndex = getEditableUserMessageIndex(session.messages, messageId);
      if (targetIndex < 0) {
        setNotice('目标消息不存在或不可编辑');
        return 'error';
      }

      const trimmed = content.trim();
      if (!trimmed) {
        setNotice('编辑内容不能为空');
        return 'error';
      }

      const targetMessage = session.messages[targetIndex];
      if (!targetMessage) {
        setNotice('目标消息不存在或不可编辑');
        return 'error';
      }

      if (!isEditableUserMessage(session.messages, messageId)) {
        setNotice('当前仅支持编辑最后一条用户消息');
        return 'error';
      }

      if (targetMessage.content.trim() === trimmed) {
        return 'no_change';
      }

      const abortController = new AbortController();
      let optimisticAssistantId: string | null = null;
      registerAbortController(abortController);
      setSending(true);
      setNotice(null);

      try {
        const optimisticAssistant = createTemporaryMessage({ role: 'assistant', content: '' });
        optimisticAssistantId = optimisticAssistant.id;
        const optimisticSession = buildOptimisticEditSession({
          session,
          messageId,
          userContent: trimmed,
          optimisticAssistant,
          updatedAt: new Date().toISOString(),
        });
        if (!optimisticSession) {
          throw new Error('目标消息不存在或不可编辑');
        }

        setActiveSession(optimisticSession);

        const response = await openEditStreamRequest(
          session.id,
          messageId,
          trimmed,
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
          });
        } else {
          await syncFetchedRemoteSession({
            sessionId: session.id,
            fetchSessionById,
            refreshSessions,
            setActiveSession,
            setActiveSessionId,
          });
        }
        return 'completed';
      } catch (error) {
        if (isAbortError(error)) {
          const interruptedSession = finalizeInterruptedAssistantMessage({
            session: readActiveSession(),
            optimisticAssistantId,
            submittedContent: trimmed,
          });
          const interruptedAssistant = interruptedSession?.messages.find(
            (message) => message.id === optimisticAssistantId,
          );
          const hasAssistantOutput =
            interruptedAssistant?.role === 'assistant' &&
            interruptedAssistant.content.trim().length > 0;

          if (!hasAssistantOutput) {
            setActiveSession(session);
            return 'aborted_without_output';
          }

          const remoteSession = await fetchChangedSessionAfterAbort(session.id, session);
          if (remoteSession) {
            await syncResolvedRemoteSession({
              session: remoteSession,
              refreshSessions,
              setActiveSession,
              setActiveSessionId,
            });
            return 'interrupted';
          }

          setActiveSession(interruptedSession);
          return 'interrupted';
        }

        setActiveSession(session);
        setNotice(error instanceof Error ? error.message : '编辑失败，请稍后重试');
        return 'error';
      } finally {
        await refreshChatUsage().catch(() => undefined);
        clearAbortController(abortController);
        setSending(false);
      }
    },
    [
      activeSession,
      readActiveSession,
      sending,
      refreshSessions,
      refreshChatUsage,
      registerAbortController,
      clearAbortController,
      setSending,
      setNotice,
      setActiveSession,
      setActiveSessionId,
    ],
  );
}
