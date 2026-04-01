import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface UseAutoScrollInput {
  activeSessionId: string | null;
  activeSessionLoading: boolean;
  messageCount: number;
  lastMessageContent: string | undefined;
  sending: boolean;
  followRequestKey: number;
}

const BOTTOM_THRESHOLD_PX = 96;

function isNearBottom(element: HTMLElement): boolean {
  return element.scrollHeight - element.clientHeight - element.scrollTop <= BOTTOM_THRESHOLD_PX;
}

function scrollElementToBottom(element: HTMLElement) {
  element.scrollTo({ top: element.scrollHeight, behavior: 'auto' });
}

export function useAutoScroll(input: UseAutoScrollInput) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousSessionIdRef = useRef<string | null>(null);
  const previousFollowRequestKeyRef = useRef(input.followRequestKey);
  const previousScrollTopRef = useRef(0);
  const previousSendingRef = useRef(input.sending);
  const pendingSessionScrollRef = useRef<string | null>(null);
  const pendingFollowRequestFrameIdRef = useRef<number | null>(null);
  const scrollBurstFrameIdsRef = useRef<number[]>([]);
  const scrollBurstTimeoutIdsRef = useRef<number[]>([]);
  const followLockRef = useRef(false);
  const pinnedToBottomRef = useRef(true);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);

  const syncPinnedState = useCallback((nextValue: boolean) => {
    pinnedToBottomRef.current = nextValue;
    setIsPinnedToBottom((previous) => (previous === nextValue ? previous : nextValue));
  }, []);

  const setPinnedRef = useCallback((nextValue: boolean) => {
    pinnedToBottomRef.current = nextValue;
  }, []);

  const clearScheduledScrollBurst = useCallback(() => {
    if (pendingFollowRequestFrameIdRef.current != null) {
      window.cancelAnimationFrame(pendingFollowRequestFrameIdRef.current);
      pendingFollowRequestFrameIdRef.current = null;
    }

    for (const frameId of scrollBurstFrameIdsRef.current) {
      window.cancelAnimationFrame(frameId);
    }
    scrollBurstFrameIdsRef.current = [];

    for (const timeoutId of scrollBurstTimeoutIdsRef.current) {
      window.clearTimeout(timeoutId);
    }
    scrollBurstTimeoutIdsRef.current = [];
  }, []);

  const stopFollowing = useCallback(() => {
    followLockRef.current = false;
    clearScheduledScrollBurst();
    syncPinnedState(false);
  }, [clearScheduledScrollBurst, syncPinnedState]);

  const performScrollToBottom = useCallback(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      return;
    }

    scrollElementToBottom(element);
    previousScrollTopRef.current = element.scrollTop;
  }, []);

  const scheduleSessionScrollBurst = useCallback(() => {
    clearScheduledScrollBurst();
    syncPinnedState(true);

    const run = () => {
      performScrollToBottom();
    };

    run();

    const firstFrameId = window.requestAnimationFrame(() => {
      run();

      const secondFrameId = window.requestAnimationFrame(() => {
        run();
      });
      scrollBurstFrameIdsRef.current.push(secondFrameId);
    });
    scrollBurstFrameIdsRef.current.push(firstFrameId);

    for (const delay of [80, 180]) {
      const timeoutId = window.setTimeout(() => {
        run();
      }, delay);
      scrollBurstTimeoutIdsRef.current.push(timeoutId);
    }
  }, [clearScheduledScrollBurst, performScrollToBottom, syncPinnedState]);

  const scrollToBottom = useCallback(() => {
    followLockRef.current = true;
    clearScheduledScrollBurst();
    syncPinnedState(true);
    performScrollToBottom();
  }, [clearScheduledScrollBurst, performScrollToBottom, syncPinnedState]);

  useEffect(() => {
    return () => {
      clearScheduledScrollBurst();
    };
  }, [clearScheduledScrollBurst]);

  useLayoutEffect(() => {
    const isNewFollowRequest = previousFollowRequestKeyRef.current !== input.followRequestKey;
    previousFollowRequestKeyRef.current = input.followRequestKey;
    if (!isNewFollowRequest) {
      return;
    }

    followLockRef.current = true;
    clearScheduledScrollBurst();
    pinnedToBottomRef.current = true;
    const frameId = window.requestAnimationFrame(() => {
      pendingFollowRequestFrameIdRef.current = null;
      syncPinnedState(true);
      performScrollToBottom();
    });
    pendingFollowRequestFrameIdRef.current = frameId;

    return () => {
      window.cancelAnimationFrame(frameId);
      if (pendingFollowRequestFrameIdRef.current === frameId) {
        pendingFollowRequestFrameIdRef.current = null;
      }
    };
  }, [clearScheduledScrollBurst, input.followRequestKey, performScrollToBottom, syncPinnedState]);

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      return;
    }

    previousScrollTopRef.current = element.scrollTop;
    setPinnedRef(followLockRef.current ? true : isNearBottom(element));

    const updatePinnedState = () => {
      const currentScrollTop = element.scrollTop;
      const isUserScrollingUp = currentScrollTop < previousScrollTopRef.current - 1;
      previousScrollTopRef.current = currentScrollTop;

      if (input.sending && isUserScrollingUp) {
        stopFollowing();
        return;
      }

      if (followLockRef.current) {
        syncPinnedState(true);
        return;
      }

      syncPinnedState(isNearBottom(element));
    };

    element.addEventListener('scroll', updatePinnedState, { passive: true });

    return () => {
      element.removeEventListener('scroll', updatePinnedState);
    };
  }, [
    input.activeSessionId,
    input.activeSessionLoading,
    input.sending,
    setPinnedRef,
    stopFollowing,
    syncPinnedState,
  ]);

  useLayoutEffect(() => {
    if (!input.activeSessionId) {
      previousSessionIdRef.current = null;
      pendingSessionScrollRef.current = null;
      followLockRef.current = false;
      clearScheduledScrollBurst();
      return;
    }

    const isSessionChanged = previousSessionIdRef.current !== input.activeSessionId;
    previousSessionIdRef.current = input.activeSessionId;
    if (!isSessionChanged) {
      return;
    }

    pinnedToBottomRef.current = true;
    pendingSessionScrollRef.current = input.activeSessionId;
  }, [clearScheduledScrollBurst, input.activeSessionId]);

  useLayoutEffect(() => {
    if (!input.activeSessionId || input.activeSessionLoading) {
      return;
    }

    if (pendingSessionScrollRef.current !== input.activeSessionId) {
      return;
    }

    if (input.sending) {
      return;
    }

    pendingSessionScrollRef.current = null;
    const frameId = window.requestAnimationFrame(() => {
      scheduleSessionScrollBurst();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    input.activeSessionId,
    input.activeSessionLoading,
    input.sending,
    scheduleSessionScrollBurst,
  ]);

  useEffect(() => {
    const wasSending = previousSendingRef.current;
    previousSendingRef.current = input.sending;
    const shouldFollow = pinnedToBottomRef.current || followLockRef.current;

    if (input.activeSessionLoading) {
      return;
    }

    if (input.sending && pendingSessionScrollRef.current === input.activeSessionId) {
      pendingSessionScrollRef.current = null;
      clearScheduledScrollBurst();
    }

    if (input.sending && !wasSending && shouldFollow) {
      setPinnedRef(true);
      performScrollToBottom();
      return;
    }

    if (!input.sending && wasSending) {
      if (shouldFollow) {
        setPinnedRef(true);
        performScrollToBottom();
      }
      followLockRef.current = false;
    }
  }, [
    clearScheduledScrollBurst,
    input.activeSessionId,
    input.activeSessionLoading,
    input.sending,
    performScrollToBottom,
    setPinnedRef,
  ]);

  useEffect(() => {
    const shouldFollow = pinnedToBottomRef.current || followLockRef.current;
    if (input.activeSessionLoading || !shouldFollow) {
      return;
    }

    setPinnedRef(true);
    performScrollToBottom();
  }, [
    input.activeSessionId,
    input.activeSessionLoading,
    input.lastMessageContent,
    input.messageCount,
    input.sending,
    performScrollToBottom,
    setPinnedRef,
  ]);

  return {
    scrollContainerRef,
    isPinnedToBottom,
    scrollToBottom,
  };
}
