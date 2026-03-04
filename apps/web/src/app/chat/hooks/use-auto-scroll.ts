import { useEffect, useRef } from 'react';

export function useAutoScroll(input: {
  activeSessionId: string | null;
  messageCount: number;
  lastMessageContent: string | undefined;
  sending: boolean;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      return;
    }

    element.scrollTo({
      top: element.scrollHeight,
      behavior: 'auto',
    });
  }, [input.activeSessionId, input.lastMessageContent, input.messageCount, input.sending]);

  return {
    scrollContainerRef,
  };
}
