import type { ChatSession, ModelId } from '@mianshitong/shared';
import { useCallback } from 'react';
import { fetchSessionById } from '../lib/chat-api';
import { closeSidebarOnMobile, copyToClipboard } from './chat-controller-helpers';

interface UseChatControllerActionsInput {
  createSession: () => Promise<ChatSession>;
  sendMessage: (content: string) => Promise<void>;
  editUserMessage: (messageId: string, content: string) => Promise<boolean>;
  editingMessageId: string | null;
  editingValue: string;
  setInputValue: (value: string) => void;
  setSelectedModelId: (value: ModelId) => void;
  setPrivateMode: (value: boolean | ((previous: boolean) => boolean)) => void;
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
    sendMessage,
    editUserMessage,
    editingMessageId,
    editingValue,
    setInputValue,
    setSelectedModelId,
    setPrivateMode,
    setNotice,
    setToast,
    setSidebarOpen,
    setActiveSession,
    setActiveSessionId,
    setEditingMessageId,
    setEditingValue,
  } = input;

  const handlePickSession = useCallback(
    async (sessionId: string) => {
      try {
        const session = await fetchSessionById(sessionId);
        setActiveSession(session);
        setActiveSessionId(session.id);
        setSelectedModelId(session.modelId);
        setPrivateMode(session.isPrivate);
        setEditingMessageId(null);
        setEditingValue('');
        closeSidebarOnMobile((open) => setSidebarOpen(open));
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '读取会话失败');
      }
    },
    [
      setActiveSession,
      setActiveSessionId,
      setSelectedModelId,
      setPrivateMode,
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

  const togglePrivateMode = useCallback(() => {
    setPrivateMode((previous) => !previous);
  }, [setPrivateMode]);

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
    handleQuickPrompt,
    handleCopy,
    showNotice,
    togglePrivateMode,
    startEditingUserMessage,
    cancelEditingUserMessage,
    submitEditingUserMessage,
  };
}
