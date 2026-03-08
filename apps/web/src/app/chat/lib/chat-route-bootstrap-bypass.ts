const pendingBypassSessionIds = new Set<string>();

export function markRouteBootstrapBypass(sessionId: string): void {
  pendingBypassSessionIds.add(sessionId);
}

export function hasRouteBootstrapBypass(sessionId: string): boolean {
  return pendingBypassSessionIds.has(sessionId);
}

export function clearRouteBootstrapBypass(sessionId: string): void {
  pendingBypassSessionIds.delete(sessionId);
}
