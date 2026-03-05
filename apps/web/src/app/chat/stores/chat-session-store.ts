import type { ChatSession, ModelId, SessionSummary } from '@mianshitong/shared';
import { createStore } from 'zustand/vanilla';
import type { Updater } from './types';

export interface ChatSessionStoreState {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  selectedModelId: ModelId;
  privateMode: boolean;
  sending: boolean;
  loading: boolean;
}

export interface ChatSessionStoreActions {
  setSessions: (sessions: SessionSummary[]) => void;
  setActiveSessionId: (value: string | null) => void;
  setActiveSession: (value: Updater<ChatSession | null>) => void;
  setSelectedModelId: (value: ModelId) => void;
  setPrivateMode: (value: boolean | ((previous: boolean) => boolean)) => void;
  setSending: (value: boolean) => void;
  setLoading: (value: boolean) => void;
}

export type ChatSessionStore = ChatSessionStoreState & ChatSessionStoreActions;

const defaultState: ChatSessionStoreState = {
  sessions: [],
  activeSessionId: null,
  activeSession: null,
  selectedModelId: 'deepseek-chat',
  privateMode: true,
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
    setPrivateMode: (value) => {
      set((state) => ({
        privateMode: typeof value === 'function' ? value(state.privateMode) : value,
      }));
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
