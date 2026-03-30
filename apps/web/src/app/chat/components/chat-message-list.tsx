import type { ChatMessage } from '@mianshitong/shared';
import type { RefObject } from 'react';
import { isEditableUserMessage } from '../lib/chat-message-mutations';
import { ChatEmptyState } from './chat-empty-state';
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
  restorableInterruptedAssistantMessageId: string | null;
  restoringOriginalReply: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onStartEditUserMessage: (messageId: string, content: string) => void;
  onEditingValueChange: (value: string) => void;
  onCancelEditUserMessage: () => void;
  onSubmitEditUserMessage: () => Promise<void>;
  onRestoreOriginalReply: () => Promise<void>;
  onNotice: (content: string) => void;
}

export function ChatMessageList({
  sessionId,
  messages,
  hasConversation,
  suppressEmptyState,
  sending,
  editingMessageId,
  editingValue,
  restorableInterruptedAssistantMessageId,
  restoringOriginalReply,
  scrollContainerRef,
  onStartEditUserMessage,
  onEditingValueChange,
  onCancelEditUserMessage,
  onSubmitEditUserMessage,
  onRestoreOriginalReply,
  onNotice,
}: ChatMessageListProps) {
  const visibleMessages = messages.filter(
    (message) => message.role !== 'system' && message.kind !== 'system',
  );
  const messageKeyPrefix = sessionId ?? 'empty';

  return (
    <div ref={scrollContainerRef} className="absolute inset-0 touch-pan-y overflow-y-auto">
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
            isStreaming={
              sending && index === visibleMessages.length - 1 && message.role === 'assistant'
            }
            isEditing={message.id === editingMessageId}
            editingValue={editingValue}
            sending={sending}
            canEditUserMessage={isEditableUserMessage(visibleMessages, message.id)}
            canRestoreOriginalReply={message.id === restorableInterruptedAssistantMessageId}
            restoringOriginalReply={restoringOriginalReply}
            onStartEditUserMessage={onStartEditUserMessage}
            onEditingValueChange={onEditingValueChange}
            onCancelEditUserMessage={onCancelEditUserMessage}
            onSubmitEditUserMessage={onSubmitEditUserMessage}
            onRestoreOriginalReply={onRestoreOriginalReply}
            onNotice={onNotice}
          />
        ))}

        <div aria-hidden="true" className="min-h-6 min-w-6 shrink-0" />
      </div>
    </div>
  );
}
