import { normalizeChatSessionId } from '@/lib/chat-session-id';

export function buildChatPath(sessionId?: string | null) {
  const normalized = normalizeChatSessionId(sessionId);
  return normalized ? `/chat/${normalized}` : '/chat';
}

export function normalizeRouteSessionId(sessionId?: string | null) {
  return normalizeChatSessionId(sessionId);
}

export function getRouteSessionIdFromPathname(pathname?: string | null) {
  if (!pathname) {
    return null;
  }

  const normalizedPathname = pathname.split('?')[0] ?? pathname;
  if (normalizedPathname === '/chat') {
    return null;
  }

  if (!normalizedPathname.startsWith('/chat/')) {
    return null;
  }

  return normalizeRouteSessionId(normalizedPathname.slice('/chat/'.length));
}
