/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import { describe, expect, it, vi } from 'vitest';
import {
  requestFollowAndFocusComposer,
  shouldRequestFollowBeforeSend,
} from './chat-client-action-helpers';

describe('chat-client-action-helpers', () => {
  it('仅在未发送且内容非空时才请求 follow', () => {
    expect(shouldRequestFollowBeforeSend(false, '你好')).toBe(true);
    expect(shouldRequestFollowBeforeSend(false, '   ')).toBe(false);
    expect(shouldRequestFollowBeforeSend(true, '你好')).toBe(false);
  });

  it('编辑成功后应先请求 follow，再在下一帧聚焦输入框', () => {
    const requestFollow = vi.fn();
    const focus = vi.fn();
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });

    requestFollowAndFocusComposer({
      requestFollow,
      composerInputRef: {
        current: {
          focus,
        } as unknown as HTMLTextAreaElement,
      },
    });

    expect(requestFollow).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);

    requestAnimationFrameSpy.mockRestore();
  });
});
