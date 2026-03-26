import type { ChatMessageFeedback } from '@mianshitong/shared';
import { useCallback, useState } from 'react';
import { setMessageFeedbackRequest } from '../lib/chat-message-feedback-api';
import { cacheSession } from '../stores/chat-session-cache-store';
import { useChatControllerStore } from './use-chat-controller-store';

interface UseChatMessageFeedbackInput {
  sessionId: string | null;
  onError: (message: string) => void;
}

export function useChatMessageFeedback({ sessionId, onError }: UseChatMessageFeedbackInput) {
  const { setActiveSession } = useChatControllerStore();
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);

  const setMessageFeedback = useCallback(
    async (messageId: string, feedback: ChatMessageFeedback | null) => {
      if (!sessionId || pendingMessageId) {
        return;
      }

      setPendingMessageId(messageId);

      try {
        const session = await setMessageFeedbackRequest(sessionId, messageId, feedback);

        cacheSession(session);
        setActiveSession((current) => (current?.id === session.id ? session : current));
      } catch (error) {
        const message = error instanceof Error ? error.message : '记录反馈失败';
        onError(message);
      } finally {
        setPendingMessageId(null);
      }
    },
    [onError, pendingMessageId, sessionId, setActiveSession],
  );

  return {
    pendingMessageId,
    setMessageFeedback,
  };
}
