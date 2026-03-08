import type { ChatSession, ModelId } from '@mianshitong/shared';
import { createStore } from 'zustand/vanilla';
import type { Updater } from './types';

export interface ChatActiveSessionStoreState {
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  selectedModelId: ModelId;
  sending: boolean;
  activeSessionLoading: boolean;
}

export interface ChatActiveSessionStoreActions {
  setActiveSessionId: (value: string | null) => void;
  setActiveSession: (value: Updater<ChatSession | null>) => void;
  setSelectedModelId: (value: ModelId) => void;
  setSending: (value: boolean) => void;
  setActiveSessionLoading: (value: boolean) => void;
}

export type ChatActiveSessionStore = ChatActiveSessionStoreState & ChatActiveSessionStoreActions;

const defaultState: ChatActiveSessionStoreState = {
  activeSessionId: null,
  activeSession: null,
  selectedModelId: 'deepseek-chat',
  sending: false,
  activeSessionLoading: true,
};

export const createChatActiveSessionStore = (
  initialState: ChatActiveSessionStoreState = defaultState,
) => {
  return createStore<ChatActiveSessionStore>()((set) => ({
    ...initialState,
    setActiveSessionId: (activeSessionId) => {
      set({ activeSessionId });
    },
    setActiveSession: (value) => {
      set((state) => ({
        activeSession: typeof value === 'function' ? value(state.activeSession) : value,
      }));
    },
    setSelectedModelId: (selectedModelId) => {
      set({ selectedModelId });
    },
    setSending: (sending) => {
      set({ sending });
    },
    setActiveSessionLoading: (activeSessionLoading) => {
      set({ activeSessionLoading });
    },
  }));
};

export const chatActiveSessionStore = createChatActiveSessionStore();
