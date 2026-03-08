'use client';

import { usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { buildChatPath, getRouteSessionIdFromPathname } from '../lib/chat-route';

export function useChatNavigation() {
  const pathname = usePathname();
  const currentRouteSessionId = getRouteSessionIdFromPathname(pathname);

  const navigate = useCallback(
    (sessionId: string | null, mode: 'push' | 'replace') => {
      const href = buildChatPath(sessionId);
      if (pathname === href) {
        return;
      }

      if (mode === 'push') {
        window.history.pushState(null, '', href);
        return;
      }

      window.history.replaceState(null, '', href);
    },
    [pathname],
  );

  const pushSession = useCallback(
    (sessionId: string) => {
      navigate(sessionId, 'push');
    },
    [navigate],
  );

  const replaceSession = useCallback(
    (sessionId: string) => {
      navigate(sessionId, 'replace');
    },
    [navigate],
  );

  const pushNewChat = useCallback(() => {
    navigate(null, 'push');
  }, [navigate]);

  const replaceNewChat = useCallback(() => {
    navigate(null, 'replace');
  }, [navigate]);

  return {
    routeSessionId: currentRouteSessionId,
    pushSession,
    replaceSession,
    pushNewChat,
    replaceNewChat,
  };
}
