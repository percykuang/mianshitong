import { type ChatSession, QUICK_PROMPTS, type SessionSummary } from '@mianshitong/shared';
import { useCallback, useMemo, useState } from 'react';
import { createSessionRequest, fetchSessionById, fetchSessions } from '../lib/chat-api';
import type { ChatController } from './chat-controller.types';
import { useChatControllerActions } from './use-chat-controller-actions';
import { useChatControllerEffects } from './use-chat-controller-effects';
import { useChatControllerStore } from './use-chat-controller-store';
import { useEditMessage } from './use-edit-message';
import { useSendMessage } from './use-send-message';

export function useChatController(): ChatController {
  const {
    sessions,
    activeSessionId,
    activeSession,
    selectedModelId,
    privateMode,
    sending,
    loading,
    setSessions,
    setActiveSessionId,
    setActiveSession,
    setSelectedModelId,
    setPrivateMode,
    setSending,
    setLoading,
  } = useChatControllerStore();

  const [inputValue, setInputValue] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const quickPrompts = useMemo(() => [...QUICK_PROMPTS], []);

  const refreshSessions = useCallback(async (): Promise<SessionSummary[]> => {
    const next = await fetchSessions();
    setSessions(next);
    return next;
  }, [setSessions]);

  const createSession = useCallback(async (): Promise<ChatSession> => {
    const session = await createSessionRequest({
      modelId: selectedModelId,
      isPrivate: privateMode,
    });
    setActiveSession(session);
    setActiveSessionId(session.id);
    await refreshSessions();
    return session;
  }, [selectedModelId, privateMode, setActiveSession, setActiveSessionId, refreshSessions]);

  const ensureSession = useCallback(async (): Promise<ChatSession> => {
    if (activeSession) {
      return activeSession;
    }

    return createSession();
  }, [activeSession, createSession]);

  const sendMessage = useSendMessage({
    sending,
    ensureSession,
    refreshSessions,
    setSending,
    setNotice,
    setInputValue,
    setActiveSession,
    setActiveSessionId,
  });

  const editUserMessage = useEditMessage({
    activeSession,
    sending,
    refreshSessions,
    setSending,
    setNotice,
    setActiveSession,
    setActiveSessionId,
  });

  useChatControllerEffects({
    toast,
    refreshSessions,
    setToast,
    setSidebarOpen,
    setActiveSession,
    setActiveSessionId,
    setSelectedModelId,
    setPrivateMode,
    setNotice,
    setLoading,
    fetchSessionById,
  });

  const actions = useChatControllerActions({
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
  });

  return {
    sessions,
    activeSessionId,
    activeSession,
    inputValue,
    selectedModelId,
    privateMode,
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
    handleQuickPrompt: actions.handleQuickPrompt,
    sendMessage,
    editUserMessage,
    startEditingUserMessage: actions.startEditingUserMessage,
    cancelEditingUserMessage: actions.cancelEditingUserMessage,
    submitEditingUserMessage: actions.submitEditingUserMessage,
    setEditingValue,
    handleCopy: actions.handleCopy,
    showNotice: actions.showNotice,
    togglePrivateMode: actions.togglePrivateMode,
  };
}
