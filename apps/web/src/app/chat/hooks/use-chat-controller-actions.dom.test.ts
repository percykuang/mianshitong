/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatSession } from '@mianshitong/shared';
import { createDraftLocalSession } from '../lib/chat-local-session';
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
    fetchSessionById: vi.fn(async () =>
      createDraftLocalSession('deepseek-chat', 'fetched_session'),
    ),
    refreshSessions: vi.fn(async () => []),
    deleteSessionById: vi.fn(async () => undefined),
    deleteAllSessions: vi.fn(async () => undefined),
    readCachedSession: vi.fn(() => null),
    removeCachedSession: vi.fn(),
    clearCachedSessions: vi.fn(),
    sendMessage: vi.fn(async () => undefined),
    editUserMessage: vi.fn(async () => true),
    activeSessionId: null,
    editingMessageId: null,
    editingValue: '',
    setInputValue: vi.fn(),
    setSelectedModelId: vi.fn(),
    setNotice: vi.fn(),
    setToast: vi.fn(),
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
    const cachedSession = createDraftLocalSession('deepseek-chat', 'cached_session_1');
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

  it('复制成功和失败时会分别设置不同 toast', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });

    const successClipboard = { writeText: vi.fn(async () => undefined) };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: successClipboard,
    });

    const successDeps = createDeps();
    const successHook = renderHook(() => useChatControllerActions(successDeps));

    await act(async () => {
      await successHook.result.current.handleCopy('hello');
    });

    expect(successClipboard.writeText).toHaveBeenCalledWith('hello');
    expect(successDeps.setToast).toHaveBeenCalledWith('Copied to clipboard!');

    const failClipboard = {
      writeText: vi.fn(async () => {
        throw new Error('copy failed');
      }),
    };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: failClipboard,
    });

    const failDeps = createDeps();
    const failHook = renderHook(() => useChatControllerActions(failDeps));

    await act(async () => {
      await failHook.result.current.handleCopy('fail');
    });

    expect(failDeps.setToast).toHaveBeenCalledWith('Copy failed. Please copy manually.');
  });

  it('开始编辑、取消编辑和展示 notice 会更新对应状态', () => {
    const deps = createDeps();
    const { result } = renderHook(() => useChatControllerActions(deps));

    act(() => {
      result.current.startEditingUserMessage('message_1', '原始内容');
      result.current.showNotice('提示文案');
      result.current.cancelEditingUserMessage();
    });

    expect(deps.setEditingMessageId).toHaveBeenNthCalledWith(1, 'message_1');
    expect(deps.setEditingValue).toHaveBeenNthCalledWith(1, '原始内容');
    expect(deps.setNotice).toHaveBeenCalledWith('提示文案');
    expect(deps.setEditingMessageId).toHaveBeenLastCalledWith(null);
    expect(deps.setEditingValue).toHaveBeenLastCalledWith('');
  });

  it('提交编辑成功后会清理编辑态，失败时保留编辑态', async () => {
    const successDeps = createDeps({
      editingMessageId: 'message_1',
      editingValue: '更新后的内容',
      editUserMessage: vi.fn(async () => true),
    });
    const failDeps = createDeps({
      editingMessageId: 'message_2',
      editingValue: '失败内容',
      editUserMessage: vi.fn(async () => false),
    });

    const successHook = renderHook(() => useChatControllerActions(successDeps));
    const failHook = renderHook(() => useChatControllerActions(failDeps));

    await expect(successHook.result.current.submitEditingUserMessage()).resolves.toBe(true);
    await expect(failHook.result.current.submitEditingUserMessage()).resolves.toBe(false);

    expect(successDeps.setEditingMessageId).toHaveBeenCalledWith(null);
    expect(successDeps.setEditingValue).toHaveBeenCalledWith('');
    expect(failDeps.setEditingMessageId).not.toHaveBeenCalledWith(null);
  });
});
