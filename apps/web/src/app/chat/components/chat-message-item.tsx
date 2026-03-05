import type { ChatMessage } from '@mianshitong/shared';
import { Copy, Pencil, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChatLoadingIndicator } from './chat-loading-indicator';
import { ChatMarkdown } from './chat-markdown';

interface ChatMessageItemProps {
  message: ChatMessage;
  isLoading: boolean;
  onCopy: (content: string) => Promise<void>;
  onEditUserMessage: (content: string) => void;
  onNotice: (content: string) => void;
}

export function ChatMessageItem({
  message,
  isLoading,
  onCopy,
  onEditUserMessage,
  onNotice,
}: ChatMessageItemProps) {
  return (
    <article className="group/message w-full animate-in fade-in duration-200">
      <div
        className={cn(
          'flex w-full items-start gap-2 md:gap-3',
          message.role === 'user' ? 'justify-end' : 'justify-start',
        )}
      >
        {message.role === 'assistant' ? (
          <span className="mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground">
            <Sparkles className="size-3.5" />
          </span>
        ) : null}

        <div
          className={cn(
            'flex flex-col gap-2 md:gap-3',
            message.role === 'user'
              ? 'max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]'
              : 'w-full',
          )}
        >
          <div
            className={cn(
              'flex flex-col gap-2 overflow-hidden text-sm',
              message.role === 'user'
                ? 'w-fit rounded-2xl bg-primary px-3 py-2 text-right text-primary-foreground'
                : 'bg-transparent px-0 py-0 text-left text-foreground',
            )}
          >
            {isLoading ? (
              <ChatLoadingIndicator />
            ) : (
              <ChatMarkdown
                content={message.content}
                className={message.role === 'user' ? 'text-primary-foreground' : 'text-foreground'}
              />
            )}
          </div>

          {!isLoading ? (
            <div
              className={cn(
                'flex items-center gap-1 text-muted-foreground',
                message.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              {message.role === 'user' ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="编辑消息"
                    onClick={() => onEditUserMessage(message.content)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="复制消息"
                    onClick={() => void onCopy(message.content)}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="复制回复"
                    onClick={() => void onCopy(message.content)}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="赞同回复"
                    onClick={() => onNotice('感谢反馈，我们会继续优化回复质量')}
                  >
                    <ThumbsUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="不赞同回复"
                    onClick={() => onNotice('已记录反馈，我们会改进后续回复')}
                  >
                    <ThumbsDown className="size-3.5" />
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
