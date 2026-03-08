const LEGACY_SESSION_PREFIX = 'session_';

export function createChatSessionId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export function isLegacyChatSessionId(sessionId?: string | null): sessionId is string {
  return Boolean(sessionId?.startsWith(LEGACY_SESSION_PREFIX));
}

export function normalizeChatSessionId(sessionId?: string | null): string | null {
  const value = sessionId?.trim();
  if (!value) {
    return null;
  }

  if (!isLegacyChatSessionId(value)) {
    return value;
  }

  const normalized = value.slice(LEGACY_SESSION_PREFIX.length).replace(/_/g, '');
  return normalized || value;
}
