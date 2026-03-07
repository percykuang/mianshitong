import type { ChatMessage, ChatSession } from '@mianshitong/shared';
import { useCallback } from 'react';
import { openGuestStreamRequest, readSseStream } from '../lib/chat-api';
import { createMessage, rebuildSessionAfterEdit, toStreamTurns } from '../lib/chat-local-session';
import { saveLocalSession } from '../lib/chat-local-storage';
import { parseSsePayload } from '../lib/chat-helpers';

interface LocalEditMessageDeps {
  activeSession: ChatSession | null;
  sending: boolean;
  refreshSessions: () => Promise<unknown>;
  setSending: (value: boolean) => void;
  setNotice: (value: string | null) => void;
  setActiveSession: (
    value: ChatSession | null | ((prev: ChatSession | null) => ChatSession | null),
  ) => void;
  setActiveSessionId: (value: string | null) => void;
}

function findEditableMessageIndex(messages: ChatMessage[], messageId: string): number {
  return messages.findIndex((item) => item.id === messageId && item.role === 'user');
}

export function useLocalEditMessage({
  activeSession,
  sending,
  refreshSessions,
  setSending,
  setNotice,
  setActiveSession,
  setActiveSessionId,
}: LocalEditMessageDeps) {
  return useCallback(
    async (messageId: string, content: string): Promise<boolean> => {
      const session = activeSession;
      const trimmed = content.trim();
      if (!session || !trimmed || sending) {
        return false;
      }

      const targetIndex = findEditableMessageIndex(session.messages, messageId);
      if (targetIndex < 0) {
        setNotice('目标消息不存在或不可编辑');
        return false;
      }

      setSending(true);
      setNotice(null);

      try {
        const now = new Date().toISOString();
        const optimisticAssistant = createMessage({
          role: 'assistant',
          kind: 'text',
          content: '',
          createdAt: now,
        });
        const editedHistory = session.messages
          .slice(0, targetIndex + 1)
          .map((item) => (item.id === messageId ? { ...item, content: trimmed } : item));

        setActiveSession({
          ...session,
          messages: [...editedHistory, optimisticAssistant],
          updatedAt: now,
          report: null,
        });

        const response = await openGuestStreamRequest({
          modelId: session.modelId,
          messages: toStreamTurns(editedHistory),
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

        const updated = rebuildSessionAfterEdit(session, {
          messageId,
          userContent: trimmed,
          assistantContent: normalizedAssistantContent,
        });
        if (!updated) {
          throw new Error('目标消息不存在或不可编辑');
        }

        await saveLocalSession(updated);
        setActiveSession(updated);
        setActiveSessionId(updated.id);
        await refreshSessions();
        return true;
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '编辑失败，请稍后重试');
        return false;
      } finally {
        setSending(false);
      }
    },
    [
      activeSession,
      sending,
      refreshSessions,
      setSending,
      setNotice,
      setActiveSession,
      setActiveSessionId,
    ],
  );
}
