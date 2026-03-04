import {
  type ChatSession,
  type ModelId,
  QUICK_PROMPTS,
  type SessionSummary,
} from '@mianshitong/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createSessionRequest, fetchSessionById, fetchSessions } from '../lib/chat-api';
import type { ChatController } from './chat-controller.types';
import { useSendMessage } from './use-send-message';

function closeSidebarOnMobile(setSidebarOpen: (open: boolean) => void): void {
  if (window.innerWidth < 768) {
    setSidebarOpen(false);
  }
}

export function useChatController(): ChatController {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [selectedModelId, setSelectedModelId] = useState<ModelId>('deepseek-chat');
  const [privateMode, setPrivateMode] = useState(true);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const quickPrompts = useMemo(() => [...QUICK_PROMPTS], []);

  const refreshSessions = useCallback(async (): Promise<SessionSummary[]> => {
    const next = await fetchSessions();
    setSessions(next);
    return next;
  }, []);

  const createSession = useCallback(async (): Promise<ChatSession> => {
    const session = await createSessionRequest({
      modelId: selectedModelId,
      isPrivate: privateMode,
    });
    setActiveSession(session);
    setActiveSessionId(session.id);
    await refreshSessions();
    return session;
  }, [privateMode, refreshSessions, selectedModelId]);

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

  const handlePickSession = useCallback(async (sessionId: string) => {
    try {
      const session = await fetchSessionById(sessionId);
      setActiveSession(session);
      setActiveSessionId(session.id);
      setSelectedModelId(session.modelId);
      setPrivateMode(session.isPrivate);
      closeSidebarOnMobile(setSidebarOpen);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '读取会话失败');
    }
  }, []);

  const handleNewChat = useCallback(async () => {
    try {
      await createSession();
      setInputValue('');
      closeSidebarOnMobile(setSidebarOpen);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '创建会话失败');
    }
  }, [createSession]);

  const handleQuickPrompt = useCallback(
    async (prompt: string) => {
      setInputValue(prompt);
      await sendMessage(prompt);
    },
    [sendMessage],
  );

  const handleCopy = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setNotice('已复制到剪贴板');
    } catch {
      setNotice('复制失败，请手动复制');
    }
  }, []);

  const showNotice = useCallback((content: string) => {
    setNotice(content);
  }, []);

  const togglePrivateMode = useCallback(() => {
    setPrivateMode((previous) => !previous);
  }, []);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const latest = await refreshSessions();
        if (latest.length === 0) {
          return;
        }

        const session = await fetchSessionById(latest[0].id);
        setActiveSession(session);
        setActiveSessionId(session.id);
        setSelectedModelId(session.modelId);
        setPrivateMode(session.isPrivate);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '初始化失败');
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [refreshSessions]);

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
    sidebarOpen,
    quickPrompts,
    setInputValue,
    setSelectedModelId,
    setSidebarOpen,
    togglePrivateMode,
    handlePickSession,
    handleNewChat,
    handleQuickPrompt,
    sendMessage,
    handleCopy,
    showNotice,
  };
}
