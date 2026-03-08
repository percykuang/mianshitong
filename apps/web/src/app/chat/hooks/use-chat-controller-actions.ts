import type { ChatSession, ModelId, SessionSummary } from '@mianshitong/shared';
import { useCallback } from 'react';
import { closeSidebarOnMobile, copyToClipboard } from './chat-controller-helpers';
import { useChatDeleteActions } from './use-chat-delete-actions';

interface UseChatControllerActionsInput {
  fetchSessionById: (sessionId: string) => Promise<ChatSession>;
  refreshSessions: () => Promise<SessionSummary[]>;
  deleteSessionById: (sessionId: string) => Promise<void>;
  deleteAllSessions: () => Promise<void>;
  readCachedSession: (sessionId: string) => ChatSession | null;
  removeCachedSession: (sessionId: string) => void;
  clearCachedSessions: () => void;
  sendMessage: (content: string) => Promise<void>;
  editUserMessage: (messageId: string, content: string) => Promise<boolean>;
  activeSessionId: string | null;
  editingMessageId: string | null;
  editingValue: string;
  setInputValue: (value: string) => void;
  setSelectedModelId: (value: ModelId) => void;
  setNotice: (value: string | null) => void;
  setToast: (value: string | null) => void;
  setSidebarOpen: (value: boolean | ((previous: boolean) => boolean)) => void;
  setActiveSession: (value: ChatSession | null) => void;
  setActiveSessionId: (value: string | null) => void;
  setEditingMessageId: (value: string | null) => void;
  setEditingValue: (value: string) => void;
  setActiveSessionLoading: (value: boolean) => void;
  pushSession: (sessionId: string) => void;
  pushNewChat: () => void;
  replaceSession: (sessionId: string) => void;
  replaceNewChat: () => void;
}

export function useChatControllerActions(input: UseChatControllerActionsInput) {
  const {
    fetchSessionById,
    refreshSessions,
    deleteSessionById,
    deleteAllSessions,
    readCachedSession,
    removeCachedSession,
    clearCachedSessions,
    sendMessage,
    editUserMessage,
    activeSessionId,
    editingMessageId,
    editingValue,
    setInputValue,
    setSelectedModelId,
    setNotice,
    setToast,
    setSidebarOpen,
    setActiveSession,
    setActiveSessionId,
    setEditingMessageId,
    setEditingValue,
    setActiveSessionLoading,
    pushSession,
    pushNewChat,
    replaceSession,
    replaceNewChat,
  } = input;

  const deleteActions = useChatDeleteActions({
    activeSessionId,
    fetchSessionById,
    refreshSessions,
    deleteSessionById,
    deleteAllSessions,
    readCachedSession,
    removeCachedSession,
    clearCachedSessions,
    setInputValue,
    setSelectedModelId,
    setNotice,
    setActiveSession,
    setActiveSessionId,
    setEditingMessageId,
    setEditingValue,
    setActiveSessionLoading,
    replaceSession,
    replaceNewChat,
  });

  const handlePickSession = useCallback(
    async (sessionId: string) => {
      const cachedSession = readCachedSession(sessionId);
      setActiveSessionId(sessionId);
      setEditingMessageId(null);
      setEditingValue('');

      if (cachedSession) {
        setActiveSession(cachedSession);
        setSelectedModelId(cachedSession.modelId);
        setActiveSessionLoading(false);
      } else {
        setActiveSessionLoading(true);
      }

      pushSession(sessionId);
      closeSidebarOnMobile((open) => setSidebarOpen(open));
    },
    [
      readCachedSession,
      setActiveSession,
      setActiveSessionId,
      setActiveSessionLoading,
      setEditingMessageId,
      setEditingValue,
      setSelectedModelId,
      pushSession,
      setSidebarOpen,
    ],
  );

  const handleNewChat = useCallback(async () => {
    setActiveSession(null);
    setActiveSessionId(null);
    setActiveSessionLoading(false);
    setInputValue('');
    setEditingMessageId(null);
    setEditingValue('');
    pushNewChat();
    closeSidebarOnMobile((open) => setSidebarOpen(open));
  }, [
    setActiveSession,
    setActiveSessionId,
    setActiveSessionLoading,
    setInputValue,
    setEditingMessageId,
    setEditingValue,
    pushNewChat,
    setSidebarOpen,
  ]);

  const handleQuickPrompt = useCallback(
    async (prompt: string) => {
      await sendMessage(prompt);
    },
    [sendMessage],
  );

  const handleCopy = useCallback(
    async (content: string) => {
      try {
        await copyToClipboard(content);
        setToast('Copied to clipboard!');
      } catch {
        setToast('Copy failed. Please copy manually.');
      }
    },
    [setToast],
  );

  const showNotice = useCallback(
    (content: string) => {
      setNotice(content);
    },
    [setNotice],
  );

  const startEditingUserMessage = useCallback(
    (messageId: string, content: string) => {
      setEditingMessageId(messageId);
      setEditingValue(content);
    },
    [setEditingMessageId, setEditingValue],
  );

  const cancelEditingUserMessage = useCallback(() => {
    setEditingMessageId(null);
    setEditingValue('');
  }, [setEditingMessageId, setEditingValue]);

  const submitEditingUserMessage = useCallback(async (): Promise<boolean> => {
    if (!editingMessageId) {
      return false;
    }

    const success = await editUserMessage(editingMessageId, editingValue);
    if (!success) {
      return false;
    }

    setEditingMessageId(null);
    setEditingValue('');
    return true;
  }, [editingMessageId, editingValue, editUserMessage, setEditingMessageId, setEditingValue]);

  return {
    handlePickSession,
    handleNewChat,
    handleDeleteSession: deleteActions.handleDeleteSession,
    handleDeleteAllSessions: deleteActions.handleDeleteAllSessions,
    handleQuickPrompt,
    handleCopy,
    showNotice,
    startEditingUserMessage,
    cancelEditingUserMessage,
    submitEditingUserMessage,
  };
}
