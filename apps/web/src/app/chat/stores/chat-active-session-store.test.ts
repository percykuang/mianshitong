import { describe, expect, it } from 'vitest';
import { createDraftChatSession } from '../lib/chat-session-draft';
import { createChatActiveSessionStore } from './chat-active-session-store';

describe('chat-active-session-store', () => {
  it('支持更新 activeSession 与局部派生更新', () => {
    const store = createChatActiveSessionStore();
    const session = createDraftChatSession('deepseek-chat', 'active_session_1');

    store.getState().setActiveSessionId(session.id);
    store.getState().setActiveSession(session);
    store
      .getState()
      .setActiveSession((previous) =>
        previous ? { ...previous, title: '更新后的标题' } : previous,
      );
    store.getState().setSelectedModelId('deepseek-reasoner');
    store.getState().setSending(true);
    store.getState().setActiveSessionLoading(false);

    expect(store.getState()).toMatchObject({
      activeSessionId: 'active_session_1',
      selectedModelId: 'deepseek-reasoner',
      sending: true,
      activeSessionLoading: false,
    });
    expect(store.getState().activeSession?.title).toBe('更新后的标题');
  });
});
