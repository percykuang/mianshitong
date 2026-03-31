import { useCallback } from 'react';
import { CHAT_ERROR_COPY } from '../lib/chat-copy';
import { getChatErrorMessage } from '../lib/chat-error-message';
import { syncChatSessionUpdate } from '../lib/chat-session-sync-helpers';
import { useChatControllerStore } from './use-chat-controller-store';
import { useChatStorage } from './use-chat-storage';

export function useChatSessionRename(onErrorFeedback: (message: string) => void) {
  const { fetchSessionList, renameSessionById } = useChatStorage();
  const { setActiveSession, setSessions } = useChatControllerStore();

  return useCallback(
    async (sessionId: string, title: string) => {
      try {
        const renamedSession = await renameSessionById(sessionId, title);
        await syncChatSessionUpdate({
          session: renamedSession,
          setActiveSession,
          fetchSessionList,
          setSessions,
        });
      } catch (error) {
        const message = getChatErrorMessage(error, CHAT_ERROR_COPY.renameSessionFailed);
        onErrorFeedback(message);
        throw error;
      }
    },
    [fetchSessionList, onErrorFeedback, renameSessionById, setActiveSession, setSessions],
  );
}
