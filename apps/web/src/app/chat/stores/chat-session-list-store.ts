import type { SessionSummary } from '@mianshitong/shared';
import { createStore } from 'zustand/vanilla';

export interface ChatSessionListStoreState {
  sessions: SessionSummary[];
  sessionsLoading: boolean;
}

export interface ChatSessionListStoreActions {
  setSessions: (sessions: SessionSummary[]) => void;
  setSessionsLoading: (value: boolean) => void;
}

export type ChatSessionListStore = ChatSessionListStoreState & ChatSessionListStoreActions;

const defaultState: ChatSessionListStoreState = {
  sessions: [],
  sessionsLoading: true,
};

export const createChatSessionListStore = (
  initialState: ChatSessionListStoreState = defaultState,
) => {
  return createStore<ChatSessionListStore>()((set) => ({
    ...initialState,
    setSessions: (sessions) => {
      set({ sessions });
    },
    setSessionsLoading: (sessionsLoading) => {
      set({ sessionsLoading });
    },
  }));
};

export const chatSessionListStore = createChatSessionListStore();
