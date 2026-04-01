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
  followRequestKey: number;
};

function createScrollContainer() {
  let scrollTopValue = 0;
  let scrollHeightValue = 3200;
  let clientHeightValue = 800;
  const scrollToMock = vi.fn((options?: ScrollToOptions | number, top?: number) => {
    if (typeof options === 'number') {
      scrollTopValue = typeof top === 'number' ? top : options;
      return;
    }

    if (typeof options?.top === 'number') {
      scrollTopValue = options.top;
    }
  });
  const element = document.createElement('div');

  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    get: () => scrollHeightValue,
  });
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    get: () => clientHeightValue,
  });
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => scrollTopValue,
    set: (value: number) => {
      scrollTopValue = value;
    },
  });

  element.scrollTo = scrollToMock as typeof element.scrollTo;

  return {
    element,
    scrollToMock,
    getScrollTop: () => scrollTopValue,
    setScrollTop: (value: number) => {
      scrollTopValue = value;
    },
    setScrollHeight: (value: number) => {
      scrollHeightValue = value;
    },
    setClientHeight: (value: number) => {
      clientHeightValue = value;
    },
  };
}

describe('useAutoScroll', () => {
  let nextAnimationFrameId = 1;
  const animationFrameTimers = new Map<number, number>();

  beforeEach(() => {
    vi.useFakeTimers();
    nextAnimationFrameId = 1;
    animationFrameTimers.clear();

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
      followRequestKey: 0,
    };
    const { result, rerender } = renderHook<ReturnType<typeof useAutoScroll>, AutoScrollHookProps>(
      (props) => useAutoScroll(props),
      {
        initialProps,
      },
    );
    const container = createScrollContainer();
    result.current.scrollContainerRef.current = container.element;

    act(() => {
      rerender({
        activeSessionId: 'session-1',
        activeSessionLoading: true,
        messageCount: 0,
        lastMessageContent: undefined,
        sending: false,
        followRequestKey: 0,
      });
    });

    act(() => {
      rerender({
        activeSessionId: 'session-1',
        activeSessionLoading: false,
        messageCount: 24,
        lastMessageContent: '最后一条消息',
        sending: false,
        followRequestKey: 0,
      });
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(container.scrollToMock).toHaveBeenCalled();
    expect(container.getScrollTop()).toBe(3200);
  });

  it('直接切到已缓存会话时也会自动滚到底部', () => {
    const initialProps: AutoScrollHookProps = {
      activeSessionId: null,
      activeSessionLoading: false,
      messageCount: 0,
      lastMessageContent: undefined,
      sending: false,
      followRequestKey: 0,
    };
    const { result, rerender } = renderHook<ReturnType<typeof useAutoScroll>, AutoScrollHookProps>(
      (props) => useAutoScroll(props),
      {
        initialProps,
      },
    );
    const container = createScrollContainer();
    result.current.scrollContainerRef.current = container.element;

    act(() => {
      rerender({
        activeSessionId: 'session-2',
        activeSessionLoading: false,
        messageCount: 18,
        lastMessageContent: '缓存会话的最后一条消息',
        sending: false,
        followRequestKey: 0,
      });
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(container.scrollToMock).toHaveBeenCalled();
    expect(container.getScrollTop()).toBe(3200);
  });

  it('首条消息流式生成时用户上滑后不会再被自动拉回底部', () => {
    const initialProps: AutoScrollHookProps = {
      activeSessionId: null,
      activeSessionLoading: false,
      messageCount: 0,
      lastMessageContent: undefined,
      sending: false,
      followRequestKey: 0,
    };
    const { result, rerender } = renderHook<ReturnType<typeof useAutoScroll>, AutoScrollHookProps>(
      (props) => useAutoScroll(props),
      {
        initialProps,
      },
    );
    const container = createScrollContainer();
    result.current.scrollContainerRef.current = container.element;

    act(() => {
      rerender({
        ...initialProps,
        activeSessionLoading: true,
      });
      rerender(initialProps);
    });

    act(() => {
      result.current.scrollToBottom();
      rerender({
        activeSessionId: 'draft-session',
        activeSessionLoading: false,
        messageCount: 2,
        lastMessageContent: '',
        sending: true,
        followRequestKey: 1,
      });
    });

    expect(container.scrollToMock).toHaveBeenCalled();
    expect(container.getScrollTop()).toBe(3200);

    act(() => {
      container.setScrollTop(1800);
      container.element.dispatchEvent(new Event('scroll'));
      vi.runAllTimers();
    });

    expect(result.current.isPinnedToBottom).toBe(false);

    const scrollCallCountAfterUserScroll = container.scrollToMock.mock.calls.length;

    act(() => {
      rerender({
        activeSessionId: 'draft-session',
        activeSessionLoading: false,
        messageCount: 2,
        lastMessageContent: '第一段流式内容',
        sending: true,
        followRequestKey: 1,
      });
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(container.scrollToMock).toHaveBeenCalledTimes(scrollCallCountAfterUserScroll);
    expect(container.getScrollTop()).toBe(1800);
  });

  it('用户主动发送消息时会重新进入 follow 并滚到底部', () => {
    const initialProps: AutoScrollHookProps = {
      activeSessionId: 'session-1',
      activeSessionLoading: false,
      messageCount: 8,
      lastMessageContent: '上一条消息',
      sending: false,
      followRequestKey: 0,
    };
    const { result, rerender } = renderHook<ReturnType<typeof useAutoScroll>, AutoScrollHookProps>(
      (props) => useAutoScroll(props),
      {
        initialProps,
      },
    );
    const container = createScrollContainer();
    container.setScrollTop(1400);
    result.current.scrollContainerRef.current = container.element;

    act(() => {
      rerender({
        ...initialProps,
        activeSessionLoading: true,
      });
      rerender(initialProps);
    });

    act(() => {
      container.element.dispatchEvent(new Event('scroll'));
    });

    act(() => {
      rerender({
        activeSessionId: 'session-1',
        activeSessionLoading: false,
        messageCount: 10,
        lastMessageContent: '',
        sending: true,
        followRequestKey: 1,
      });
      vi.runAllTimers();
    });

    expect(result.current.isPinnedToBottom).toBe(true);
    expect(container.getScrollTop()).toBe(3200);
  });

  it('首条超长消息发送时，即使内容在发送后瞬间撑高也会保持 follow', () => {
    const initialProps: AutoScrollHookProps = {
      activeSessionId: null,
      activeSessionLoading: false,
      messageCount: 0,
      lastMessageContent: undefined,
      sending: false,
      followRequestKey: 0,
    };
    const { result, rerender } = renderHook<ReturnType<typeof useAutoScroll>, AutoScrollHookProps>(
      (props) => useAutoScroll(props),
      {
        initialProps,
      },
    );
    const container = createScrollContainer();
    container.setScrollHeight(800);
    result.current.scrollContainerRef.current = container.element;

    act(() => {
      rerender({
        ...initialProps,
        followRequestKey: 1,
      });
      vi.runAllTimers();
    });

    act(() => {
      container.setScrollHeight(3200);
      rerender({
        activeSessionId: 'draft-session',
        activeSessionLoading: false,
        messageCount: 2,
        lastMessageContent: '',
        sending: true,
        followRequestKey: 1,
      });
      vi.runAllTimers();
    });

    expect(result.current.isPinnedToBottom).toBe(true);
    expect(container.getScrollTop()).toBe(3200);

    act(() => {
      rerender({
        activeSessionId: 'draft-session',
        activeSessionLoading: false,
        messageCount: 2,
        lastMessageContent: '第一段流式内容',
        sending: true,
        followRequestKey: 1,
      });
      vi.runAllTimers();
    });

    expect(result.current.isPinnedToBottom).toBe(true);
    expect(container.getScrollTop()).toBe(3200);
  });
});
