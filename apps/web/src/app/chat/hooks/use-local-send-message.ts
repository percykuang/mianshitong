import type { ChatSession } from '@mianshitong/shared';
import { useCallback } from 'react';
import { openGuestStreamRequest, readSseStream } from '../lib/chat-api';
import {
  appendUserAssistantMessages,
  createMessage,
  toStreamTurns,
} from '../lib/chat-local-session';
import { saveLocalSession } from '../lib/chat-local-storage';
import { parseSsePayload } from '../lib/chat-helpers';

interface LocalSendMessageDeps {
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

export function useLocalSendMessage({
  sending,
  ensureSession,
  refreshSessions,
  setSending,
  setNotice,
  setInputValue,
  setActiveSession,
  setActiveSessionId,
}: LocalSendMessageDeps) {
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
        const now = new Date().toISOString();
        const optimisticUser = createMessage({
          role: 'user',
          kind: 'text',
          content: trimmed,
          createdAt: now,
        });
        const optimisticAssistant = createMessage({
          role: 'assistant',
          kind: 'text',
          content: '',
          createdAt: now,
        });

        setActiveSession((previous) => {
          const base = previous ?? session;
          return {
            ...base,
            messages: [...base.messages, optimisticUser, optimisticAssistant],
            updatedAt: now,
          };
        });

        const turns = toStreamTurns([...session.messages, optimisticUser]);
        const response = await openGuestStreamRequest({
          modelId: session.modelId,
          messages: turns,
        });

        let assistantContent = '';
        await readSseStream(response, (eventName, payload) => {
          const parsed = parseSsePayload(payload);

          if (eventName === 'delta') {
            const delta = typeof parsed.delta === 'string' ? parsed.delta : '';
            if (!delta) {
              return;
            }

            assistantContent += delta;
            setActiveSession((previous) => {
              if (!previous) {
                return previous;
              }

              return {
                ...previous,
                messages: previous.messages.map((item) =>
                  item.id === optimisticAssistant.id
                    ? { ...item, content: item.content + delta }
                    : item,
                ),
              };
            });
            return;
          }

          if (eventName === 'done') {
            const value =
              typeof parsed.assistantContent === 'string'
                ? parsed.assistantContent
                : assistantContent;
            assistantContent = value;
            return;
          }

          if (eventName === 'error') {
            const message =
              typeof parsed.message === 'string' ? parsed.message : '模型调用失败，请稍后重试';
            setNotice(message);
          }
        });

        const normalizedAssistantContent = assistantContent.trim();
        if (!normalizedAssistantContent) {
          throw new Error('模型没有返回可用内容');
        }

        const updated = appendUserAssistantMessages(session, {
          userContent: trimmed,
          assistantContent: normalizedAssistantContent,
        });

        await saveLocalSession(updated);
        setActiveSession(updated);
        setActiveSessionId(updated.id);
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
