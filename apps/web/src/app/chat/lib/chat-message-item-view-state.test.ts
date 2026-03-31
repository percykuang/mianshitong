import type { ChatMessage } from '@mianshitong/shared';
import { describe, expect, it } from 'vitest';
import { getChatMessageItemViewState } from './chat-message-item-view-state';

const USER_MESSAGE: ChatMessage = {
  id: 'user-1',
  role: 'user',
  kind: 'text',
  content: '用户消息',
  createdAt: '2026-04-01T00:00:00.000Z',
  feedback: null,
};

const ASSISTANT_MESSAGE: ChatMessage = {
  id: 'assistant-1',
  role: 'assistant',
  kind: 'text',
  content: '助手消息',
  createdAt: '2026-04-01T00:00:01.000Z',
  feedback: null,
};

describe('getChatMessageItemViewState', () => {
  it('普通用户消息应显示动作区，并允许编辑按钮继续显示', () => {
    const state = getChatMessageItemViewState({
      message: USER_MESSAGE,
      isLoading: false,
      isStreaming: false,
      isEditing: false,
      sending: false,
      canEditUserMessage: true,
      pendingFeedbackTargetMessageId: null,
    });

    expect(state).toMatchObject({
      isUserMessage: true,
      shouldShowActions: true,
      isInterruptedAssistantMessage: false,
      messageFeedbackPending: false,
      canShowEditAction: true,
    });
  });

  it('流式中的 assistant 消息不应显示动作区', () => {
    const state = getChatMessageItemViewState({
      message: ASSISTANT_MESSAGE,
      isLoading: false,
      isStreaming: true,
      isEditing: false,
      sending: true,
      canEditUserMessage: false,
      pendingFeedbackTargetMessageId: null,
    });

    expect(state.shouldShowActions).toBe(false);
    expect(state.isUserMessage).toBe(false);
  });

  it('中断的 assistant 消息应标记为中断，且反馈 pending 应跟随目标消息 id', () => {
    const state = getChatMessageItemViewState({
      message: { ...ASSISTANT_MESSAGE, completionStatus: 'interrupted' },
      isLoading: false,
      isStreaming: false,
      isEditing: false,
      sending: false,
      canEditUserMessage: false,
      pendingFeedbackTargetMessageId: ASSISTANT_MESSAGE.id,
    });

    expect(state.isInterruptedAssistantMessage).toBe(true);
    expect(state.messageFeedbackPending).toBe(true);
    expect(state.canShowEditAction).toBe(false);
  });
});
