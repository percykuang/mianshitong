import type { ChatMessage } from '@mianshitong/shared';

interface GetChatMessageItemViewStateInput {
  message: ChatMessage;
  isLoading: boolean;
  isStreaming: boolean;
  isEditing: boolean;
  sending: boolean;
  canEditUserMessage: boolean;
  pendingFeedbackTargetMessageId: string | null;
}

interface ChatMessageItemViewState {
  isUserMessage: boolean;
  shouldShowActions: boolean;
  isInterruptedAssistantMessage: boolean;
  messageFeedbackPending: boolean;
  canShowEditAction: boolean;
}

export function getChatMessageItemViewState(
  input: GetChatMessageItemViewStateInput,
): ChatMessageItemViewState {
  const isUserMessage = input.message.role === 'user' && !input.isLoading;
  const shouldShowActions = !input.isLoading && !input.isEditing && !input.isStreaming;
  const isInterruptedAssistantMessage =
    input.message.role === 'assistant' && input.message.completionStatus === 'interrupted';
  const messageFeedbackPending = input.pendingFeedbackTargetMessageId === input.message.id;
  const canShowEditAction = input.canEditUserMessage && !input.sending;

  return {
    isUserMessage,
    shouldShowActions,
    isInterruptedAssistantMessage,
    messageFeedbackPending,
    canShowEditAction,
  };
}
