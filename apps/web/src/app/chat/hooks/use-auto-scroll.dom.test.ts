/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoScroll } from './use-auto-scroll';

type AutoScrollHookProps = {
  activeSessionId: string | null;
  activeSessionLoading: boolean;
  messageCount: number;
  lastMessageContent: string | undefined;
  sending: boolean;
};

describe('useAutoScroll', () => {
  let scrollYValue = 0;
  let nextAnimationFrameId = 1;
  const animationFrameTimers = new Map<number, number>();
  const scrollToMock = vi.fn((options?: ScrollToOptions | number, top?: number) => {
    if (typeof options === 'number') {
      scrollYValue = typeof top === 'number' ? top : options;
      return;
    }

    if (typeof options?.top === 'number') {
      scrollYValue = options.top;
    }
  });

  beforeEach(() => {
    vi.useFakeTimers();
    scrollYValue = 0;
    nextAnimationFrameId = 1;
    animationFrameTimers.clear();

    Object.defineProperty(document, 'scrollingElement', {
      configurable: true,
      value: document.documentElement,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      get: () => 3200,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      get: () => 800,
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      get: () => scrollYValue,
    });

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextAnimationFrameId++;
      const timerId = window.setTimeout(() => {
        animationFrameTimers.delete(id);
        callback(performance.now());
      }, 0);
      animationFrameTimers.set(id, timerId);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      const timerId = animationFrameTimers.get(id);
      if (timerId != null) {
        window.clearTimeout(timerId);
        animationFrameTimers.delete(id);
      }
    });

    window.scrollTo = scrollToMock;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('远端会话加载完成后会自动滚到底部', () => {
    const initialProps: AutoScrollHookProps = {
      activeSessionId: null,
      activeSessionLoading: false,
      messageCount: 0,
      lastMessageContent: undefined,
      sending: false,
    };
    const { rerender } = renderHook<ReturnType<typeof useAutoScroll>, AutoScrollHookProps>(
      (props) => useAutoScroll(props),
      {
        initialProps,
      },
    );

    act(() => {
      rerender({
        activeSessionId: 'session-1',
        activeSessionLoading: true,
        messageCount: 0,
        lastMessageContent: undefined,
        sending: false,
      });
    });

    act(() => {
      rerender({
        activeSessionId: 'session-1',
        activeSessionLoading: false,
        messageCount: 24,
        lastMessageContent: '最后一条消息',
        sending: false,
      });
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(scrollToMock).toHaveBeenCalled();
    expect(scrollYValue).toBe(3200);
  });

  it('直接切到已缓存会话时也会自动滚到底部', () => {
    const initialProps: AutoScrollHookProps = {
      activeSessionId: null,
      activeSessionLoading: false,
      messageCount: 0,
      lastMessageContent: undefined,
      sending: false,
    };
    const { rerender } = renderHook<ReturnType<typeof useAutoScroll>, AutoScrollHookProps>(
      (props) => useAutoScroll(props),
      {
        initialProps,
      },
    );

    act(() => {
      rerender({
        activeSessionId: 'session-2',
        activeSessionLoading: false,
        messageCount: 18,
        lastMessageContent: '缓存会话的最后一条消息',
        sending: false,
      });
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(scrollToMock).toHaveBeenCalled();
    expect(scrollYValue).toBe(3200);
  });
});
