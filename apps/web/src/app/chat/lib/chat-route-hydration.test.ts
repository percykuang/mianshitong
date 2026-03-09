import { describe, expect, it } from 'vitest';
import { getRouteSessionHydrationPlan } from './chat-route-hydration';

describe('getRouteSessionHydrationPlan', () => {
  it('未 ready 且有路由 session 时只保留 loading', () => {
    expect(
      getRouteSessionHydrationPlan({
        ready: false,
        routeSessionId: 'session_1',
        routeSessionAlreadyHydrated: false,
        hasCachedSession: false,
        pendingRouteTransition: false,
      }),
    ).toEqual({
      shouldResetSession: false,
      shouldApplyCachedSession: false,
      shouldSetLoading: true,
      shouldLoadRemote: false,
    });
  });

  it('无路由 session 时会重置当前会话', () => {
    expect(
      getRouteSessionHydrationPlan({
        ready: true,
        routeSessionId: null,
        routeSessionAlreadyHydrated: false,
        hasCachedSession: false,
        pendingRouteTransition: false,
      }),
    ).toEqual({
      shouldResetSession: true,
      shouldApplyCachedSession: false,
      shouldSetLoading: false,
      shouldLoadRemote: false,
    });
  });

  it('有缓存时优先使用缓存，并在非 bypass 情况下继续远端加载', () => {
    expect(
      getRouteSessionHydrationPlan({
        ready: true,
        routeSessionId: 'session_1',
        routeSessionAlreadyHydrated: false,
        hasCachedSession: true,
        pendingRouteTransition: false,
      }),
    ).toEqual({
      shouldResetSession: false,
      shouldApplyCachedSession: true,
      shouldSetLoading: false,
      shouldLoadRemote: true,
    });
  });

  it('pending bypass 且已有缓存或已 hydration 时会跳过远端加载', () => {
    expect(
      getRouteSessionHydrationPlan({
        ready: true,
        routeSessionId: 'session_1',
        routeSessionAlreadyHydrated: false,
        hasCachedSession: true,
        pendingRouteTransition: true,
      }),
    ).toEqual({
      shouldResetSession: false,
      shouldApplyCachedSession: true,
      shouldSetLoading: false,
      shouldLoadRemote: false,
    });

    expect(
      getRouteSessionHydrationPlan({
        ready: true,
        routeSessionId: 'session_1',
        routeSessionAlreadyHydrated: true,
        hasCachedSession: false,
        pendingRouteTransition: true,
      }),
    ).toEqual({
      shouldResetSession: false,
      shouldApplyCachedSession: false,
      shouldSetLoading: false,
      shouldLoadRemote: false,
    });
  });

  it('无缓存且未 hydration 时会显示 loading 并加载远端', () => {
    expect(
      getRouteSessionHydrationPlan({
        ready: true,
        routeSessionId: 'session_1',
        routeSessionAlreadyHydrated: false,
        hasCachedSession: false,
        pendingRouteTransition: false,
      }),
    ).toEqual({
      shouldResetSession: false,
      shouldApplyCachedSession: false,
      shouldSetLoading: true,
      shouldLoadRemote: true,
    });
  });
});
