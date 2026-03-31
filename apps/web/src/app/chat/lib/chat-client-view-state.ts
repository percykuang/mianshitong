import type { ChatMessage } from '@mianshitong/shared';
import type { ChatBannerFeedback } from '../hooks/chat-controller.types';

interface GetChatClientViewStateInput {
  routeSessionId: string | null;
  activeSessionId: string | null;
  activeSessionLoading: boolean;
  messages: ChatMessage[];
  editingMessageId: string | null;
  bannerFeedback: ChatBannerFeedback | null;
}

interface ChatClientViewState {
  hasUserMessages: boolean;
  shouldShowConversationTransition: boolean;
  latestMessageContent: string | undefined;
  visibleEditingMessageId: string | null;
  activeBannerFeedback: ChatBannerFeedback | null;
  bannerFeedbackToneClassName: string;
  shouldShowScrollToBottomButton: boolean;
}

export function getChatClientViewState(input: GetChatClientViewStateInput): ChatClientViewState {
  const hasUserMessages = input.messages.some((message) => message.role === 'user');
  const shouldShowConversationTransition =
    Boolean(input.routeSessionId) &&
    input.activeSessionLoading &&
    input.activeSessionId !== input.routeSessionId;
  const latestMessageContent = input.messages.at(-1)?.content;
  const visibleEditingMessageId = input.messages.some(
    (message) => message.id === input.editingMessageId,
  )
    ? input.editingMessageId
    : null;
  const activeBannerFeedback = input.bannerFeedback;
  const bannerFeedbackToneClassName =
    activeBannerFeedback?.tone === 'error' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-white';
  const shouldShowScrollToBottomButton = hasUserMessages && !shouldShowConversationTransition;

  return {
    hasUserMessages,
    shouldShowConversationTransition,
    latestMessageContent,
    visibleEditingMessageId,
    activeBannerFeedback,
    bannerFeedbackToneClassName,
    shouldShowScrollToBottomButton,
  };
}
