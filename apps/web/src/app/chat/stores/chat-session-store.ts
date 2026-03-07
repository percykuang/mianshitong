import type { ChatSession, ModelId, SessionSummary } from '@mianshitong/shared';
import { createStore } from 'zustand/vanilla';
import type { Updater } from './types';

export interface ChatSessionStoreState {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  selectedModelId: ModelId;
  sending: boolean;
  loading: boolean;
}

export interface ChatSessionStoreActions {
  setSessions: (sessions: SessionSummary[]) => void;
  setActiveSessionId: (value: string | null) => void;
  setActiveSession: (value: Updater<ChatSession | null>) => void;
  setSelectedModelId: (value: ModelId) => void;
  setSending: (value: boolean) => void;
  setLoading: (value: boolean) => void;
}

export type ChatSessionStore = ChatSessionStoreState & ChatSessionStoreActions;

const defaultState: ChatSessionStoreState = {
  sessions: [],
  activeSessionId: null,
  activeSession: null,
  selectedModelId: 'deepseek-chat',
  sending: false,
  loading: true,
};

export const createChatSessionStore = (initialState: ChatSessionStoreState = defaultState) => {
  return createStore<ChatSessionStore>()((set) => ({
    ...initialState,
    setSessions: (sessions) => {
      set({ sessions });
    },
    setActiveSessionId: (value) => {
      set({ activeSessionId: value });
    },
    setActiveSession: (value) => {
      set((state) => ({
        activeSession: typeof value === 'function' ? value(state.activeSession) : value,
      }));
    },
    setSelectedModelId: (value) => {
      set({ selectedModelId: value });
    },
    setSending: (value) => {
      set({ sending: value });
    },
    setLoading: (value) => {
      set({ loading: value });
    },
  }));
};

export type ChatSessionStoreApi = ReturnType<typeof createChatSessionStore>;
