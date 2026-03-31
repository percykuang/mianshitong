import type { ChatMessage } from '@mianshitong/shared';
import { describe, expect, it } from 'vitest';
import { getChatClientViewState } from './chat-client-view-state';

const USER_MESSAGE: ChatMessage = {
  id: 'user-1',
  role: 'user',
  kind: 'text',
  content: '你好',
  createdAt: '2026-04-01T00:00:00.000Z',
  feedback: null,
};

const ASSISTANT_MESSAGE: ChatMessage = {
  id: 'assistant-1',
  role: 'assistant',
  kind: 'text',
  content: '你好，有什么我可以帮你？',
  createdAt: '2026-04-01T00:00:01.000Z',
  feedback: null,
};

describe('getChatClientViewState', () => {
  it('存在用户消息且当前不是路由切换加载时，应显示回到底部按钮并保留编辑态', () => {
    const state = getChatClientViewState({
      routeSessionId: 'session-1',
      activeSessionId: 'session-1',
      activeSessionLoading: false,
      messages: [USER_MESSAGE, ASSISTANT_MESSAGE],
      editingMessageId: USER_MESSAGE.id,
      bannerFeedback: { content: '提示文案', tone: 'info' },
    });

    expect(state.hasUserMessages).toBe(true);
    expect(state.shouldShowConversationTransition).toBe(false);
    expect(state.latestMessageContent).toBe(ASSISTANT_MESSAGE.content);
    expect(state.visibleEditingMessageId).toBe(USER_MESSAGE.id);
    expect(state.shouldShowScrollToBottomButton).toBe(true);
    expect(state.activeBannerFeedback).toEqual({ content: '提示文案', tone: 'info' });
    expect(state.bannerFeedbackToneClassName).toBe('bg-zinc-900 text-white');
  });

  it('路由切换到其他会话且正在加载时，应进入过渡态并隐藏回到底部按钮', () => {
    const state = getChatClientViewState({
      routeSessionId: 'session-2',
      activeSessionId: 'session-1',
      activeSessionLoading: true,
      messages: [USER_MESSAGE, ASSISTANT_MESSAGE],
      editingMessageId: USER_MESSAGE.id,
      bannerFeedback: { content: '错误文案', tone: 'error' },
    });

    expect(state.shouldShowConversationTransition).toBe(true);
    expect(state.shouldShowScrollToBottomButton).toBe(false);
    expect(state.bannerFeedbackToneClassName).toBe('bg-red-600 text-white');
  });

  it('编辑目标消息已不在当前可见消息中时，应清空可见编辑态', () => {
    const state = getChatClientViewState({
      routeSessionId: null,
      activeSessionId: null,
      activeSessionLoading: false,
      messages: [ASSISTANT_MESSAGE],
      editingMessageId: USER_MESSAGE.id,
      bannerFeedback: null,
    });

    expect(state.hasUserMessages).toBe(false);
    expect(state.visibleEditingMessageId).toBeNull();
    expect(state.latestMessageContent).toBe(ASSISTANT_MESSAGE.content);
    expect(state.activeBannerFeedback).toBeNull();
    expect(state.bannerFeedbackToneClassName).toBe('bg-zinc-900 text-white');
  });
});
