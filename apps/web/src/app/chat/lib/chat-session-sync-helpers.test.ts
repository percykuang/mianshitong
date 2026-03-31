import { describe, expect, it, vi } from 'vitest';
import { createDraftChatSession, toSessionSummary } from './chat-session-draft';
import { readCachedSession, clearCachedSessions } from '../stores/chat-session-cache-store';
import { syncChatSessionUpdate } from './chat-session-sync-helpers';

describe('syncChatSessionUpdate', () => {
  it('会缓存会话并在提供列表刷新能力时同步最新列表', async () => {
    clearCachedSessions();
    const session = createDraftChatSession('deepseek-chat', 'session_sync_1');
    const summaries = [toSessionSummary(session)];
    const setActiveSession = vi.fn();
    const fetchSessionList = vi.fn(async () => summaries);
    const setSessions = vi.fn();

    await syncChatSessionUpdate({
      session,
      setActiveSession,
      fetchSessionList,
      setSessions,
    });

    expect(readCachedSession(session.id)).toEqual(session);
    expect(fetchSessionList).toHaveBeenCalledTimes(1);
    expect(setSessions).toHaveBeenCalledWith(summaries);
    expect(setActiveSession).toHaveBeenCalledTimes(1);
  });

  it('仅在当前激活会话匹配时替换 active session', async () => {
    clearCachedSessions();
    const session = createDraftChatSession('deepseek-chat', 'session_sync_2');
    const setActiveSession = vi.fn();

    await syncChatSessionUpdate({
      session,
      setActiveSession,
    });

    const updater = setActiveSession.mock.calls[0]?.[0] as (
      current: typeof session | null,
    ) => typeof session | null;

    expect(updater(createDraftChatSession('deepseek-chat', 'other_session'))?.id).toBe(
      'other_session',
    );
    expect(updater(createDraftChatSession('deepseek-chat', session.id))).toEqual(session);
  });
});
