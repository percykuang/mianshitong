import { describe, expect, it } from 'vitest';
import { createDraftChatSession } from '../lib/chat-session-draft';
import { createChatSessionCacheStore } from './chat-session-cache-store';

describe('chat-session-cache-store', () => {
  it('会按 sessionId 缓存并覆盖会话', () => {
    const store = createChatSessionCacheStore();
    const session = createDraftChatSession('deepseek-chat', 'session_cache_1');
    const updated = { ...session, title: '已更新标题' };

    store.getState().upsertSession(session);
    store.getState().upsertSession(updated);

    expect(store.getState().sessionsById[session.id]?.title).toBe('已更新标题');
  });

  it('删除与清空操作会同步更新缓存', () => {
    const store = createChatSessionCacheStore();
    const first = createDraftChatSession('deepseek-chat', 'session_cache_1');
    const second = createDraftChatSession('deepseek-chat', 'session_cache_2');

    store.getState().upsertSession(first);
    store.getState().upsertSession(second);
    store.getState().removeSession(first.id);

    expect(store.getState().sessionsById[first.id]).toBeUndefined();
    expect(store.getState().sessionsById[second.id]).toBeTruthy();

    store.getState().clearSessions();
    expect(store.getState().sessionsById).toEqual({});
  });
});
