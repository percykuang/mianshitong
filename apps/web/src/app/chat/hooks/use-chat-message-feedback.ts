import type { ChatMessageFeedback } from '@mianshitong/shared';
import { useCallback, useState } from 'react';
import { CHAT_ERROR_COPY } from '../lib/chat-copy';
import { getChatErrorMessage } from '../lib/chat-error-message';
import { setMessageFeedbackRequest } from '../lib/chat-message-feedback-api';
import { syncChatSessionUpdate } from '../lib/chat-session-sync-helpers';
import { useChatControllerStore } from './use-chat-controller-store';

interface UseChatMessageFeedbackInput {
  sessionId: string | null;
  onErrorFeedback: (message: string) => void;
}

export function useChatMessageFeedback({
  sessionId,
  onErrorFeedback,
}: UseChatMessageFeedbackInput) {
  const { setActiveSession } = useChatControllerStore();
  const [pendingFeedbackTargetMessageId, setPendingFeedbackTargetMessageId] = useState<
    string | null
  >(null);

  const submitMessageFeedback = useCallback(
    async (messageId: string, nextMessageFeedback: ChatMessageFeedback | null) => {
      if (!sessionId || pendingFeedbackTargetMessageId) {
        return;
      }

      setPendingFeedbackTargetMessageId(messageId);

      try {
        const session = await setMessageFeedbackRequest(sessionId, messageId, nextMessageFeedback);
        await syncChatSessionUpdate({
          session,
          setActiveSession,
        });
      } catch (error) {
        const message = getChatErrorMessage(error, CHAT_ERROR_COPY.feedbackFailed);
        onErrorFeedback(message);
      } finally {
        setPendingFeedbackTargetMessageId(null);
      }
    },
    [onErrorFeedback, pendingFeedbackTargetMessageId, sessionId, setActiveSession],
  );

  return {
    pendingFeedbackTargetMessageId,
    submitMessageFeedback,
  };
}
