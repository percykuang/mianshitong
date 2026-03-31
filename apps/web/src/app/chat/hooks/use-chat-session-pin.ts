import { useCallback } from 'react';
import { CHAT_ERROR_COPY } from '../lib/chat-copy';
import { getChatErrorMessage } from '../lib/chat-error-message';
import { syncChatSessionUpdate } from '../lib/chat-session-sync-helpers';
import { useChatControllerStore } from './use-chat-controller-store';
import { useChatStorage } from './use-chat-storage';

export function useChatSessionPin(onErrorFeedback: (message: string) => void) {
  const { fetchSessionList, setSessionPinnedState } = useChatStorage();
  const { setActiveSession, setSessions } = useChatControllerStore();

  return useCallback(
    async (sessionId: string, pinned: boolean) => {
      try {
        const updatedSession = await setSessionPinnedState(sessionId, pinned);
        await syncChatSessionUpdate({
          session: updatedSession,
          setActiveSession,
          fetchSessionList,
          setSessions,
        });
      } catch (error) {
        const message = getChatErrorMessage(error, CHAT_ERROR_COPY.pinSessionFailed);
        onErrorFeedback(message);
        throw error;
      }
    },
    [fetchSessionList, onErrorFeedback, setActiveSession, setSessionPinnedState, setSessions],
  );
}
