import { describe, expect, it, vi } from 'vitest';
import { createDraftLocalSession } from './chat-local-session';
import { createLocalStreamHandler } from './chat-local-stream-handler';

describe('createLocalStreamHandler', () => {
  it('会累计 delta，并把内容同步到 optimistic assistant 消息', () => {
    const session = {
      ...createDraftLocalSession('deepseek-chat', 'local_stream_session_1'),
      messages: [
        ...createDraftLocalSession('deepseek-chat', 'local_stream_session_1').messages,
        {
          id: 'assistant_tmp_1',
          role: 'assistant' as const,
          kind: 'text' as const,
          content: '',
          createdAt: '2026-03-09T15:00:00.000Z',
        },
      ],
    };
    let currentSession = session;
    const setActiveSession = vi.fn((value) => {
      currentSession = typeof value === 'function' ? value(currentSession) : value;
    });
    const setNotice = vi.fn();

    const handler = createLocalStreamHandler({
      optimisticAssistantId: 'assistant_tmp_1',
      setActiveSession,
      setNotice,
    });

    handler.handleEvent('delta', '{"delta":"hello"}');
    handler.handleEvent('delta', '{"delta":" world"}');

    expect(currentSession.messages.at(-1)?.content).toBe('hello world');
    expect(handler.getAssistantContent()).toBe('hello world');
    expect(setNotice).not.toHaveBeenCalled();
  });

  it('done 会确定最终内容，error 会设置 notice', () => {
    const setActiveSession = vi.fn();
    const setNotice = vi.fn();
    const handler = createLocalStreamHandler({
      optimisticAssistantId: 'assistant_tmp_1',
      setActiveSession,
      setNotice,
    });

    handler.handleEvent('delta', '{"delta":"hello"}');
    handler.handleEvent('done', '{"assistantContent":"final answer"}');
    handler.handleEvent('error', '{"message":"模型繁忙"}');

    expect(handler.getAssistantContent()).toBe('final answer');
    expect(setNotice).toHaveBeenCalledWith('模型繁忙');
  });

  it('done 支持返回完整 session', () => {
    const nextSession = createDraftLocalSession('deepseek-chat', 'local_stream_session_2');
    const setActiveSession = vi.fn();
    const setNotice = vi.fn();
    const handler = createLocalStreamHandler({
      optimisticAssistantId: 'assistant_tmp_2',
      setActiveSession,
      setNotice,
    });

    handler.handleEvent('done', JSON.stringify({ session: nextSession }));

    expect(handler.getSyncedSession()).toEqual(nextSession);
    expect(handler.getAssistantContent()).toBe('');
  });
});
