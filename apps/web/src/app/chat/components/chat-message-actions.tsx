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
import { HoverTooltip } from '@/components/ui/hover-tooltip';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '../hooks/chat-controller-helpers';

interface ChatMessageActionsProps {
  isUserMessage: boolean;
  content: string;
  messageId: string;
  activeFeedback: ChatMessageFeedback | null;
  feedbackPending: boolean;
  onNotice: (content: string) => void;
  onStartEditUserMessage: (messageId: string, content: string) => void;
  onSetMessageFeedback: (messageId: string, feedback: ChatMessageFeedback | null) => Promise<void>;
}

interface CopyMessageButtonProps {
  content: string;
  defaultLabel: string;
  testId: string;
  onNotice: (content: string) => void;
}

const resolveNextFeedback = (
  currentFeedback: ChatMessageFeedback | null,
  targetFeedback: ChatMessageFeedback,
): ChatMessageFeedback | null => (currentFeedback === targetFeedback ? null : targetFeedback);

const feedbackButtonClass = (active: boolean) =>
  cn(
    'transition-transform duration-150 ease-out hover:scale-[1.06] active:scale-95',
    active && 'text-foreground hover:text-foreground disabled:opacity-100',
  );

function CopyMessageButton({ content, defaultLabel, testId, onNotice }: CopyMessageButtonProps) {
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
      onNotice('复制失败，请手动复制。');
    }
  }, [content, onNotice]);

  return (
    <HoverTooltip content={copied ? '已复制' : defaultLabel} side="top" disabled>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        data-testid={testId}
        data-copy-state={copied ? 'copied' : 'idle'}
        aria-label={copied ? '已复制' : defaultLabel}
        onClick={() => void handleCopy()}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
    </HoverTooltip>
  );
}

export function ChatMessageActions({
  isUserMessage,
  content,
  messageId,
  activeFeedback,
  feedbackPending,
  onNotice,
  onStartEditUserMessage,
  onSetMessageFeedback,
}: ChatMessageActionsProps) {
  if (isUserMessage) {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="编辑消息"
          onClick={() => onStartEditUserMessage(messageId, content)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <CopyMessageButton
          content={content}
          defaultLabel="复制"
          testId="user-message-copy"
          onNotice={onNotice}
        />
      </>
    );
  }

  return (
    <>
      <CopyMessageButton
        content={content}
        defaultLabel="复制"
        testId="assistant-message-copy"
        onNotice={onNotice}
      />
      <HoverTooltip content="喜欢" side="top" disabled>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          data-testid="message-upvote"
          aria-label="赞同回复"
          aria-pressed={activeFeedback === 'like'}
          data-icon-variant={activeFeedback === 'like' ? 'fill' : 'line'}
          disabled={feedbackPending}
          className={feedbackButtonClass(activeFeedback === 'like')}
          onClick={() =>
            void onSetMessageFeedback(messageId, resolveNextFeedback(activeFeedback, 'like'))
          }
        >
          <span
            key={activeFeedback === 'like' ? 'upvote-fill' : 'upvote-line'}
            data-testid="message-upvote-icon"
            className="inline-flex animate-in items-center justify-center duration-150 ease-out zoom-in-75"
          >
            {activeFeedback === 'like' ? (
              <ThumbsUpFill className="size-3.5" />
            ) : (
              <ThumbsUp className="size-3.5" />
            )}
          </span>
        </Button>
      </HoverTooltip>
      <HoverTooltip content="不喜欢" side="top" disabled>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          data-testid="message-downvote"
          aria-label="不赞同回复"
          aria-pressed={activeFeedback === 'dislike'}
          data-icon-variant={activeFeedback === 'dislike' ? 'fill' : 'line'}
          disabled={feedbackPending}
          className={feedbackButtonClass(activeFeedback === 'dislike')}
          onClick={() =>
            void onSetMessageFeedback(messageId, resolveNextFeedback(activeFeedback, 'dislike'))
          }
        >
          <span
            key={activeFeedback === 'dislike' ? 'downvote-fill' : 'downvote-line'}
            data-testid="message-downvote-icon"
            className="inline-flex animate-in items-center justify-center duration-150 ease-out zoom-in-75"
          >
            {activeFeedback === 'dislike' ? (
              <ThumbsDownFill className="size-3.5" />
            ) : (
              <ThumbsDown className="size-3.5" />
            )}
          </span>
        </Button>
      </HoverTooltip>
    </>
  );
}
