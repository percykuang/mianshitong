import { type ChatSession, QUICK_PROMPTS, type SessionSummary } from '@mianshitong/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createChatSessionId } from '@/lib/chat-session-id';
import { createDraftChatSession } from '../lib/chat-session-draft';
import { restoreSessionSnapshotRequest } from '../lib/chat-api';
import { getEditableUserMessageIndex, isEditableUserMessage } from '../lib/chat-message-mutations';
import { syncResolvedRemoteSession } from '../lib/chat-remote-session-sync';
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
    chatUsage,
    usageLoading,
    usageError,
    refreshChatUsage,
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
  const [restorableEditSnapshots, setRestorableEditSnapshots] = useState<
    Record<string, ChatSession>
  >({});
  const [restoringOriginalReply, setRestoringOriginalReply] = useState(false);
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
    const session = createDraftChatSession(selectedModelId, createChatSessionId());
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
    refreshChatUsage,
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

      await remoteSendMessage(content);
    },
    [sending, remoteSendMessage, setToast],
  );

  const stopMessageGeneration = useCallback(() => {
    abortCurrentStream();
    setSending(false);
  }, [setSending]);

  const showToast = useCallback((content: string) => {
    setToast(content);
  }, []);

  const remoteEditMessage = useEditMessage({
    activeSession,
    readActiveSession,
    sending,
    refreshSessions,
    refreshChatUsage,
    registerAbortController: registerStreamAbortController,
    clearAbortController: clearStreamAbortController,
    setSending,
    setNotice,
    setActiveSession: updateActiveSession,
    setActiveSessionId,
  });

  const editUserMessage = useCallback(
    async (messageId: string, content: string): Promise<boolean> => {
      const session = readActiveSession();
      if (!session || !isEditableUserMessage(session.messages, messageId)) {
        setNotice('当前仅支持编辑最后一条用户消息');
        return false;
      }

      const result = await remoteEditMessage(messageId, content);
      return result !== 'error';
    },
    [readActiveSession, remoteEditMessage, setNotice],
  );

  const startEditingUserMessage = useCallback(
    (messageId: string, content: string) => {
      const session = readActiveSession();
      if (!session || !isEditableUserMessage(session.messages, messageId)) {
        setNotice('当前仅支持编辑最后一条用户消息');
        return;
      }

      setEditingMessageId(messageId);
      setEditingValue(content);
    },
    [readActiveSession, setEditingMessageId, setEditingValue, setNotice],
  );

  const submitEditingUserMessage = useCallback(async (): Promise<boolean> => {
    if (!editingMessageId) {
      return false;
    }

    const trimmed = editingValue.trim();
    if (!trimmed) {
      setNotice('编辑内容不能为空');
      return false;
    }

    const session = readActiveSession();
    if (!session) {
      return false;
    }

    const targetIndex = getEditableUserMessageIndex(session.messages, editingMessageId);
    if (targetIndex < 0) {
      setNotice('目标消息不存在或不可编辑');
      return false;
    }

    const targetMessage = session.messages[targetIndex];
    if (!targetMessage) {
      setNotice('目标消息不存在或不可编辑');
      return false;
    }

    if (!isEditableUserMessage(session.messages, editingMessageId)) {
      setNotice('当前仅支持编辑最后一条用户消息');
      setEditingMessageId(null);
      setEditingValue('');
      return false;
    }

    const hasMeaningfulChange = targetMessage.content.trim() !== trimmed;
    setEditingMessageId(null);
    setEditingValue('');

    if (!hasMeaningfulChange) {
      return true;
    }

    setRestorableEditSnapshots((previous) => ({
      ...previous,
      [session.id]: session,
    }));

    const result = await remoteEditMessage(editingMessageId, trimmed);
    if (result !== 'interrupted') {
      setRestorableEditSnapshots((previous) => {
        const next = { ...previous };
        delete next[session.id];
        return next;
      });
    }

    return result !== 'error';
  }, [editingMessageId, editingValue, readActiveSession, remoteEditMessage, setNotice]);

  const restoreOriginalReply = useCallback(async (): Promise<void> => {
    const session = readActiveSession();
    if (!session || restoringOriginalReply) {
      return;
    }

    const snapshot = restorableEditSnapshots[session.id];
    if (!snapshot) {
      return;
    }

    setRestoringOriginalReply(true);
    setNotice(null);
    updateActiveSession(snapshot);

    try {
      const restoredSession = await restoreSessionSnapshotRequest(snapshot);
      await syncResolvedRemoteSession({
        session: restoredSession,
        refreshSessions,
        setActiveSession: updateActiveSession,
        setActiveSessionId,
        replaceSession,
      });
      setRestorableEditSnapshots((previous) => {
        const next = { ...previous };
        delete next[session.id];
        return next;
      });
    } catch (error) {
      updateActiveSession(session);
      setNotice(error instanceof Error ? error.message : '恢复原回复失败，请稍后重试');
    } finally {
      setRestoringOriginalReply(false);
    }
  }, [
    readActiveSession,
    restoringOriginalReply,
    restorableEditSnapshots,
    setNotice,
    updateActiveSession,
    refreshSessions,
    setActiveSessionId,
    replaceSession,
  ]);

  const cancelEditingUserMessage = useCallback(() => {
    setEditingMessageId(null);
    setEditingValue('');
  }, [setEditingMessageId, setEditingValue]);

  useEffect(() => {
    if (usageError) {
      const timer = window.setTimeout(() => {
        setNotice(usageError);
      }, 0);

      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [usageError, setNotice]);

  useChatControllerEffects({
    ready,
    notice,
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
    activeSessionId,
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

  const lastMessage = activeSession?.messages.at(-1) ?? null;
  const canRestoreOriginalReply =
    !!activeSession &&
    !!restorableEditSnapshots[activeSession.id] &&
    lastMessage?.role === 'assistant' &&
    lastMessage.completionStatus === 'interrupted';

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
    chatUsage,
    usageLoading,
    notice,
    toast,
    sidebarOpen,
    editingMessageId,
    editingValue,
    canRestoreOriginalReply,
    restoringOriginalReply,
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
    startEditingUserMessage,
    cancelEditingUserMessage,
    submitEditingUserMessage,
    restoreOriginalReply,
    setEditingValue,
    handleCopy: actions.handleCopy,
    showNotice: actions.showNotice,
    showToast,
  };
}
