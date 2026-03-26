import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface UseAutoScrollInput {
  activeSessionId: string | null;
  activeSessionLoading: boolean;
  messageCount: number;
  lastMessageContent: string | undefined;
  sending: boolean;
}

const BOTTOM_THRESHOLD_PX = 96;

function isViewportScrollTarget(element: HTMLElement) {
  return (
    element === document.scrollingElement ||
    element === document.documentElement ||
    element === document.body
  );
}

function resolveScrollElement(container: HTMLDivElement | null): HTMLElement | null {
  if (container) {
    const overflowY = window.getComputedStyle(container).overflowY;
    const isContainerScrollable =
      (overflowY === 'auto' || overflowY === 'scroll') &&
      container.scrollHeight > container.clientHeight + 1;

    if (isContainerScrollable) {
      return container;
    }
  }

  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null;
}

function getScrollTop(element: HTMLElement) {
  return isViewportScrollTarget(element) ? window.scrollY : element.scrollTop;
}

function isNearBottom(element: HTMLElement): boolean {
  const scrollTop = getScrollTop(element);
  return element.scrollHeight - element.clientHeight - scrollTop <= BOTTOM_THRESHOLD_PX;
}

function scrollElementToBottom(element: HTMLElement) {
  if (isViewportScrollTarget(element)) {
    window.scrollTo({
      top: element.scrollHeight,
      behavior: 'auto',
    });
    return;
  }

  element.scrollTo({ top: element.scrollHeight, behavior: 'auto' });
}

export function useAutoScroll(input: UseAutoScrollInput) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousSessionIdRef = useRef<string | null>(null);
  const previousScrollTopRef = useRef(0);
  const previousSendingRef = useRef(input.sending);
  const pendingSessionScrollRef = useRef<string | null>(null);
  const scrollBurstFrameIdsRef = useRef<number[]>([]);
  const scrollBurstTimeoutIdsRef = useRef<number[]>([]);
  const pinnedToBottomRef = useRef(true);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);

  const syncPinnedState = useCallback((nextValue: boolean) => {
    pinnedToBottomRef.current = nextValue;
    setIsPinnedToBottom((previous) => (previous === nextValue ? previous : nextValue));
  }, []);

  const clearScheduledScrollBurst = useCallback(() => {
    for (const frameId of scrollBurstFrameIdsRef.current) {
      window.cancelAnimationFrame(frameId);
    }
    scrollBurstFrameIdsRef.current = [];

    for (const timeoutId of scrollBurstTimeoutIdsRef.current) {
      window.clearTimeout(timeoutId);
    }
    scrollBurstTimeoutIdsRef.current = [];
  }, []);

  const performScrollToBottom = useCallback(() => {
    const element = resolveScrollElement(scrollContainerRef.current);
    if (!element) {
      return;
    }

    scrollElementToBottom(element);
    previousScrollTopRef.current = getScrollTop(element);
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
    syncPinnedState(true);
    performScrollToBottom();
  }, [performScrollToBottom, syncPinnedState]);

  useEffect(() => {
    return () => {
      clearScheduledScrollBurst();
    };
  }, [clearScheduledScrollBurst]);

  useEffect(() => {
    const element = resolveScrollElement(scrollContainerRef.current);
    if (!element) {
      return;
    }

    previousScrollTopRef.current = getScrollTop(element);
    syncPinnedState(isNearBottom(element));

    const updatePinnedState = () => {
      const currentScrollTop = getScrollTop(element);
      const isUserScrollingUp = currentScrollTop < previousScrollTopRef.current - 1;
      previousScrollTopRef.current = currentScrollTop;

      if (input.sending && isUserScrollingUp) {
        syncPinnedState(false);
        return;
      }

      syncPinnedState(isNearBottom(element));
    };

    const scrollEventTarget: HTMLElement | Window = isViewportScrollTarget(element)
      ? window
      : element;
    scrollEventTarget.addEventListener('scroll', updatePinnedState, { passive: true });

    return () => {
      scrollEventTarget.removeEventListener('scroll', updatePinnedState);
    };
  }, [input.activeSessionId, input.activeSessionLoading, input.sending, syncPinnedState]);

  useLayoutEffect(() => {
    if (!input.activeSessionId) {
      previousSessionIdRef.current = null;
      pendingSessionScrollRef.current = null;
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

    pendingSessionScrollRef.current = null;
    pinnedToBottomRef.current = true;
    const frameId = window.requestAnimationFrame(() => {
      scheduleSessionScrollBurst();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [input.activeSessionId, input.activeSessionLoading, scheduleSessionScrollBurst]);

  useEffect(() => {
    const wasSending = previousSendingRef.current;
    previousSendingRef.current = input.sending;

    if (input.activeSessionLoading) {
      return;
    }

    if (input.sending && !wasSending) {
      pinnedToBottomRef.current = true;
      performScrollToBottom();
    }
  }, [input.activeSessionLoading, input.sending, performScrollToBottom]);

  useEffect(() => {
    if (input.activeSessionLoading || !pinnedToBottomRef.current) {
      return;
    }

    performScrollToBottom();
  }, [
    input.activeSessionId,
    input.activeSessionLoading,
    input.lastMessageContent,
    input.messageCount,
    input.sending,
    performScrollToBottom,
  ]);

  return {
    scrollContainerRef,
    isPinnedToBottom,
    scrollToBottom,
  };
}
