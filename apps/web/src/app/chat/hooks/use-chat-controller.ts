import { type ChatSession, QUICK_PROMPTS, type SessionSummary } from '@mianshitong/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createChatSessionId } from '@/lib/chat-session-id';
import { createDraftLocalSession } from '../lib/chat-local-session';
import { markRouteBootstrapBypass } from '../lib/chat-route-bootstrap-bypass';
import {
  abortCurrentStream,
  clearStreamAbortController,
  registerStreamAbortController,
} from '../lib/chat-stream-controller';
import {
  cacheSession,
  clearCachedSessions,
  readCachedSession,
  removeCachedSession,
} from '../stores/chat-session-cache-store';
import type { ChatController } from './chat-controller.types';
import { useChatControllerActions } from './use-chat-controller-actions';
import { useChatControllerEffects } from './use-chat-controller-effects';
import { useChatControllerStore } from './use-chat-controller-store';
import { useChatNavigation } from './use-chat-navigation';
import { useChatStorage } from './use-chat-storage';
import { useEditMessage } from './use-edit-message';
import { useLocalEditMessage } from './use-local-edit-message';
import { useLocalSendMessage } from './use-local-send-message';
import { useSendMessage } from './use-send-message';

export function useChatController(): ChatController {
  const {
    sessions,
    sessionsLoading,
    activeSessionId,
    activeSession,
    selectedModelId,
    sending,
    activeSessionLoading,
    setSessions,
    setSessionsLoading,
    setActiveSessionId,
    setActiveSession,
    setSelectedModelId,
    setSending,
    setActiveSessionLoading,
  } = useChatControllerStore();
  const {
    routeSessionId: currentRouteSessionId,
    pushSession,
    replaceSession,
    pushNewChat,
    replaceNewChat,
  } = useChatNavigation();
  const {
    ready,
    isAuthenticated,
    fetchSessionList,
    fetchSessionDetail,
    deleteSessionById,
    deleteAllSessions,
  } = useChatStorage();
  const [inputValue, setInputValue] = useState('');
  const inputValueRef = useRef(inputValue);
  const activeSessionRef = useRef(activeSession);
  const forceCreateNextSessionRef = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const quickPrompts = [...QUICK_PROMPTS];

  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const updateActiveSession = useCallback(
    (value: ChatSession | null | ((prev: ChatSession | null) => ChatSession | null)) => {
      setActiveSession((previous) => {
        const next = typeof value === 'function' ? value(previous) : value;
        activeSessionRef.current = next;
        if (next) {
          cacheSession(next);
        }
        return next;
      });
    },
    [setActiveSession],
  );

  const readActiveSession = useCallback(() => activeSessionRef.current, []);

  const refreshSessions = useCallback(async (): Promise<SessionSummary[]> => {
    const next = await fetchSessionList();
    setSessions(next);
    return next;
  }, [fetchSessionList, setSessions]);

  const createOptimisticSession = useCallback((): ChatSession => {
    const session = createDraftLocalSession(selectedModelId, createChatSessionId());
    forceCreateNextSessionRef.current = false;
    updateActiveSession(session);
    setActiveSessionId(session.id);
    markRouteBootstrapBypass(session.id);
    replaceSession(session.id);
    return session;
  }, [selectedModelId, updateActiveSession, setActiveSessionId, replaceSession]);

  const remoteSendMessage = useSendMessage({
    sending,
    readActiveSession: () => (forceCreateNextSessionRef.current ? null : readActiveSession()),
    createOptimisticSession,
    refreshSessions,
    setSending,
    setNotice,
    setInputValue,
    readInputValue: () => inputValueRef.current,
    registerAbortController: registerStreamAbortController,
    clearAbortController: clearStreamAbortController,
    setActiveSession: updateActiveSession,
    setActiveSessionId,
    replaceSession,
  });
  const localSendMessage = useLocalSendMessage({
    sending,
    readActiveSession: () => (forceCreateNextSessionRef.current ? null : readActiveSession()),
    createOptimisticSession,
    refreshSessions,
    setSending,
    setNotice,
    setInputValue,
    readInputValue: () => inputValueRef.current,
    registerAbortController: registerStreamAbortController,
    clearAbortController: clearStreamAbortController,
    setActiveSession: updateActiveSession,
    setActiveSessionId,
    replaceSession,
  });

  const sendMessage = useCallback(
    async (content: string) => {
      if (sending) {
        if (content.trim()) {
          setToast('AI 回复生成中，请先停止当前回复');
        }
        return;
      }

      if (isAuthenticated) {
        await remoteSendMessage(content);
        return;
      }

      await localSendMessage(content);
    },
    [sending, isAuthenticated, remoteSendMessage, localSendMessage, setToast],
  );

  const stopMessageGeneration = useCallback(() => {
    abortCurrentStream();
    setSending(false);
  }, [setSending]);

  const remoteEditMessage = useEditMessage({
    activeSession,
    sending,
    refreshSessions,
    setSending,
    setNotice,
    setActiveSession: updateActiveSession,
    setActiveSessionId,
  });
  const localEditMessage = useLocalEditMessage({
    activeSession,
    sending,
    refreshSessions,
    setSending,
    setNotice,
    setActiveSession: updateActiveSession,
    setActiveSessionId,
  });

  const editUserMessage = useCallback(
    async (messageId: string, content: string): Promise<boolean> => {
      return isAuthenticated
        ? remoteEditMessage(messageId, content)
        : localEditMessage(messageId, content);
    },
    [isAuthenticated, remoteEditMessage, localEditMessage],
  );

  useChatControllerEffects({
    ready,
    toast,
    routeSessionId: currentRouteSessionId,
    refreshSessions,
    readActiveSession,
    readCachedSession,
    cacheSession,
    removeCachedSession,
    setToast,
    setSidebarOpen,
    setActiveSession: updateActiveSession,
    setActiveSessionId,
    setSelectedModelId,
    setNotice,
    setSessionsLoading,
    setActiveSessionLoading,
    fetchSessionById: fetchSessionDetail,
    replaceNewChat,
  });

  const actions = useChatControllerActions({
    fetchSessionById: fetchSessionDetail,
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
    setActiveSession: updateActiveSession,
    setActiveSessionId,
    setEditingMessageId,
    setEditingValue,
    setActiveSessionLoading,
    pushSession,
    pushNewChat,
    replaceSession,
    replaceNewChat,
  });

  const handlePickSession = useCallback(
    async (sessionId: string) => {
      forceCreateNextSessionRef.current = false;
      await actions.handlePickSession(sessionId);
    },
    [actions],
  );

  const handleNewChat = useCallback(async () => {
    forceCreateNextSessionRef.current = true;
    await actions.handleNewChat();
  }, [actions]);

  return {
    sessions,
    sessionsLoading,
    activeSessionId,
    activeSession,
    inputValue,
    selectedModelId,
    sending,
    activeSessionLoading,
    notice,
    toast,
    sidebarOpen,
    editingMessageId,
    editingValue,
    quickPrompts,
    setInputValue,
    setSelectedModelId,
    setSidebarOpen,
    handlePickSession,
    handleNewChat,
    handleDeleteSession: actions.handleDeleteSession,
    handleDeleteAllSessions: actions.handleDeleteAllSessions,
    handleQuickPrompt: actions.handleQuickPrompt,
    sendMessage,
    stopMessageGeneration,
    editUserMessage,
    startEditingUserMessage: actions.startEditingUserMessage,
    cancelEditingUserMessage: actions.cancelEditingUserMessage,
    submitEditingUserMessage: actions.submitEditingUserMessage,
    setEditingValue,
    handleCopy: actions.handleCopy,
    showNotice: actions.showNotice,
  };
}
