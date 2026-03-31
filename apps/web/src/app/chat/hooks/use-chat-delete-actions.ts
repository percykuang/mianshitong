import type { ChatSession, ModelId, SessionSummary } from '@mianshitong/shared';
import { useCallback } from 'react';
import { CHAT_ERROR_COPY } from '../lib/chat-copy';
import { getChatErrorMessage } from '../lib/chat-error-message';
import { getDeleteSessionTransitionPlan } from '../lib/chat-delete-transition';

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
  setErrorFeedback: (value: string | null) => void;
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
    setErrorFeedback,
    setActiveSession,
    setActiveSessionId,
    setEditingMessageId,
    setEditingValue,
    setActiveSessionLoading,
    replaceSession,
    replaceNewChat,
  } = input;

  const resetEditorState = useCallback(() => {
    setEditingMessageId(null);
    setEditingValue('');
  }, [setEditingMessageId, setEditingValue]);

  const applyActiveSessionSelection = useCallback(
    (session: ChatSession) => {
      setActiveSession(session);
      setActiveSessionId(session.id);
      setSelectedModelId(session.modelId);
    },
    [setActiveSession, setActiveSessionId, setSelectedModelId],
  );

  const clearActiveSessionSelection = useCallback(() => {
    setActiveSession(null);
    setActiveSessionId(null);
  }, [setActiveSession, setActiveSessionId]);

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteSessionById(sessionId);
        removeCachedSession(sessionId);
        const latest = await refreshSessions();
        const nextSessionId = latest[0]?.id ?? null;
        const cachedNextSession = nextSessionId ? readCachedSession(nextSessionId) : null;
        const transition = getDeleteSessionTransitionPlan({
          activeSessionId,
          deletedSessionId: sessionId,
          nextSessionId,
          hasCachedNextSession: Boolean(cachedNextSession),
        });

        if (transition.kind === 'noop') {
          return;
        }

        if (transition.kind === 'reset') {
          clearActiveSessionSelection();
          resetEditorState();
          replaceNewChat();
          return;
        }

        if (transition.kind === 'use-cached' && cachedNextSession) {
          applyActiveSessionSelection(cachedNextSession);
          resetEditorState();
          setActiveSessionLoading(false);
          replaceSession(cachedNextSession.id);
          return;
        }

        setActiveSessionLoading(true);
        const nextSession = await fetchSessionById(transition.sessionId);
        applyActiveSessionSelection(nextSession);
        resetEditorState();
        replaceSession(nextSession.id);
      } catch (error) {
        setErrorFeedback(getChatErrorMessage(error, CHAT_ERROR_COPY.deleteSessionFailed));
      } finally {
        setActiveSessionLoading(false);
      }
    },
    [
      activeSessionId,
      applyActiveSessionSelection,
      clearActiveSessionSelection,
      deleteSessionById,
      fetchSessionById,
      readCachedSession,
      refreshSessions,
      removeCachedSession,
      replaceNewChat,
      replaceSession,
      resetEditorState,
      setActiveSessionLoading,
      setErrorFeedback,
    ],
  );

  const handleDeleteAllSessions = useCallback(async () => {
    try {
      await deleteAllSessions();
      clearCachedSessions();
      await refreshSessions();
      clearActiveSessionSelection();
      setInputValue('');
      resetEditorState();
      replaceNewChat();
      setActiveSessionLoading(false);
    } catch (error) {
      setErrorFeedback(getChatErrorMessage(error, CHAT_ERROR_COPY.deleteAllSessionsFailed));
    }
  }, [
    clearCachedSessions,
    clearActiveSessionSelection,
    deleteAllSessions,
    refreshSessions,
    replaceNewChat,
    resetEditorState,
    setActiveSessionLoading,
    setInputValue,
    setErrorFeedback,
  ]);

  return { handleDeleteSession, handleDeleteAllSessions };
}
