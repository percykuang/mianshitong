import type { ChatMessage, ChatSession } from '@mianshitong/shared';
import { useCallback } from 'react';
import { fetchSessionById, openEditStreamRequest, readSseStream } from '../lib/chat-api';
import { createTemporaryMessage } from '../lib/chat-helpers';
import { createStreamEventHandler } from './stream-event-handler';

interface EditMessageDeps {
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

function getEditableUserMessageIndex(messages: ChatMessage[], messageId: string): number {
  return messages.findIndex((item) => item.id === messageId && item.role === 'user');
}

export function useEditMessage({
  activeSession,
  sending,
  refreshSessions,
  setSending,
  setNotice,
  setActiveSession,
  setActiveSessionId,
}: EditMessageDeps) {
  return useCallback(
    async (messageId: string, content: string): Promise<boolean> => {
      const session = activeSession;
      const trimmed = content.trim();

      if (!session || !trimmed || sending) {
        return false;
      }

      const targetIndex = getEditableUserMessageIndex(session.messages, messageId);
      if (targetIndex < 0) {
        setNotice('目标消息不存在或不可编辑');
        return false;
      }

      setSending(true);
      setNotice(null);

      try {
        const optimisticAssistant = createTemporaryMessage({ role: 'assistant', content: '' });
        const optimisticMessages = [
          ...session.messages
            .slice(0, targetIndex + 1)
            .map((item) => (item.id === messageId ? { ...item, content: trimmed } : item)),
          optimisticAssistant,
        ];

        setActiveSession({
          ...session,
          messages: optimisticMessages,
          updatedAt: new Date().toISOString(),
        });

        const response = await openEditStreamRequest(session.id, messageId, trimmed);
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
