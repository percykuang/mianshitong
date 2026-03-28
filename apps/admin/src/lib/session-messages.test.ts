import { describe, expect, it } from 'vitest';
import { countVisibleMessages, normalizeSessionMessages } from './session-messages';

describe('session-messages', () => {
  it('会保留 assistant 的 interrupted 状态', () => {
    const messages = normalizeSessionMessages([
      {
        id: 'msg-1',
        role: 'assistant',
        kind: 'text',
        content: '这是一段被用户手动停止的回复',
        createdAt: '2026-03-28T08:00:00.000Z',
        completionStatus: 'interrupted',
      },
    ]);

    expect(messages[0]?.completionStatus).toBe('interrupted');
  });

  it('统计可见消息数时会过滤 system 消息', () => {
    expect(
      countVisibleMessages([
        {
          id: 'sys-1',
          role: 'system',
          kind: 'system',
          content:
            '你好，我是面试通 AI 面试官。你可以直接说“开始模拟面试”，或先让我帮你优化简历/拆解面试题。',
        },
        {
          id: 'user-1',
          role: 'user',
          kind: 'text',
          content: '你好',
        },
      ]),
    ).toBe(1);
  });
});
