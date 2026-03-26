import type { ChatMessage } from '@mianshitong/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useChatMessageFeedback } from '../hooks/use-chat-message-feedback';
import { ChatAssistantAvatar } from './chat-assistant-avatar';
import { ChatLoadingIndicator } from './chat-loading-indicator';
import { ChatMarkdown } from './chat-markdown';
import { ChatMessageActions } from './chat-message-actions';

interface ChatMessageItemProps {
  sessionId: string | null;
  message: ChatMessage;
  isLoading: boolean;
  isStreaming: boolean;
  isEditing: boolean;
  editingValue: string;
  sending: boolean;
  onStartEditUserMessage: (messageId: string, content: string) => void;
  onEditingValueChange: (value: string) => void;
  onCancelEditUserMessage: () => void;
  onSubmitEditUserMessage: () => Promise<void>;
  onNotice: (content: string) => void;
}

export function ChatMessageItem({
  sessionId,
  message,
  isLoading,
  isStreaming,
  isEditing,
  editingValue,
  sending,
  onStartEditUserMessage,
  onEditingValueChange,
  onCancelEditUserMessage,
  onSubmitEditUserMessage,
  onNotice,
}: ChatMessageItemProps) {
  const isEditableUserMessage = message.role === 'user' && !isLoading;
  const shouldShowActions = !isLoading && !isEditing && !isStreaming;
  const { pendingMessageId, setMessageFeedback } = useChatMessageFeedback({
    sessionId,
    onError: onNotice,
  });
  const feedbackPending = pendingMessageId === message.id;

  return (
    <article className="group/message w-full animate-in duration-200 fade-in slide-in-from-bottom-1">
      <div
        className={cn(
          'flex w-full items-start gap-2 md:gap-3',
          message.role === 'user' ? 'justify-end' : 'justify-start',
        )}
      >
        {message.role === 'assistant' ? <ChatAssistantAvatar loading={isLoading} /> : null}
        <div
          className={cn(
            'flex flex-col gap-2',
            message.role === 'user'
              ? isEditing
                ? 'ml-auto w-full max-w-xl md:gap-3'
                : 'ml-auto max-w-[calc(100%-2.5rem)] items-end sm:max-w-[80%] md:gap-3'
              : 'min-w-0 flex-1 md:gap-4',
          )}
        >
          <div
            className={cn(
              'flex flex-col gap-2 overflow-hidden text-sm',
              message.role === 'user' && !isEditing
                ? 'max-w-full self-end rounded-2xl bg-blue-600 px-3 py-2 text-left text-white dark:text-white'
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
              <p className="wrap-break-word whitespace-pre-wrap text-white dark:text-white">
                {message.content}
              </p>
            ) : (
              <ChatMarkdown content={message.content} className="text-foreground" />
            )}
          </div>

          {shouldShowActions ? (
            <div
              className={cn(
                'flex items-center gap-1 text-muted-foreground',
                message.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              <ChatMessageActions
                isUserMessage={isEditableUserMessage}
                content={message.content}
                messageId={message.id}
                activeFeedback={message.feedback ?? null}
                feedbackPending={feedbackPending}
                onNotice={onNotice}
                onStartEditUserMessage={onStartEditUserMessage}
                onSetMessageFeedback={setMessageFeedback}
              />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
