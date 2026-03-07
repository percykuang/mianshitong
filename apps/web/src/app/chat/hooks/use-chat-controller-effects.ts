import type { ChatSession, ModelId, SessionSummary } from '@mianshitong/shared';
import { useEffect } from 'react';

interface UseChatControllerEffectsInput {
  ready: boolean;
  toast: string | null;
  refreshSessions: () => Promise<SessionSummary[]>;
  setToast: (value: string | null) => void;
  setSidebarOpen: (value: boolean) => void;
  setActiveSession: (value: ChatSession | null) => void;
  setActiveSessionId: (value: string | null) => void;
  setSelectedModelId: (value: ModelId) => void;
  setNotice: (value: string | null) => void;
  setLoading: (value: boolean) => void;
  fetchSessionById: (sessionId: string) => Promise<ChatSession>;
}

export function useChatControllerEffects(input: UseChatControllerEffectsInput): void {
  const {
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
    fetchSessionById,
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
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [setSidebarOpen]);

  useEffect(() => {
    if (!ready) {
      setLoading(true);
      return;
    }

    const bootstrap = async () => {
      try {
        const latest = await refreshSessions();
        if (latest.length === 0) {
          setActiveSession(null);
          setActiveSessionId(null);
          return;
        }

        const session = await fetchSessionById(latest[0].id);
        setActiveSession(session);
        setActiveSessionId(session.id);
        setSelectedModelId(session.modelId);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '初始化失败');
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [
    ready,
    refreshSessions,
    fetchSessionById,
    setActiveSession,
    setActiveSessionId,
    setSelectedModelId,
    setNotice,
    setLoading,
  ]);
}
