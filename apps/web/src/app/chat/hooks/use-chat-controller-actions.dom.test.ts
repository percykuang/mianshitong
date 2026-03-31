/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatSession } from '@mianshitong/shared';
import { createDraftChatSession } from '../lib/chat-session-draft';
import { useChatControllerActions } from './use-chat-controller-actions';

function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

function createDeps(overrides: Partial<Parameters<typeof useChatControllerActions>[0]> = {}) {
  return {
    fetchSessionById: vi.fn(async () => createDraftChatSession('deepseek-chat', 'fetched_session')),
    refreshSessions: vi.fn(async () => []),
    deleteSessionById: vi.fn(async () => undefined),
    deleteAllSessions: vi.fn(async () => undefined),
    readCachedSession: vi.fn(() => null),
    removeCachedSession: vi.fn(),
    clearCachedSessions: vi.fn(),
    sendMessage: vi.fn(async () => undefined),
    activeSessionId: null,
    setInputValue: vi.fn(),
    setSelectedModelId: vi.fn(),
    setErrorFeedback: vi.fn(),
    setSidebarOpen: vi.fn(),
    setActiveSession: vi.fn(),
    setActiveSessionId: vi.fn(),
    setEditingMessageId: vi.fn(),
    setEditingValue: vi.fn(),
    setActiveSessionLoading: vi.fn(),
    pushSession: vi.fn(),
    pushNewChat: vi.fn(),
    replaceSession: vi.fn(),
    replaceNewChat: vi.fn(),
    ...overrides,
  };
}

describe('useChatControllerActions', () => {
  it('选择已有缓存会话时会立即应用缓存并在移动端关闭侧栏', async () => {
    setViewportWidth(375);
    const cachedSession = createDraftChatSession('deepseek-chat', 'cached_session_1');
    const deps = createDeps({
      readCachedSession: vi.fn((sessionId: string): ChatSession | null =>
        sessionId === cachedSession.id ? cachedSession : null,
      ),
    });

    const { result } = renderHook(() => useChatControllerActions(deps));

    await act(async () => {
      await result.current.handlePickSession(cachedSession.id);
    });

    expect(deps.setActiveSessionId).toHaveBeenCalledWith(cachedSession.id);
    expect(deps.setActiveSession).toHaveBeenCalledWith(cachedSession);
    expect(deps.setSelectedModelId).toHaveBeenCalledWith(cachedSession.modelId);
    expect(deps.setActiveSessionLoading).toHaveBeenCalledWith(false);
    expect(deps.pushSession).toHaveBeenCalledWith(cachedSession.id);
    expect(deps.setSidebarOpen).toHaveBeenCalledWith(false);
    expect(deps.setEditingMessageId).toHaveBeenCalledWith(null);
    expect(deps.setEditingValue).toHaveBeenCalledWith('');
  });

  it('选择未缓存会话时会进入 loading 且不在桌面端关闭侧栏', async () => {
    setViewportWidth(1280);
    const deps = createDeps();

    const { result } = renderHook(() => useChatControllerActions(deps));

    await act(async () => {
      await result.current.handlePickSession('remote_session_1');
    });

    expect(deps.setActiveSessionLoading).toHaveBeenCalledWith(true);
    expect(deps.pushSession).toHaveBeenCalledWith('remote_session_1');
    expect(deps.setSidebarOpen).not.toHaveBeenCalled();
  });

  it('新建会话时会重置状态并在移动端关闭侧栏', async () => {
    setViewportWidth(390);
    const deps = createDeps();

    const { result } = renderHook(() => useChatControllerActions(deps));

    await act(async () => {
      await result.current.handleNewChat();
    });

    expect(deps.setActiveSession).toHaveBeenCalledWith(null);
    expect(deps.setActiveSessionId).toHaveBeenCalledWith(null);
    expect(deps.setActiveSessionLoading).toHaveBeenCalledWith(false);
    expect(deps.setInputValue).toHaveBeenCalledWith('');
    expect(deps.setEditingMessageId).toHaveBeenCalledWith(null);
    expect(deps.setEditingValue).toHaveBeenCalledWith('');
    expect(deps.pushNewChat).toHaveBeenCalled();
    expect(deps.setSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('快速提示词会直接触发发送', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useChatControllerActions(deps));

    await act(async () => {
      await result.current.handleQuickPrompt('可以帮我优化简历吗？');
    });

    expect(deps.sendMessage).toHaveBeenCalledWith('可以帮我优化简历吗？');
  });

  it('开始编辑、取消编辑和展示错误反馈会更新对应状态', () => {
    const deps = createDeps();
    const { result } = renderHook(() => useChatControllerActions(deps));

    act(() => {
      result.current.showErrorFeedback('提示文案');
      result.current.cancelEditingUserMessage();
    });

    expect(deps.setErrorFeedback).toHaveBeenCalledWith('提示文案');
    expect(deps.setEditingMessageId).toHaveBeenLastCalledWith(null);
    expect(deps.setEditingValue).toHaveBeenLastCalledWith('');
  });

  it('取消编辑时会清理编辑态', () => {
    const deps = createDeps();
    const { result } = renderHook(() => useChatControllerActions(deps));

    act(() => {
      result.current.cancelEditingUserMessage();
    });

    expect(deps.setEditingMessageId).toHaveBeenCalledWith(null);
    expect(deps.setEditingValue).toHaveBeenCalledWith('');
  });
});
