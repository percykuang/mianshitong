import type { ChatSession } from '@mianshitong/shared';
import { useCallback } from 'react';
import { openGuestStreamRequest, readSseStream } from '../lib/chat-api';
import { createLocalStreamHandler } from '../lib/chat-local-stream-handler';
import { getEditableUserMessageIndex } from '../lib/chat-message-mutations';
import { createMessage, rebuildSessionAfterEdit, toStreamTurns } from '../lib/chat-local-session';
import { saveLocalSession } from '../lib/chat-local-storage';

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

      const targetIndex = getEditableUserMessageIndex(session.messages, messageId);
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
        const streamHandler = createLocalStreamHandler({
          optimisticAssistantId: optimisticAssistant.id,
          setActiveSession,
          setNotice,
        });

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

        await readSseStream(response, streamHandler.handleEvent);

        const normalizedAssistantContent = streamHandler.getAssistantContent().trim();
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
