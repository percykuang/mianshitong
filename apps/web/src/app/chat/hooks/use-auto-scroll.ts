import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface UseAutoScrollInput {
  activeSessionId: string | null;
  activeSessionLoading: boolean;
  messageCount: number;
  lastMessageContent: string | undefined;
  sending: boolean;
}

const BOTTOM_THRESHOLD_PX = 96;

function isNearBottom(element: HTMLDivElement): boolean {
  return element.scrollHeight - element.clientHeight - element.scrollTop <= BOTTOM_THRESHOLD_PX;
}

function scrollElementToBottom(element: HTMLDivElement) {
  element.scrollTo({
    top: element.scrollHeight,
    behavior: 'auto',
  });
}

export function useAutoScroll(input: UseAutoScrollInput) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousSessionIdRef = useRef<string | null>(null);
  const previousScrollTopRef = useRef(0);
  const previousSendingRef = useRef(input.sending);
  const pinnedToBottomRef = useRef(true);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);

  const syncPinnedState = useCallback((nextValue: boolean) => {
    pinnedToBottomRef.current = nextValue;
    setIsPinnedToBottom((previous) => (previous === nextValue ? previous : nextValue));
  }, []);

  const scrollToBottom = useCallback(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      return;
    }

    syncPinnedState(true);
    scrollElementToBottom(element);
    previousScrollTopRef.current = element.scrollTop;
  }, [syncPinnedState]);

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      return;
    }

    previousScrollTopRef.current = element.scrollTop;
    syncPinnedState(isNearBottom(element));

    const updatePinnedState = () => {
      const currentScrollTop = element.scrollTop;
      const isUserScrollingUp = currentScrollTop < previousScrollTopRef.current - 1;
      previousScrollTopRef.current = currentScrollTop;

      if (input.sending && isUserScrollingUp) {
        syncPinnedState(false);
        return;
      }

      syncPinnedState(isNearBottom(element));
    };

    element.addEventListener('scroll', updatePinnedState, { passive: true });

    return () => {
      element.removeEventListener('scroll', updatePinnedState);
    };
  }, [input.activeSessionId, input.activeSessionLoading, input.sending, syncPinnedState]);

  useLayoutEffect(() => {
    const element = scrollContainerRef.current;
    if (!element || !input.activeSessionId || input.activeSessionLoading) {
      return;
    }

    const isSessionChanged = previousSessionIdRef.current !== input.activeSessionId;
    previousSessionIdRef.current = input.activeSessionId;
    if (!isSessionChanged) {
      return;
    }

    pinnedToBottomRef.current = true;
    scrollElementToBottom(element);
    previousScrollTopRef.current = element.scrollTop;

    let frameId = window.requestAnimationFrame(() => {
      scrollElementToBottom(element);
      previousScrollTopRef.current = element.scrollTop;
      frameId = window.requestAnimationFrame(() => {
        scrollElementToBottom(element);
        previousScrollTopRef.current = element.scrollTop;
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [input.activeSessionId, input.activeSessionLoading]);

  useEffect(() => {
    const element = scrollContainerRef.current;
    const wasSending = previousSendingRef.current;
    previousSendingRef.current = input.sending;

    if (!element || input.activeSessionLoading) {
      return;
    }

    if (input.sending && !wasSending) {
      pinnedToBottomRef.current = true;
      scrollElementToBottom(element);
      previousScrollTopRef.current = element.scrollTop;
    }
  }, [input.activeSessionLoading, input.sending]);

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element || input.activeSessionLoading || !pinnedToBottomRef.current) {
      return;
    }

    scrollElementToBottom(element);
    previousScrollTopRef.current = element.scrollTop;
  }, [
    input.activeSessionId,
    input.activeSessionLoading,
    input.lastMessageContent,
    input.messageCount,
    input.sending,
  ]);

  return {
    scrollContainerRef,
    isPinnedToBottom,
    scrollToBottom,
  };
}
