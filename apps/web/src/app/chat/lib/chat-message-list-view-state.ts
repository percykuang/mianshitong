import type { ChatMessage } from '@mianshitong/shared';
import { isEditableUserMessage } from './chat-message-mutations';

interface GetChatMessageListViewStateInput {
  messages: ChatMessage[];
  sending: boolean;
  editingMessageId: string | null;
}

export interface ChatMessageListItemViewState {
  message: ChatMessage;
  isLoading: boolean;
  isStreaming: boolean;
  isEditing: boolean;
  canEditUserMessage: boolean;
}

interface ChatMessageListViewState {
  visibleMessages: ChatMessage[];
  items: ChatMessageListItemViewState[];
}

export function getChatMessageListViewState(
  input: GetChatMessageListViewStateInput,
): ChatMessageListViewState {
  const visibleMessages = input.messages.filter(
    (message) => message.role !== 'system' && message.kind !== 'system',
  );

  const items = visibleMessages.map((message, index) => {
    const isLatestAssistantMessage =
      index === visibleMessages.length - 1 && message.role === 'assistant';

    return {
      message,
      isLoading: input.sending && isLatestAssistantMessage && !message.content.trim(),
      isStreaming: input.sending && isLatestAssistantMessage,
      isEditing: message.id === input.editingMessageId,
      canEditUserMessage: isEditableUserMessage(visibleMessages, message.id),
    };
  });

  return {
    visibleMessages,
    items,
  };
}
