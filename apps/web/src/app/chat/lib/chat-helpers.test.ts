import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTemporaryMessage, parseSsePayload } from './chat-helpers';

describe('chat-helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T14:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('会创建带默认 kind 和时间戳的临时消息', () => {
    const message = createTemporaryMessage({ role: 'user', content: '你好' });

    expect(message.id).toMatch(/^tmp_/);
    expect(message.kind).toBe('text');
    expect(message.createdAt).toBe('2026-03-09T14:00:00.000Z');
  });

  it('可以解析合法 SSE payload，并忽略无效内容', () => {
    expect(parseSsePayload('{"delta":"hello"}')).toEqual({ delta: 'hello' });
    expect(parseSsePayload('')).toEqual({});
    expect(parseSsePayload('not-json')).toEqual({});
    expect(parseSsePayload('"plain-string"')).toEqual({});
  });
});
