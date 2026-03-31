import type { ChatSession, ModelId, SessionSummary } from '@mianshitong/shared';
import { useCallback, useEffect } from 'react';
import { CHAT_ERROR_COPY } from '../lib/chat-copy';
import { getChatErrorMessage } from '../lib/chat-error-message';
import { getRouteSessionHydrationPlan } from '../lib/chat-route-hydration';
import { hasRouteBootstrapBypass } from '../lib/chat-route-bootstrap-bypass';
import type { ChatBannerFeedback } from './chat-controller.types';

interface UseChatControllerEffectsInput {
  ready: boolean;
  bannerFeedback: ChatBannerFeedback | null;
  routeSessionId: string | null;
  refreshSessions: () => Promise<SessionSummary[]>;
  readActiveSession: () => ChatSession | null;
  readCachedSession: (sessionId: string) => ChatSession | null;
  cacheSession: (session: ChatSession) => void;
  removeCachedSession: (sessionId: string) => void;
  setBannerFeedback: (value: ChatBannerFeedback | null) => void;
  setSidebarOpen: (value: boolean) => void;
  setActiveSession: (value: ChatSession | null) => void;
  setActiveSessionId: (value: string | null) => void;
  setSelectedModelId: (value: ModelId) => void;
  setErrorFeedback: (value: string | null) => void;
  setSessionsLoading: (value: boolean) => void;
  setActiveSessionLoading: (value: boolean) => void;
  fetchSessionById: (sessionId: string) => Promise<ChatSession>;
  replaceNewChat: () => void;
}

export function useChatControllerEffects(input: UseChatControllerEffectsInput): void {
  const {
    ready,
    bannerFeedback,
    routeSessionId,
    refreshSessions,
    readActiveSession,
    readCachedSession,
    cacheSession,
    removeCachedSession,
    setBannerFeedback,
    setSidebarOpen,
    setActiveSession,
    setActiveSessionId,
    setSelectedModelId,
    setErrorFeedback,
    setSessionsLoading,
    setActiveSessionLoading,
    fetchSessionById,
    replaceNewChat,
  } = input;

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

  useEffect(() => {
    if (!bannerFeedback) {
      return;
    }

    const timer = window.setTimeout(() => {
      setBannerFeedback(null);
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [bannerFeedback, setBannerFeedback]);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [setSidebarOpen]);

  useEffect(() => {
    if (!ready) {
      setSessionsLoading(true);
      return;
    }

    let cancelled = false;

    const loadSessions = async () => {
      setSessionsLoading(true);

      try {
        await refreshSessions();
      } catch (error) {
        if (!cancelled) {
          setErrorFeedback(getChatErrorMessage(error, CHAT_ERROR_COPY.initFailed));
        }
      } finally {
        if (!cancelled) {
          setSessionsLoading(false);
        }
      }
    };

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, [ready, refreshSessions, setErrorFeedback, setSessionsLoading]);

  useEffect(() => {
    const activeSession = readActiveSession();
    const cachedSession = routeSessionId ? readCachedSession(routeSessionId) : null;
    const plan = getRouteSessionHydrationPlan({
      ready,
      routeSessionId,
      routeSessionAlreadyHydrated: activeSession?.id === routeSessionId,
      hasCachedSession: Boolean(cachedSession),
      pendingRouteTransition: routeSessionId ? hasRouteBootstrapBypass(routeSessionId) : false,
    });

    setActiveSessionLoading(plan.shouldSetLoading);

    if (plan.shouldResetSession) {
      clearActiveSessionSelection();
      return;
    }

    if (cachedSession && plan.shouldApplyCachedSession) {
      applyActiveSessionSelection(cachedSession);
    }

    if (!routeSessionId || !plan.shouldLoadRemote) {
      return;
    }

    let cancelled = false;

    const loadSession = async () => {
      try {
        const session = await fetchSessionById(routeSessionId);
        if (cancelled) {
          return;
        }

        cacheSession(session);
        applyActiveSessionSelection(session);
      } catch (error) {
        if (cancelled) {
          return;
        }

        removeCachedSession(routeSessionId);
        clearActiveSessionSelection();
        replaceNewChat();
        setErrorFeedback(getChatErrorMessage(error, CHAT_ERROR_COPY.initFailed));
      } finally {
        if (!cancelled) {
          setActiveSessionLoading(false);
        }
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    routeSessionId,
    readActiveSession,
    readCachedSession,
    cacheSession,
    clearActiveSessionSelection,
    removeCachedSession,
    fetchSessionById,
    replaceNewChat,
    applyActiveSessionSelection,
    setErrorFeedback,
    setActiveSessionLoading,
  ]);
}
