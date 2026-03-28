import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createStreamProvider,
  enqueueSseEvent,
  finalizeSseStream,
  splitShortcutReplyIntoDeltas,
} from './stream-utils';

const originalEnv = {
  ...process.env,
};

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('splitShortcutReplyIntoDeltas', () => {
  it('会把快捷回复拆成多个流式分片，且拼接后可还原原文', () => {
    const content = '你好！我是面试通，一个互联网大公司的资深程序员和面试官，专注于前端技术领域。';

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

describe('finalizeSseStream', () => {
  it('控制器已关闭时会静默忽略普通 SSE enqueue 的 invalid state 错误', () => {
    const closedError = new TypeError('Invalid state: Controller is already closed');
    const enqueue = vi.fn(() => {
      throw closedError;
    });

    expect(enqueueSseEvent({ enqueue }, 'error', { message: 'aborted' })).toBe(false);
  });

  it('会在控制器仍然可写时补发 end 事件并关闭流', () => {
    const enqueue = vi.fn();
    const close = vi.fn();

    finalizeSseStream({ enqueue, close }, { ok: true });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('控制器已关闭时会静默忽略 end enqueue / close 的 invalid state 错误', () => {
    const closedError = new TypeError('Invalid state: Controller is already closed');
    const enqueue = vi.fn(() => {
      throw closedError;
    });
    const close = vi.fn(() => {
      throw closedError;
    });

    expect(() => finalizeSseStream({ enqueue, close }, { ok: false })).not.toThrow();
  });
});
