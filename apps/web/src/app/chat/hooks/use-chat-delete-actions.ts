import type { ChatSession, ModelId, SessionSummary } from '@mianshitong/shared';
import { useCallback } from 'react';

interface UseChatDeleteActionsInput {
  activeSessionId: string | null;
  fetchSessionById: (sessionId: string) => Promise<ChatSession>;
  refreshSessions: () => Promise<SessionSummary[]>;
  deleteSessionById: (sessionId: string) => Promise<void>;
  deleteAllSessions: () => Promise<void>;
  readCachedSession: (sessionId: string) => ChatSession | null;
  removeCachedSession: (sessionId: string) => void;
  clearCachedSessions: () => void;
  setInputValue: (value: string) => void;
  setSelectedModelId: (value: ModelId) => void;
  setNotice: (value: string | null) => void;
  setActiveSession: (value: ChatSession | null) => void;
  setActiveSessionId: (value: string | null) => void;
  setEditingMessageId: (value: string | null) => void;
  setEditingValue: (value: string) => void;
  setActiveSessionLoading: (value: boolean) => void;
  replaceSession: (sessionId: string) => void;
  replaceNewChat: () => void;
}

export function useChatDeleteActions(input: UseChatDeleteActionsInput) {
  const {
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
  } = input;

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteSessionById(sessionId);
        removeCachedSession(sessionId);
        const latest = await refreshSessions();

        if (activeSessionId !== sessionId) {
          return;
        }

        if (latest.length === 0) {
          setActiveSession(null);
          setActiveSessionId(null);
          setEditingMessageId(null);
          setEditingValue('');
          replaceNewChat();
          return;
        }

        const cachedNextSession = readCachedSession(latest[0].id);
        if (cachedNextSession) {
          setActiveSession(cachedNextSession);
          setActiveSessionId(cachedNextSession.id);
          setSelectedModelId(cachedNextSession.modelId);
          setEditingMessageId(null);
          setEditingValue('');
          setActiveSessionLoading(false);
          replaceSession(cachedNextSession.id);
          return;
        }

        setActiveSessionLoading(true);
        const nextSession = await fetchSessionById(latest[0].id);
        setActiveSession(nextSession);
        setActiveSessionId(nextSession.id);
        setSelectedModelId(nextSession.modelId);
        setEditingMessageId(null);
        setEditingValue('');
        replaceSession(nextSession.id);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '删除会话失败');
      } finally {
        setActiveSessionLoading(false);
      }
    },
    [
      activeSessionId,
      deleteSessionById,
      fetchSessionById,
      readCachedSession,
      refreshSessions,
      removeCachedSession,
      replaceNewChat,
      replaceSession,
      setActiveSession,
      setActiveSessionId,
      setActiveSessionLoading,
      setEditingMessageId,
      setEditingValue,
      setNotice,
      setSelectedModelId,
    ],
  );

  const handleDeleteAllSessions = useCallback(async () => {
    try {
      await deleteAllSessions();
      clearCachedSessions();
      await refreshSessions();
      setActiveSession(null);
      setActiveSessionId(null);
      setInputValue('');
      setEditingMessageId(null);
      setEditingValue('');
      replaceNewChat();
      setActiveSessionLoading(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '删除所有会话失败');
    }
  }, [
    clearCachedSessions,
    deleteAllSessions,
    refreshSessions,
    replaceNewChat,
    setActiveSession,
    setActiveSessionId,
    setActiveSessionLoading,
    setEditingMessageId,
    setEditingValue,
    setInputValue,
    setNotice,
  ]);

  return { handleDeleteSession, handleDeleteAllSessions };
}
