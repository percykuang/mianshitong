import { useCallback } from 'react';
import { cacheSession } from '../stores/chat-session-cache-store';
import { useChatControllerStore } from './use-chat-controller-store';
import { useChatStorage } from './use-chat-storage';

export function useChatSessionPin(onError: (message: string) => void) {
  const { fetchSessionList, setSessionPinnedState } = useChatStorage();
  const { activeSessionId, setActiveSession, setSessions } = useChatControllerStore();

  return useCallback(
    async (sessionId: string, pinned: boolean) => {
      try {
        const updatedSession = await setSessionPinnedState(sessionId, pinned);
        cacheSession(updatedSession);
        setSessions(await fetchSessionList());

        if (activeSessionId === sessionId) {
          setActiveSession((current) => (current?.id === sessionId ? updatedSession : current));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '置顶会话失败';
        onError(message);
        throw error;
      }
    },
    [
      activeSessionId,
      fetchSessionList,
      onError,
      setActiveSession,
      setSessionPinnedState,
      setSessions,
    ],
  );
}
