import { describe, expect, it } from 'vitest';
import { createChatSessionListStore } from './chat-session-list-store';

describe('chat-session-list-store', () => {
  it('支持设置会话列表与 loading 状态', () => {
    const store = createChatSessionListStore();

    store.getState().setSessions([
      {
        id: 'session_1',
        title: '第一条会话',
        modelId: 'deepseek-chat',
        isPrivate: true,
        status: 'idle',
        createdAt: '2026-03-09T10:00:00.000Z',
        updatedAt: '2026-03-09T10:00:00.000Z',
        pinnedAt: null,
        messageCount: 2,
        lastMessagePreview: '你好',
      },
    ]);
    store.getState().setSessionsLoading(false);

    expect(store.getState().sessions).toHaveLength(1);
    expect(store.getState().sessionsLoading).toBe(false);
  });
});
