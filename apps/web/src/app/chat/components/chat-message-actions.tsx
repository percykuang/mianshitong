import type { ChatMessageFeedback } from '@mianshitong/shared';
import {
  Check,
  Copy,
  Pencil,
  ThumbsDown,
  ThumbsDownFill,
  ThumbsUp,
  ThumbsUpFill,
} from '@/components/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '../hooks/chat-controller-helpers';
import { CHAT_FEEDBACK_COPY, CHAT_MESSAGE_ACTIONS_COPY } from '../lib/chat-copy';

interface ChatMessageActionsProps {
  isUserMessage: boolean;
  canEditUserMessage?: boolean;
  content: string;
  messageId: string;
  activeMessageFeedback: ChatMessageFeedback | null;
  messageFeedbackPending: boolean;
  onErrorFeedback: (content: string) => void;
  onStartEditUserMessage: (messageId: string, content: string) => void;
  onSubmitMessageFeedback: (
    messageId: string,
    feedback: ChatMessageFeedback | null,
  ) => Promise<void>;
}

interface CopyMessageButtonProps {
  content: string;
  defaultLabel: string;
  testId: string;
  onErrorFeedback: (content: string) => void;
}

const resolveNextMessageFeedback = (
  currentMessageFeedback: ChatMessageFeedback | null,
  targetMessageFeedback: ChatMessageFeedback,
): ChatMessageFeedback | null =>
  currentMessageFeedback === targetMessageFeedback ? null : targetMessageFeedback;

const messageFeedbackButtonClass = (active: boolean) =>
  cn(
    'transition-transform duration-150 ease-out hover:scale-[1.06] active:scale-95',
    active && 'text-foreground hover:text-foreground disabled:opacity-100',
  );

function CopyMessageButton({
  content,
  defaultLabel,
  testId,
  onErrorFeedback,
}: CopyMessageButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await copyToClipboard(content);
      setCopied(true);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, 1500);
    } catch {
      onErrorFeedback(CHAT_FEEDBACK_COPY.clipboardFailure);
    }
  }, [content, onErrorFeedback]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      data-testid={testId}
      data-copy-state={copied ? 'copied' : 'idle'}
      aria-label={defaultLabel}
      onClick={() => void handleCopy()}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

export function ChatMessageActions({
  isUserMessage,
  canEditUserMessage = true,
  content,
  messageId,
  activeMessageFeedback,
  messageFeedbackPending,
  onErrorFeedback,
  onStartEditUserMessage,
  onSubmitMessageFeedback,
}: ChatMessageActionsProps) {
  if (isUserMessage) {
    return (
      <>
        {canEditUserMessage ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={CHAT_MESSAGE_ACTIONS_COPY.editMessage}
            onClick={() => onStartEditUserMessage(messageId, content)}
          >
            <Pencil className="size-3.5" />
          </Button>
        ) : null}
        <CopyMessageButton
          content={content}
          defaultLabel={CHAT_MESSAGE_ACTIONS_COPY.copy}
          testId="user-message-copy"
          onErrorFeedback={onErrorFeedback}
        />
      </>
    );
  }

  return (
    <>
      <CopyMessageButton
        content={content}
        defaultLabel={CHAT_MESSAGE_ACTIONS_COPY.copy}
        testId="assistant-message-copy"
        onErrorFeedback={onErrorFeedback}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        data-testid="message-upvote"
        aria-label={CHAT_MESSAGE_ACTIONS_COPY.upvoteReply}
        aria-pressed={activeMessageFeedback === 'like'}
        data-icon-variant={activeMessageFeedback === 'like' ? 'fill' : 'line'}
        disabled={messageFeedbackPending}
        className={messageFeedbackButtonClass(activeMessageFeedback === 'like')}
        onClick={() =>
          void onSubmitMessageFeedback(
            messageId,
            resolveNextMessageFeedback(activeMessageFeedback, 'like'),
          )
        }
      >
        <span
          key={activeMessageFeedback === 'like' ? 'upvote-fill' : 'upvote-line'}
          data-testid="message-upvote-icon"
          className="inline-flex animate-in items-center justify-center duration-150 ease-out zoom-in-75"
        >
          {activeMessageFeedback === 'like' ? (
            <ThumbsUpFill className="size-3.5" />
          ) : (
            <ThumbsUp className="size-3.5" />
          )}
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        data-testid="message-downvote"
        aria-label={CHAT_MESSAGE_ACTIONS_COPY.downvoteReply}
        aria-pressed={activeMessageFeedback === 'dislike'}
        data-icon-variant={activeMessageFeedback === 'dislike' ? 'fill' : 'line'}
        disabled={messageFeedbackPending}
        className={messageFeedbackButtonClass(activeMessageFeedback === 'dislike')}
        onClick={() =>
          void onSubmitMessageFeedback(
            messageId,
            resolveNextMessageFeedback(activeMessageFeedback, 'dislike'),
          )
        }
      >
        <span
          key={activeMessageFeedback === 'dislike' ? 'downvote-fill' : 'downvote-line'}
          data-testid="message-downvote-icon"
          className="inline-flex animate-in items-center justify-center duration-150 ease-out zoom-in-75"
        >
          {activeMessageFeedback === 'dislike' ? (
            <ThumbsDownFill className="size-3.5" />
          ) : (
            <ThumbsDown className="size-3.5" />
          )}
        </span>
      </Button>
    </>
  );
}
