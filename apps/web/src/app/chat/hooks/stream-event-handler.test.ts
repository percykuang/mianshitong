import { describe, expect, it, vi } from 'vitest';
import { createDraftChatSession } from '../lib/chat-session-draft';
import { createStreamEventHandler } from './stream-event-handler';

describe('createStreamEventHandler', () => {
  it('收到 delta 时会把内容追加到 optimistic assistant 消息上', () => {
    const session = {
      ...createDraftChatSession('deepseek-chat', 'stream_session_1'),
      messages: [
        ...createDraftChatSession('deepseek-chat', 'stream_session_1').messages,
        {
          id: 'assistant_tmp_1',
          role: 'assistant' as const,
          kind: 'text' as const,
          content: '',
          createdAt: '2026-03-09T14:00:00.000Z',
        },
      ],
    };
    let currentSession = session;
    const setActiveSession = vi.fn((value) => {
      currentSession = typeof value === 'function' ? value(currentSession) : value;
    });
    const setNotice = vi.fn();
    const setSyncedSession = vi.fn();

    const handler = createStreamEventHandler({
      optimisticAssistantId: 'assistant_tmp_1',
      setActiveSession,
      setNotice,
      setSyncedSession,
    });

    handler('delta', '{"delta":"hello"}');
    handler('delta', '{"delta":" world"}');

    expect(currentSession.messages.at(-1)?.content).toBe('hello world');
    expect(setNotice).not.toHaveBeenCalled();
    expect(setSyncedSession).not.toHaveBeenCalled();
  });

  it('收到 done 时会同步服务端 session，收到 error 时会提示 notice', () => {
    const setActiveSession = vi.fn();
    const setNotice = vi.fn();
    const setSyncedSession = vi.fn();
    const syncedSession = createDraftChatSession('deepseek-chat', 'stream_session_2');

    const handler = createStreamEventHandler({
      optimisticAssistantId: 'assistant_tmp_1',
      setActiveSession,
      setNotice,
      setSyncedSession,
    });

    handler('done', JSON.stringify({ session: syncedSession }));
    handler('error', JSON.stringify({ message: '模型繁忙，请稍后再试' }));

    expect(setSyncedSession).toHaveBeenCalledWith(syncedSession);
    expect(setNotice).toHaveBeenCalledWith('模型繁忙，请稍后再试');
  });
});
