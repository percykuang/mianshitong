/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SessionSummary } from '@mianshitong/shared';
import { useChatSessionDialog } from './use-chat-session-dialog';

const SESSION: SessionSummary = {
  id: 'session-1',
  title: '原始会话标题',
  modelId: 'deepseek-chat',
  isPrivate: false,
  status: 'idle',
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
  pinnedAt: null,
  messageCount: 2,
  lastMessagePreview: '最后一条消息',
};

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('useChatSessionDialog', () => {
  it('打开重命名弹窗时会写入当前标题，并在关闭时清空草稿', () => {
    const onRenameSession = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useChatSessionDialog({
        onRenameSession,
        onDeleteSession: vi.fn(async () => undefined),
        onDeleteAllSessions: vi.fn(async () => undefined),
      }),
    );

    act(() => {
      result.current.openRenameDialog(SESSION);
    });

    expect(result.current.dialogState).toEqual({
      type: 'rename',
      sessionId: SESSION.id,
      title: SESSION.title,
    });
    expect(result.current.renameDraftTitle).toBe(SESSION.title);

    act(() => {
      result.current.closeDialog();
    });

    expect(result.current.dialogState).toEqual({ type: 'closed' });
    expect(result.current.renameDraftTitle).toBe('');
  });

  it('确认重命名成功后会关闭弹窗并清空草稿', async () => {
    const onRenameSession = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useChatSessionDialog({
        onRenameSession,
        onDeleteSession: vi.fn(async () => undefined),
        onDeleteAllSessions: vi.fn(async () => undefined),
      }),
    );

    act(() => {
      result.current.openRenameDialog(SESSION);
      result.current.setRenameDraftTitle('新的会话标题');
    });

    await act(async () => {
      await result.current.confirmRename();
    });

    expect(onRenameSession).toHaveBeenCalledWith(SESSION.id, '新的会话标题');
    expect(result.current.dialogState).toEqual({ type: 'closed' });
    expect(result.current.renameDraftTitle).toBe('');
  });

  it('提交中调用关闭不会提前重置弹窗状态', async () => {
    const deferred = createDeferred<void>();
    const onRenameSession = vi.fn(() => deferred.promise);
    const { result } = renderHook(() =>
      useChatSessionDialog({
        onRenameSession,
        onDeleteSession: vi.fn(async () => undefined),
        onDeleteAllSessions: vi.fn(async () => undefined),
      }),
    );

    act(() => {
      result.current.openRenameDialog(SESSION);
      result.current.setRenameDraftTitle('提交中的标题');
    });

    let confirmPromise!: Promise<void>;
    await act(async () => {
      confirmPromise = result.current.confirmRename();
    });

    act(() => {
      result.current.closeDialog();
    });

    expect(result.current.dialogState).toEqual({
      type: 'rename',
      sessionId: SESSION.id,
      title: SESSION.title,
    });
    expect(result.current.renameDraftTitle).toBe('提交中的标题');
    expect(result.current.dialogSubmitting).toBe(true);

    await act(async () => {
      deferred.resolve();
      await confirmPromise;
    });

    expect(result.current.dialogState).toEqual({ type: 'closed' });
    expect(result.current.renameDraftTitle).toBe('');
    expect(result.current.dialogSubmitting).toBe(false);
  });
});
