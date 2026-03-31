import type { ChatMessage } from '@mianshitong/shared';
import type { RefObject } from 'react';
import { getChatMessageListViewState } from '../lib/chat-message-list-view-state';
import { ChatEmptyState } from './chat-empty-state';
import { CHAT_MESSAGE_COLUMN_CLASS } from './chat-layout';
import { ChatMessageItem } from './chat-message-item';

interface ChatMessageListProps {
  sessionId: string | null;
  messages: ChatMessage[];
  hasUserMessages: boolean;
  hideEmptyState: boolean;
  sending: boolean;
  editingMessageId: string | null;
  editingValue: string;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onStartEditUserMessage: (messageId: string, content: string) => void;
  onEditingValueChange: (value: string) => void;
  onCancelEditUserMessage: () => void;
  onSubmitEditUserMessage: () => Promise<void>;
  onErrorFeedback: (content: string) => void;
}

export function ChatMessageList({
  sessionId,
  messages,
  hasUserMessages,
  hideEmptyState,
  sending,
  editingMessageId,
  editingValue,
  scrollContainerRef,
  onStartEditUserMessage,
  onEditingValueChange,
  onCancelEditUserMessage,
  onSubmitEditUserMessage,
  onErrorFeedback,
}: ChatMessageListProps) {
  const { items } = getChatMessageListViewState({
    messages,
    sending,
    editingMessageId,
  });
  const messageKeyPrefix = sessionId ?? 'empty';

  return (
    <div ref={scrollContainerRef} className="absolute inset-0 touch-pan-y overflow-y-auto">
      <div className={CHAT_MESSAGE_COLUMN_CLASS}>
        {!hasUserMessages && !hideEmptyState ? <ChatEmptyState /> : null}

        {items.map(({ message, isLoading, isStreaming, isEditing, canEditUserMessage }, index) => (
          <ChatMessageItem
            key={`${messageKeyPrefix}:${index}`}
            sessionId={sessionId}
            message={message}
            isLoading={isLoading}
            isStreaming={isStreaming}
            isEditing={isEditing}
            editingValue={editingValue}
            sending={sending}
            canEditUserMessage={canEditUserMessage}
            onStartEditUserMessage={onStartEditUserMessage}
            onEditingValueChange={onEditingValueChange}
            onCancelEditUserMessage={onCancelEditUserMessage}
            onSubmitEditUserMessage={onSubmitEditUserMessage}
            onErrorFeedback={onErrorFeedback}
          />
        ))}

        <div aria-hidden="true" className="min-h-6 min-w-6 shrink-0" />
      </div>
    </div>
  );
}
