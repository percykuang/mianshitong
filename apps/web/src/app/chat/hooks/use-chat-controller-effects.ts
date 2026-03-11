import type { ChatSession, ModelId, SessionSummary } from '@mianshitong/shared';
import { useEffect } from 'react';
import { getRouteSessionHydrationPlan } from '../lib/chat-route-hydration';
import { hasRouteBootstrapBypass } from '../lib/chat-route-bootstrap-bypass';

interface UseChatControllerEffectsInput {
  ready: boolean;
  notice: string | null;
  toast: string | null;
  routeSessionId: string | null;
  refreshSessions: () => Promise<SessionSummary[]>;
  readActiveSession: () => ChatSession | null;
  readCachedSession: (sessionId: string) => ChatSession | null;
  cacheSession: (session: ChatSession) => void;
  removeCachedSession: (sessionId: string) => void;
  setToast: (value: string | null) => void;
  setSidebarOpen: (value: boolean) => void;
  setActiveSession: (value: ChatSession | null) => void;
  setActiveSessionId: (value: string | null) => void;
  setSelectedModelId: (value: ModelId) => void;
  setNotice: (value: string | null) => void;
  setSessionsLoading: (value: boolean) => void;
  setActiveSessionLoading: (value: boolean) => void;
  fetchSessionById: (sessionId: string) => Promise<ChatSession>;
  replaceNewChat: () => void;
}

export function useChatControllerEffects(input: UseChatControllerEffectsInput): void {
  const {
    ready,
    notice,
    toast,
    routeSessionId,
    refreshSessions,
    readActiveSession,
    readCachedSession,
    cacheSession,
    removeCachedSession,
    setToast,
    setSidebarOpen,
    setActiveSession,
    setActiveSessionId,
    setSelectedModelId,
    setNotice,
    setSessionsLoading,
    setActiveSessionLoading,
    fetchSessionById,
    replaceNewChat,
  } = input;

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast, setToast]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notice, setNotice]);

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
          setNotice(error instanceof Error ? error.message : '初始化失败');
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
  }, [ready, refreshSessions, setNotice, setSessionsLoading]);

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
      setActiveSession(null);
      setActiveSessionId(null);
      return;
    }

    if (cachedSession && plan.shouldApplyCachedSession) {
      setActiveSession(cachedSession);
      setActiveSessionId(cachedSession.id);
      setSelectedModelId(cachedSession.modelId);
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
        setActiveSession(session);
        setActiveSessionId(session.id);
        setSelectedModelId(session.modelId);
      } catch (error) {
        if (cancelled) {
          return;
        }

        removeCachedSession(routeSessionId);
        setActiveSession(null);
        setActiveSessionId(null);
        replaceNewChat();
        setNotice(error instanceof Error ? error.message : '初始化失败');
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
    removeCachedSession,
    fetchSessionById,
    replaceNewChat,
    setActiveSession,
    setActiveSessionId,
    setActiveSessionLoading,
    setNotice,
    setSelectedModelId,
  ]);
}
