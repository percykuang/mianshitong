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

function EmptyConversationState() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16 text-center">
      <div className="text-4xl font-semibold text-zinc-900 md:text-4xl">面试通</div>
      <div className="mt-4 text-xl text-zinc-500 md:text-2xl">
        AI 智能面试官，优化简历，模拟面试
      </div>
    </div>
  );
}

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
        {!hasConversation && !suppressEmptyState ? <EmptyConversationState /> : null}

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
