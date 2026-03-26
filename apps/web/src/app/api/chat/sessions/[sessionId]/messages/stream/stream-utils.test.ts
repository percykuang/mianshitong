import { afterEach, describe, expect, it } from 'vitest';
import { createStreamProvider, splitShortcutReplyIntoDeltas } from './stream-utils';

const originalEnv = {
  ...process.env,
};

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('splitShortcutReplyIntoDeltas', () => {
  it('会把快捷回复拆成多个流式分片，且拼接后可还原原文', () => {
    const content =
      '你好！我是面试通，一名资深程序员和前端 AI 面试官，专注于前端求职、简历优化和模拟面试。';

    const chunks = splitShortcutReplyIntoDeltas(content);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(content);
  });

  it('会保留换行和列表结构，不破坏 Markdown 文本', () => {
    const content = [
      '你可以这样发我：',
      '1. 将简历正文完整粘贴到这里。',
      '2. 隐藏个人信息。',
      '',
      '我会先逐段点评。',
    ].join('\n');

    const chunks = splitShortcutReplyIntoDeltas(content);

    expect(chunks.join('')).toBe(content);
    expect(chunks.some((chunk) => chunk.includes('\n'))).toBe(true);
  });
});

describe('createStreamProvider', () => {
  it('在 mock provider 下会返回基于用户消息的流式回复', async () => {
    process.env.LLM_PROVIDER = 'mock';
    process.env.MOCK_STREAM_CHAT_PREFIX = '[web-e2e]';

    const { provider, model } = createStreamProvider('deepseek-chat');
    let content = '';

    for await (const delta of provider.streamChat({
      model,
      messages: [{ role: 'user', content: '可以帮我优化简历吗？' }],
    })) {
      content += delta;
    }

    expect(provider.name).toBe('mock-stream-provider');
    expect(content).toBe('[web-e2e] 已按真实模型链路处理：可以帮我优化简历吗？');
  });
});
