import type { RefObject } from 'react';

export function shouldRequestFollowBeforeSend(sending: boolean, content: string): boolean {
  return !sending && Boolean(content.trim());
}

export function requestFollowAndFocusComposer(input: {
  requestFollow: () => void;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
}): void {
  input.requestFollow();

  window.requestAnimationFrame(() => {
    input.composerInputRef.current?.focus();
  });
}
