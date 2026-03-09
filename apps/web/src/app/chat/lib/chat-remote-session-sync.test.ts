import { describe, expect, it, vi } from 'vitest';
import { createDraftLocalSession } from './chat-local-session';
import {
  syncFetchedRemoteSession,
  syncResolvedRemoteSession,
  trySyncFetchedRemoteSession,
} from './chat-remote-session-sync';

describe('chat-remote-session-sync', () => {
  it('可以同步已解析的服务端会话到当前状态', async () => {
    const session = createDraftLocalSession('deepseek-chat', 'remote_session_1');
    const refreshSessions = vi.fn(async () => undefined);
    const setActiveSession = vi.fn();
    const setActiveSessionId = vi.fn();
    const replaceSession = vi.fn();

    await expect(
      syncResolvedRemoteSession({
        session,
        refreshSessions,
        setActiveSession,
        setActiveSessionId,
        replaceSession,
      }),
    ).resolves.toBe(session);

    expect(setActiveSession).toHaveBeenCalledWith(session);
    expect(setActiveSessionId).toHaveBeenCalledWith(session.id);
    expect(replaceSession).toHaveBeenCalledWith(session.id);
    expect(refreshSessions).toHaveBeenCalled();
  });

  it('可以拉取并同步服务端会话', async () => {
    const session = createDraftLocalSession('deepseek-chat', 'remote_session_2');
    const fetchSessionById = vi.fn(async () => session);
    const refreshSessions = vi.fn(async () => undefined);
    const setActiveSession = vi.fn();
    const setActiveSessionId = vi.fn();

    await expect(
      syncFetchedRemoteSession({
        sessionId: session.id,
        fetchSessionById,
        refreshSessions,
        setActiveSession,
        setActiveSessionId,
      }),
    ).resolves.toBe(session);

    expect(fetchSessionById).toHaveBeenCalledWith(session.id);
    expect(setActiveSession).toHaveBeenCalledWith(session);
    expect(setActiveSessionId).toHaveBeenCalledWith(session.id);
  });

  it('trySyncFetchedRemoteSession 在拉取失败时返回 false', async () => {
    const fetchSessionById = vi.fn(async () => {
      throw new Error('not found');
    });

    await expect(
      trySyncFetchedRemoteSession({
        sessionId: 'missing_session',
        fetchSessionById,
        refreshSessions: vi.fn(async () => undefined),
        setActiveSession: vi.fn(),
        setActiveSessionId: vi.fn(),
      }),
    ).resolves.toBe(false);
  });
});
