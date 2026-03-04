import type { ChatSession, ModelId, SessionSummary } from '@mianshitong/shared';

export interface ChatController {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  inputValue: string;
  selectedModelId: ModelId;
  privateMode: boolean;
  sending: boolean;
  loading: boolean;
  notice: string | null;
  sidebarOpen: boolean;
  quickPrompts: string[];
  setInputValue: (value: string) => void;
  setSelectedModelId: (value: ModelId) => void;
  setSidebarOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  togglePrivateMode: () => void;
  handlePickSession: (sessionId: string) => Promise<void>;
  handleNewChat: () => Promise<void>;
  handleQuickPrompt: (prompt: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  handleCopy: (content: string) => Promise<void>;
  showNotice: (content: string) => void;
}
