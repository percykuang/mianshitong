import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  chatActiveSessionStore,
  type ChatActiveSessionStore,
} from '../stores/chat-active-session-store';
import { chatSessionListStore, type ChatSessionListStore } from '../stores/chat-session-list-store';

export function useChatControllerStore() {
  const sessionListStore = useStore(
    chatSessionListStore,
    useShallow((state: ChatSessionListStore) => ({
      sessions: state.sessions,
      sessionsLoading: state.sessionsLoading,
      setSessions: state.setSessions,
      setSessionsLoading: state.setSessionsLoading,
    })),
  );

  const activeSessionStore = useStore(
    chatActiveSessionStore,
    useShallow((state: ChatActiveSessionStore) => ({
      activeSessionId: state.activeSessionId,
      activeSession: state.activeSession,
      selectedModelId: state.selectedModelId,
      sending: state.sending,
      activeSessionLoading: state.activeSessionLoading,
      setActiveSessionId: state.setActiveSessionId,
      setActiveSession: state.setActiveSession,
      setSelectedModelId: state.setSelectedModelId,
      setSending: state.setSending,
      setActiveSessionLoading: state.setActiveSessionLoading,
    })),
  );

  return {
    ...sessionListStore,
    ...activeSessionStore,
  };
}
