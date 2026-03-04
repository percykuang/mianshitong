import type { ChatSession } from '@mianshitong/shared';
import { useCallback } from 'react';
import {
  fetchSessionById,
  openStreamRequest,
  readSseStream,
  type SseEventHandler,
} from '../lib/chat-api';
import { createTemporaryMessage, parseSsePayload } from '../lib/chat-helpers';

interface SendMessageDeps {
  sending: boolean;
  ensureSession: () => Promise<ChatSession>;
  refreshSessions: () => Promise<unknown>;
  setSending: (value: boolean) => void;
  setNotice: (value: string | null) => void;
  setInputValue: (value: string) => void;
  setActiveSession: (
    value: ChatSession | null | ((prev: ChatSession | null) => ChatSession | null),
  ) => void;
  setActiveSessionId: (value: string | null) => void;
}

function createStreamHandler(input: {
  optimisticAssistantId: string;
  setActiveSession: SendMessageDeps['setActiveSession'];
  setActiveSessionId: SendMessageDeps['setActiveSessionId'];
  setNotice: SendMessageDeps['setNotice'];
  setSyncedSession: (session: ChatSession) => void;
}): SseEventHandler {
  return (eventName, payload) => {
    const parsed = parseSsePayload(payload);

    if (eventName === 'delta') {
      const delta = typeof parsed.delta === 'string' ? parsed.delta : '';
      if (!delta) {
        return;
      }

      input.setActiveSession((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          messages: previous.messages.map((message) =>
            message.id === input.optimisticAssistantId
              ? { ...message, content: message.content + delta }
              : message,
          ),
        };
      });
      return;
    }

    if (eventName === 'done') {
      const maybeSession = parsed.session as ChatSession | undefined;
      if (!maybeSession) {
        return;
      }

      input.setSyncedSession(maybeSession);
      input.setActiveSession(maybeSession);
      input.setActiveSessionId(maybeSession.id);
      return;
    }

    if (eventName === 'error') {
      input.setNotice(
        typeof parsed.message === 'string' ? parsed.message : '模型调用失败，请稍后重试',
      );
    }
  };
}

export function useSendMessage({
  sending,
  ensureSession,
  refreshSessions,
  setSending,
  setNotice,
  setInputValue,
  setActiveSession,
  setActiveSessionId,
}: SendMessageDeps) {
  return useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || sending) {
        return;
      }

      setSending(true);
      setNotice(null);

      try {
        const session = await ensureSession();
        const optimisticUser = createTemporaryMessage({ role: 'user', content: trimmed });
        const optimisticAssistant = createTemporaryMessage({ role: 'assistant', content: '' });

        setActiveSession((previous) => {
          const base = previous ?? session;
          return {
            ...base,
            messages: [...base.messages, optimisticUser, optimisticAssistant],
            updatedAt: optimisticUser.createdAt,
          };
        });

        const response = await openStreamRequest(session.id, trimmed);
        let syncedSession: ChatSession | null = null;

        await readSseStream(
          response,
          createStreamHandler({
            optimisticAssistantId: optimisticAssistant.id,
            setActiveSession,
            setActiveSessionId,
            setNotice,
            setSyncedSession: (nextSession) => {
              syncedSession = nextSession;
            },
          }),
        );

        if (!syncedSession) {
          const latest = await fetchSessionById(session.id);
          setActiveSession(latest);
          setActiveSessionId(latest.id);
        }

        await refreshSessions();
        setInputValue('');
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '发送失败，请稍后重试');
      } finally {
        setSending(false);
      }
    },
    [
      sending,
      ensureSession,
      refreshSessions,
      setSending,
      setNotice,
      setInputValue,
      setActiveSession,
      setActiveSessionId,
    ],
  );
}
