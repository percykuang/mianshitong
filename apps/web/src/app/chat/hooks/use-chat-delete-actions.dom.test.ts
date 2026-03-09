/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SessionSummary } from '@mianshitong/shared';
import { createDraftLocalSession, toSessionSummary } from '../lib/chat-local-session';
import { useChatDeleteActions } from './use-chat-delete-actions';

function createDeps(overrides: Partial<Parameters<typeof useChatDeleteActions>[0]> = {}) {
  return {
    activeSessionId: null,
    fetchSessionById: vi.fn(async (sessionId: string) =>
      createDraftLocalSession('deepseek-chat', sessionId),
    ),
    refreshSessions: vi.fn(async (): Promise<SessionSummary[]> => []),
    deleteSessionById: vi.fn(async () => undefined),
    deleteAllSessions: vi.fn(async () => undefined),
    readCachedSession: vi.fn(() => null),
    removeCachedSession: vi.fn(),
    clearCachedSessions: vi.fn(),
    setInputValue: vi.fn(),
    setSelectedModelId: vi.fn(),
    setNotice: vi.fn(),
    setActiveSession: vi.fn(),
    setActiveSessionId: vi.fn(),
    setEditingMessageId: vi.fn(),
    setEditingValue: vi.fn(),
    setActiveSessionLoading: vi.fn(),
    replaceSession: vi.fn(),
    replaceNewChat: vi.fn(),
    ...overrides,
  };
}

describe('useChatDeleteActions', () => {
  it('删除的不是当前激活会话时不会切换当前会话', async () => {
    const nextSession = createDraftLocalSession('deepseek-chat', 'next_session');
    const deps = createDeps({
      activeSessionId: 'active_session',
      refreshSessions: vi.fn(
        async (): Promise<SessionSummary[]> => [toSessionSummary(nextSession)],
      ),
    });

    const { result } = renderHook(() => useChatDeleteActions(deps));

    await act(async () => {
      await result.current.handleDeleteSession('other_session');
    });

    expect(deps.deleteSessionById).toHaveBeenCalledWith('other_session');
    expect(deps.removeCachedSession).toHaveBeenCalledWith('other_session');
    expect(deps.setActiveSession).not.toHaveBeenCalled();
    expect(deps.replaceNewChat).not.toHaveBeenCalled();
  });

  it('删除当前会话且没有剩余会话时会重置到新会话页', async () => {
    const deps = createDeps({
      activeSessionId: 'active_session',
      refreshSessions: vi.fn(async (): Promise<SessionSummary[]> => []),
    });

    const { result } = renderHook(() => useChatDeleteActions(deps));

    await act(async () => {
      await result.current.handleDeleteSession('active_session');
    });

    expect(deps.setActiveSession).toHaveBeenCalledWith(null);
    expect(deps.setActiveSessionId).toHaveBeenCalledWith(null);
    expect(deps.setEditingMessageId).toHaveBeenCalledWith(null);
    expect(deps.setEditingValue).toHaveBeenCalledWith('');
    expect(deps.replaceNewChat).toHaveBeenCalled();
  });

  it('删除当前会话且下一个会话已缓存时会直接切换缓存', async () => {
    const cachedNext = createDraftLocalSession('deepseek-chat', 'cached_next_session');
    const deps = createDeps({
      activeSessionId: 'active_session',
      refreshSessions: vi.fn(async (): Promise<SessionSummary[]> => [toSessionSummary(cachedNext)]),
      readCachedSession: vi.fn((sessionId: string) =>
        sessionId === cachedNext.id ? cachedNext : null,
      ),
    });

    const { result } = renderHook(() => useChatDeleteActions(deps));

    await act(async () => {
      await result.current.handleDeleteSession('active_session');
    });

    expect(deps.fetchSessionById).not.toHaveBeenCalled();
    expect(deps.setActiveSession).toHaveBeenCalledWith(cachedNext);
    expect(deps.setSelectedModelId).toHaveBeenCalledWith(cachedNext.modelId);
    expect(deps.replaceSession).toHaveBeenCalledWith(cachedNext.id);
  });

  it('删除当前会话且下一个会话未缓存时会远端拉取', async () => {
    const remoteNext = createDraftLocalSession('deepseek-chat', 'remote_next_session');
    const deps = createDeps({
      activeSessionId: 'active_session',
      refreshSessions: vi.fn(async (): Promise<SessionSummary[]> => [toSessionSummary(remoteNext)]),
      fetchSessionById: vi.fn(async () => remoteNext),
    });

    const { result } = renderHook(() => useChatDeleteActions(deps));

    await act(async () => {
      await result.current.handleDeleteSession('active_session');
    });

    expect(deps.setActiveSessionLoading).toHaveBeenCalledWith(true);
    expect(deps.fetchSessionById).toHaveBeenCalledWith(remoteNext.id);
    expect(deps.setActiveSession).toHaveBeenCalledWith(remoteNext);
    expect(deps.replaceSession).toHaveBeenCalledWith(remoteNext.id);
  });

  it('删除所有会话时会清缓存并重置输入与编辑态', async () => {
    const deps = createDeps();

    const { result } = renderHook(() => useChatDeleteActions(deps));

    await act(async () => {
      await result.current.handleDeleteAllSessions();
    });

    expect(deps.deleteAllSessions).toHaveBeenCalled();
    expect(deps.clearCachedSessions).toHaveBeenCalled();
    expect(deps.refreshSessions).toHaveBeenCalled();
    expect(deps.setActiveSession).toHaveBeenCalledWith(null);
    expect(deps.setActiveSessionId).toHaveBeenCalledWith(null);
    expect(deps.setInputValue).toHaveBeenCalledWith('');
    expect(deps.setEditingMessageId).toHaveBeenCalledWith(null);
    expect(deps.setEditingValue).toHaveBeenCalledWith('');
    expect(deps.replaceNewChat).toHaveBeenCalled();
  });
});
