import type { ChatSession, ChatUsageSummary, ModelId, SessionSummary } from '@mianshitong/shared';

export type ChatBannerFeedbackTone = 'error' | 'info';

export interface ChatBannerFeedback {
  content: string;
  tone: ChatBannerFeedbackTone;
}

export interface ChatController {
  sessions: SessionSummary[];
  sessionsLoading: boolean;
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  inputValue: string;
  selectedModelId: ModelId;
  sending: boolean;
  activeSessionLoading: boolean;
  chatUsage: ChatUsageSummary | null;
  usageLoading: boolean;
  bannerFeedback: ChatBannerFeedback | null;
  sidebarOpen: boolean;
  editingMessageId: string | null;
  editingValue: string;
  quickPrompts: string[];
  setInputValue: (value: string) => void;
  setSelectedModelId: (value: ModelId) => void;
  setSidebarOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  handlePickSession: (sessionId: string) => Promise<void>;
  handleNewChat: () => Promise<void>;
  handleDeleteSession: (sessionId: string) => Promise<void>;
  handleDeleteAllSessions: () => Promise<void>;
  handleQuickPrompt: (prompt: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  stopMessageGeneration: () => void;
  startEditingUserMessage: (messageId: string, content: string) => void;
  cancelEditingUserMessage: () => void;
  submitEditingUserMessage: () => Promise<'submitted' | 'error'>;
  setEditingValue: (value: string) => void;
  showErrorFeedback: (content: string) => void;
}
