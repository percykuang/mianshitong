import type { ChatMessage } from '@mianshitong/shared';
import type { RefObject } from 'react';
import { CHAT_MESSAGE_COLUMN_CLASS } from './chat-layout';
import { ChatMessageItem } from './chat-message-item';

interface ChatMessageListProps {
  sessionId: string | null;
  messages: ChatMessage[];
  hasConversation: boolean;
  suppressEmptyState: boolean;
  sending: boolean;
  editingMessageId: string | null;
  editingValue: string;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onStartEditUserMessage: (messageId: string, content: string) => void;
  onEditingValueChange: (value: string) => void;
  onCancelEditUserMessage: () => void;
  onSubmitEditUserMessage: () => Promise<void>;
  onNotice: (content: string) => void;
}

import { ChatEmptyState } from './chat-empty-state';

export function ChatMessageList({
  sessionId,
  messages,
  hasConversation,
  suppressEmptyState,
  sending,
  editingMessageId,
  editingValue,
  scrollContainerRef,
  onStartEditUserMessage,
  onEditingValueChange,
  onCancelEditUserMessage,
  onSubmitEditUserMessage,
  onNotice,
}: ChatMessageListProps) {
  const visibleMessages = messages.filter(
    (message) => message.role !== 'system' && message.kind !== 'system',
  );
  const messageKeyPrefix = sessionId ?? 'empty';

  return (
    <div ref={scrollContainerRef} className="min-h-0 flex-1 touch-pan-y overflow-y-auto">
      <div className={CHAT_MESSAGE_COLUMN_CLASS}>
        {!hasConversation && !suppressEmptyState ? <ChatEmptyState /> : null}

        {visibleMessages.map((message, index) => (
          <ChatMessageItem
            key={`${messageKeyPrefix}:${index}`}
            sessionId={sessionId}
            message={message}
            isLoading={
              sending &&
              index === visibleMessages.length - 1 &&
              message.role === 'assistant' &&
              !message.content.trim()
            }
            isEditing={message.id === editingMessageId}
            editingValue={editingValue}
            sending={sending}
            onStartEditUserMessage={onStartEditUserMessage}
            onEditingValueChange={onEditingValueChange}
            onCancelEditUserMessage={onCancelEditUserMessage}
            onSubmitEditUserMessage={onSubmitEditUserMessage}
            onNotice={onNotice}
          />
        ))}
      </div>
    </div>
  );
}
