import type { ChatMessage } from '@mianshitong/shared';
import { Copy, Pencil, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ChatLoadingIndicator } from './chat-loading-indicator';
import { ChatMarkdown } from './chat-markdown';

interface ChatMessageItemProps {
  message: ChatMessage;
  isLoading: boolean;
  isEditing: boolean;
  editingValue: string;
  sending: boolean;
  onCopy: (content: string) => Promise<void>;
  onStartEditUserMessage: (messageId: string, content: string) => void;
  onEditingValueChange: (value: string) => void;
  onCancelEditUserMessage: () => void;
  onSubmitEditUserMessage: () => Promise<void>;
  onNotice: (content: string) => void;
}

export function ChatMessageItem({
  message,
  isLoading,
  isEditing,
  editingValue,
  sending,
  onCopy,
  onStartEditUserMessage,
  onEditingValueChange,
  onCancelEditUserMessage,
  onSubmitEditUserMessage,
  onNotice,
}: ChatMessageItemProps) {
  const isEditableUserMessage = message.role === 'user' && !isLoading;

  return (
    <article className="group/message w-full animate-in duration-200 fade-in">
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
              ? isEditing
                ? 'ml-auto w-full max-w-xl'
                : 'max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]'
              : 'w-full',
          )}
        >
          <div
            className={cn(
              'flex flex-col gap-2 overflow-hidden text-sm',
              message.role === 'user' && !isEditing
                ? 'w-fit rounded-2xl bg-blue-600 px-3 py-2 text-right text-white dark:text-[#fff]'
                : message.role === 'user'
                  ? 'w-full max-w-xl rounded-2xl border border-border bg-background p-2 text-left text-foreground'
                  : 'bg-transparent px-0 py-0 text-left text-foreground',
            )}
          >
            {isLoading ? (
              <ChatLoadingIndicator />
            ) : isEditing ? (
              <div className="flex flex-col gap-2">
                <Textarea
                  value={editingValue}
                  onChange={(event) => onEditingValueChange(event.target.value)}
                  className="min-h-20 resize-none border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0"
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onCancelEditUserMessage}
                    disabled={sending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void onSubmitEditUserMessage()}
                    disabled={sending || !editingValue.trim()}
                  >
                    Send
                  </Button>
                </div>
              </div>
            ) : message.role === 'user' ? (
              <p className="break-words whitespace-pre-wrap text-white dark:text-[#fff]">
                {message.content}
              </p>
            ) : (
              <ChatMarkdown content={message.content} className="text-foreground" />
            )}
          </div>

          {!isLoading && !isEditing ? (
            <div
              className={cn(
                'flex items-center gap-1 text-muted-foreground',
                message.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              {isEditableUserMessage ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="编辑消息"
                    onClick={() => onStartEditUserMessage(message.id, message.content)}
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
