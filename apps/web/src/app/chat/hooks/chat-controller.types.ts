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
  toast: string | null;
  sidebarOpen: boolean;
  editingMessageId: string | null;
  editingValue: string;
  quickPrompts: string[];
  setInputValue: (value: string) => void;
  setSelectedModelId: (value: ModelId) => void;
  setSidebarOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  togglePrivateMode: () => void;
  handlePickSession: (sessionId: string) => Promise<void>;
  handleNewChat: () => Promise<void>;
  handleQuickPrompt: (prompt: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  editUserMessage: (messageId: string, content: string) => Promise<boolean>;
  startEditingUserMessage: (messageId: string, content: string) => void;
  cancelEditingUserMessage: () => void;
  submitEditingUserMessage: () => Promise<boolean>;
  setEditingValue: (value: string) => void;
  handleCopy: (content: string) => Promise<void>;
  showNotice: (content: string) => void;
}
