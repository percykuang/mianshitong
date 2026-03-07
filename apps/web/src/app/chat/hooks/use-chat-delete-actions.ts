import type { ChatSession, ModelId, SessionSummary } from '@mianshitong/shared';
import { useCallback } from 'react';

interface UseChatDeleteActionsInput {
  activeSessionId: string | null;
  fetchSessionById: (sessionId: string) => Promise<ChatSession>;
  refreshSessions: () => Promise<SessionSummary[]>;
  deleteSessionById: (sessionId: string) => Promise<void>;
  deleteAllSessions: () => Promise<void>;
  setInputValue: (value: string) => void;
  setSelectedModelId: (value: ModelId) => void;
  setNotice: (value: string | null) => void;
  setActiveSession: (value: ChatSession | null) => void;
  setActiveSessionId: (value: string | null) => void;
  setEditingMessageId: (value: string | null) => void;
  setEditingValue: (value: string) => void;
}

export function useChatDeleteActions(input: UseChatDeleteActionsInput) {
  const {
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
  } = input;

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteSessionById(sessionId);
        const latest = await refreshSessions();

        if (activeSessionId !== sessionId) {
          return;
        }

        if (latest.length === 0) {
          setActiveSession(null);
          setActiveSessionId(null);
          setEditingMessageId(null);
          setEditingValue('');
          return;
        }

        const nextSession = await fetchSessionById(latest[0].id);
        setActiveSession(nextSession);
        setActiveSessionId(nextSession.id);
        setSelectedModelId(nextSession.modelId);
        setEditingMessageId(null);
        setEditingValue('');
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '删除会话失败');
      }
    },
    [
      deleteSessionById,
      refreshSessions,
      activeSessionId,
      fetchSessionById,
      setActiveSession,
      setActiveSessionId,
      setSelectedModelId,
      setEditingMessageId,
      setEditingValue,
      setNotice,
    ],
  );

  const handleDeleteAllSessions = useCallback(async () => {
    try {
      await deleteAllSessions();
      await refreshSessions();
      setActiveSession(null);
      setActiveSessionId(null);
      setInputValue('');
      setEditingMessageId(null);
      setEditingValue('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '删除所有会话失败');
    }
  }, [
    deleteAllSessions,
    refreshSessions,
    setActiveSession,
    setActiveSessionId,
    setInputValue,
    setEditingMessageId,
    setEditingValue,
    setNotice,
  ]);

  return { handleDeleteSession, handleDeleteAllSessions };
}
