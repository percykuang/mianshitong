import type { ChatMessage } from '@mianshitong/shared';
import type { RefObject } from 'react';
import { ChatMessageItem } from './chat-message-item';

interface ChatMessageListProps {
  messages: ChatMessage[];
  hasConversation: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onCopy: (content: string) => Promise<void>;
  onEditUserMessage: (content: string) => void;
  onNotice: (content: string) => void;
}

function EmptyConversationState() {
  return (
    <div className="mx-auto mt-4 flex size-full max-w-3xl flex-col justify-center px-4 md:mt-16 md:px-8">
      <div className="text-3xl font-semibold text-blue-600 md:text-4xl">面试通</div>
      <div className="mt-4 text-xl text-zinc-500 md:text-2xl">
        AI 智能面试官，优化简历，模拟面试
      </div>
    </div>
  );
}

export function ChatMessageList({
  messages,
  hasConversation,
  scrollContainerRef,
  onCopy,
  onEditUserMessage,
  onNotice,
}: ChatMessageListProps) {
  return (
    <div ref={scrollContainerRef} className="min-h-0 flex-1 touch-pan-y overflow-y-auto">
      <div className="mx-auto flex min-w-0 max-w-4xl flex-col gap-4 px-2 py-4 md:gap-6 md:px-4">
        {!hasConversation ? <EmptyConversationState /> : null}

        {messages.map((message) => (
          <ChatMessageItem
            key={message.id}
            message={message}
            onCopy={onCopy}
            onEditUserMessage={onEditUserMessage}
            onNotice={onNotice}
          />
        ))}
      </div>
    </div>
  );
}
