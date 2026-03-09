export interface RouteSessionHydrationPlanInput {
  ready: boolean;
  routeSessionId: string | null;
  routeSessionAlreadyHydrated: boolean;
  hasCachedSession: boolean;
  pendingRouteTransition: boolean;
}

export interface RouteSessionHydrationPlan {
  shouldResetSession: boolean;
  shouldApplyCachedSession: boolean;
  shouldSetLoading: boolean;
  shouldLoadRemote: boolean;
}

export function getRouteSessionHydrationPlan(
  input: RouteSessionHydrationPlanInput,
): RouteSessionHydrationPlan {
  if (!input.ready) {
    return {
      shouldResetSession: false,
      shouldApplyCachedSession: false,
      shouldSetLoading: Boolean(input.routeSessionId),
      shouldLoadRemote: false,
    };
  }

  if (!input.routeSessionId) {
    return {
      shouldResetSession: true,
      shouldApplyCachedSession: false,
      shouldSetLoading: false,
      shouldLoadRemote: false,
    };
  }

  const shouldApplyCachedSession = input.hasCachedSession;
  const shouldSetLoading = !input.hasCachedSession && !input.routeSessionAlreadyHydrated;
  const shouldSkipRemoteLoad =
    input.pendingRouteTransition && (input.hasCachedSession || input.routeSessionAlreadyHydrated);

  return {
    shouldResetSession: false,
    shouldApplyCachedSession,
    shouldSetLoading,
    shouldLoadRemote: !shouldSkipRemoteLoad,
  };
}
