import { useCallback } from 'react';
import { cacheSession } from '../stores/chat-session-cache-store';
import { useChatControllerStore } from './use-chat-controller-store';
import { useChatStorage } from './use-chat-storage';

export function useChatSessionRename(onError: (message: string) => void) {
  const { fetchSessionList, renameSessionById } = useChatStorage();
  const { activeSessionId, setActiveSession, setSessions } = useChatControllerStore();

  return useCallback(
    async (sessionId: string, title: string) => {
      try {
        const renamedSession = await renameSessionById(sessionId, title);
        cacheSession(renamedSession);
        setSessions(await fetchSessionList());

        if (activeSessionId === sessionId) {
          setActiveSession((current) => (current?.id === sessionId ? renamedSession : current));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '重命名会话失败';
        onError(message);
        throw error;
      }
    },
    [activeSessionId, fetchSessionList, onError, renameSessionById, setActiveSession, setSessions],
  );
}
