import { type ChatSession, QUICK_PROMPTS, type SessionSummary } from '@mianshitong/shared';
import { useCallback, useMemo, useState } from 'react';
import type { ChatController } from './chat-controller.types';
import { useChatControllerActions } from './use-chat-controller-actions';
import { useChatControllerEffects } from './use-chat-controller-effects';
import { useChatControllerStore } from './use-chat-controller-store';
import { useChatStorage } from './use-chat-storage';
import { useEditMessage } from './use-edit-message';
import { useLocalEditMessage } from './use-local-edit-message';
import { useLocalSendMessage } from './use-local-send-message';
import { useSendMessage } from './use-send-message';
export function useChatController(): ChatController {
  const {
    sessions,
    activeSessionId,
    activeSession,
    selectedModelId,
    sending,
    loading,
    setSessions,
    setActiveSessionId,
    setActiveSession,
    setSelectedModelId,
    setSending,
    setLoading,
  } = useChatControllerStore();
  const {
    ready,
    isAuthenticated,
    fetchSessionList,
    fetchSessionDetail,
    createSession: createPersistedSession,
    deleteSessionById,
    deleteAllSessions,
  } = useChatStorage();
  const [inputValue, setInputValue] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const quickPrompts = useMemo(() => [...QUICK_PROMPTS], []);

  const refreshSessions = useCallback(async (): Promise<SessionSummary[]> => {
    const next = await fetchSessionList();
    setSessions(next);
    return next;
  }, [fetchSessionList, setSessions]);
  const createSession = useCallback(async (): Promise<ChatSession> => {
    const session = await createPersistedSession(selectedModelId);
    setActiveSession(session);
    setActiveSessionId(session.id);
    await refreshSessions();
    return session;
  }, [
    createPersistedSession,
    selectedModelId,
    setActiveSession,
    setActiveSessionId,
    refreshSessions,
  ]);
  const ensureSession = useCallback(async (): Promise<ChatSession> => {
    if (activeSession) {
      return activeSession;
    }

    return createSession();
  }, [activeSession, createSession]);
  const remoteSendMessage = useSendMessage({
    sending,
    ensureSession,
    refreshSessions,
    setSending,
    setNotice,
    setInputValue,
    setActiveSession,
    setActiveSessionId,
  });
  const localSendMessage = useLocalSendMessage({
    sending,
    ensureSession,
    refreshSessions,
    setSending,
    setNotice,
    setInputValue,
    setActiveSession,
    setActiveSessionId,
  });
  const sendMessage = useCallback(
    async (content: string) => {
      if (isAuthenticated) {
        await remoteSendMessage(content);
        return;
      }

      await localSendMessage(content);
    },
    [isAuthenticated, remoteSendMessage, localSendMessage],
  );
  const remoteEditMessage = useEditMessage({
    activeSession,
    sending,
    refreshSessions,
    setSending,
    setNotice,
    setActiveSession,
    setActiveSessionId,
  });
  const localEditMessage = useLocalEditMessage({
    activeSession,
    sending,
    refreshSessions,
    setSending,
    setNotice,
    setActiveSession,
    setActiveSessionId,
  });
  const editUserMessage = useCallback(
    async (messageId: string, content: string): Promise<boolean> => {
      if (isAuthenticated) {
        return remoteEditMessage(messageId, content);
      }

      return localEditMessage(messageId, content);
    },
    [isAuthenticated, remoteEditMessage, localEditMessage],
  );
  useChatControllerEffects({
    ready,
    toast,
    refreshSessions,
    setToast,
    setSidebarOpen,
    setActiveSession,
    setActiveSessionId,
    setSelectedModelId,
    setNotice,
    setLoading,
    fetchSessionById: fetchSessionDetail,
  });
  const actions = useChatControllerActions({
    createSession,
    fetchSessionById: fetchSessionDetail,
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
  });
  return {
    sessions,
    activeSessionId,
    activeSession,
    inputValue,
    selectedModelId,
    sending,
    loading,
    notice,
    toast,
    sidebarOpen,
    editingMessageId,
    editingValue,
    quickPrompts,
    setInputValue,
    setSelectedModelId,
    setSidebarOpen,
    handlePickSession: actions.handlePickSession,
    handleNewChat: actions.handleNewChat,
    handleDeleteSession: actions.handleDeleteSession,
    handleDeleteAllSessions: actions.handleDeleteAllSessions,
    handleQuickPrompt: actions.handleQuickPrompt,
    sendMessage,
    editUserMessage,
    startEditingUserMessage: actions.startEditingUserMessage,
    cancelEditingUserMessage: actions.cancelEditingUserMessage,
    submitEditingUserMessage: actions.submitEditingUserMessage,
    setEditingValue,
    handleCopy: actions.handleCopy,
    showNotice: actions.showNotice,
  };
}
