import type { ChatSession, ModelId, SessionSummary } from '@mianshitong/shared';
import { useCallback } from 'react';
import { closeSidebarOnMobile, copyToClipboard } from './chat-controller-helpers';
import { useChatDeleteActions } from './use-chat-delete-actions';

interface UseChatControllerActionsInput {
  createSession: () => Promise<ChatSession>;
  fetchSessionById: (sessionId: string) => Promise<ChatSession>;
  refreshSessions: () => Promise<SessionSummary[]>;
  deleteSessionById: (sessionId: string) => Promise<void>;
  deleteAllSessions: () => Promise<void>;
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
}

export function useChatControllerActions(input: UseChatControllerActionsInput) {
  const {
    createSession,
    fetchSessionById,
    refreshSessions,
    deleteSessionById,
    deleteAllSessions,
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
  } = input;

  const deleteActions = useChatDeleteActions({
    activeSessionId,
    fetchSessionById,
    refreshSessions,
    deleteSessionById,
    deleteAllSessions,
    setInputValue,
    setSelectedModelId,
    setNotice,
    setActiveSession,
    setActiveSessionId,
    setEditingMessageId,
    setEditingValue,
  });

  const handlePickSession = useCallback(
    async (sessionId: string) => {
      try {
        const session = await fetchSessionById(sessionId);
        setActiveSession(session);
        setActiveSessionId(session.id);
        setSelectedModelId(session.modelId);
        setEditingMessageId(null);
        setEditingValue('');
        closeSidebarOnMobile((open) => setSidebarOpen(open));
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '读取会话失败');
      }
    },
    [
      fetchSessionById,
      setActiveSession,
      setActiveSessionId,
      setSelectedModelId,
      setEditingMessageId,
      setEditingValue,
      setSidebarOpen,
      setNotice,
    ],
  );

  const handleNewChat = useCallback(async () => {
    try {
      await createSession();
      setInputValue('');
      setEditingMessageId(null);
      setEditingValue('');
      closeSidebarOnMobile((open) => setSidebarOpen(open));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '创建会话失败');
    }
  }, [
    createSession,
    setInputValue,
    setEditingMessageId,
    setEditingValue,
    setSidebarOpen,
    setNotice,
  ]);

  const handleQuickPrompt = useCallback(
    async (prompt: string) => {
      setInputValue(prompt);
      await sendMessage(prompt);
    },
    [setInputValue, sendMessage],
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
