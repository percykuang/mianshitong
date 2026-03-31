import type { ChatMessage } from '@mianshitong/shared';
import { describe, expect, it } from 'vitest';
import { getChatMessageListViewState } from './chat-message-list-view-state';

const SYSTEM_MESSAGE: ChatMessage = {
  id: 'system-1',
  role: 'system',
  kind: 'system',
  content: 'system',
  createdAt: '2026-04-01T00:00:00.000Z',
  feedback: null,
};

const FIRST_USER_MESSAGE: ChatMessage = {
  id: 'user-1',
  role: 'user',
  kind: 'text',
  content: '第一条用户消息',
  createdAt: '2026-04-01T00:00:01.000Z',
  feedback: null,
};

const LAST_USER_MESSAGE: ChatMessage = {
  id: 'user-2',
  role: 'user',
  kind: 'text',
  content: '最后一条用户消息',
  createdAt: '2026-04-01T00:00:02.000Z',
  feedback: null,
};

const ASSISTANT_MESSAGE: ChatMessage = {
  id: 'assistant-1',
  role: 'assistant',
  kind: 'text',
  content: '',
  createdAt: '2026-04-01T00:00:03.000Z',
  feedback: null,
};

describe('getChatMessageListViewState', () => {
  it('应过滤系统消息，并只允许最后一条用户消息进入编辑态', () => {
    const state = getChatMessageListViewState({
      messages: [SYSTEM_MESSAGE, FIRST_USER_MESSAGE, LAST_USER_MESSAGE],
      sending: false,
      editingMessageId: LAST_USER_MESSAGE.id,
    });

    expect(state.visibleMessages.map((message) => message.id)).toEqual([
      FIRST_USER_MESSAGE.id,
      LAST_USER_MESSAGE.id,
    ]);
    expect(state.items[0]).toMatchObject({
      message: FIRST_USER_MESSAGE,
      isEditing: false,
      canEditUserMessage: false,
    });
    expect(state.items[1]).toMatchObject({
      message: LAST_USER_MESSAGE,
      isEditing: true,
      canEditUserMessage: true,
    });
  });

  it('发送中最后一条空 assistant 消息应同时进入 loading 和 streaming', () => {
    const state = getChatMessageListViewState({
      messages: [LAST_USER_MESSAGE, ASSISTANT_MESSAGE],
      sending: true,
      editingMessageId: null,
    });

    expect(state.items[1]).toMatchObject({
      message: ASSISTANT_MESSAGE,
      isLoading: true,
      isStreaming: true,
    });
  });

  it('发送中最后一条非空 assistant 消息只应保持 streaming，不再显示 loading 气泡', () => {
    const state = getChatMessageListViewState({
      messages: [
        LAST_USER_MESSAGE,
        {
          ...ASSISTANT_MESSAGE,
          content: '已有部分回答',
        },
      ],
      sending: true,
      editingMessageId: null,
    });

    expect(state.items[1]).toMatchObject({
      isLoading: false,
      isStreaming: true,
    });
  });
});
