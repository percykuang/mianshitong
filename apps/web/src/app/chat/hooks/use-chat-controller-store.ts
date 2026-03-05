import { useState } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  createChatSessionStore,
  type ChatSessionStore,
  type ChatSessionStoreApi,
} from '../stores/chat-session-store';

export function useChatControllerStore() {
  const [sessionStoreApi] = useState<ChatSessionStoreApi>(createChatSessionStore);

  const sessionStore = useStore(
    sessionStoreApi,
    useShallow((state: ChatSessionStore) => ({
      sessions: state.sessions,
      activeSessionId: state.activeSessionId,
      activeSession: state.activeSession,
      selectedModelId: state.selectedModelId,
      privateMode: state.privateMode,
      sending: state.sending,
      loading: state.loading,
      setSessions: state.setSessions,
      setActiveSessionId: state.setActiveSessionId,
      setActiveSession: state.setActiveSession,
      setSelectedModelId: state.setSelectedModelId,
      setPrivateMode: state.setPrivateMode,
      setSending: state.setSending,
      setLoading: state.setLoading,
    })),
  );

  return sessionStore;
}
