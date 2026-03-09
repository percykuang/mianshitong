import { describe, expect, it } from 'vitest';
import {
  createChatSessionId,
  isLegacyChatSessionId,
  normalizeChatSessionId,
} from './chat-session-id';

describe('chat-session-id', () => {
  it('生成的 sessionId 为无连字符的 uuid', () => {
    const sessionId = createChatSessionId();

    expect(sessionId).toMatch(/^[a-f0-9]{32}$/);
    expect(sessionId).not.toContain('-');
  });

  it('可以识别并归一化旧版 sessionId', () => {
    expect(isLegacyChatSessionId('session_ab_cd')).toBe(true);
    expect(normalizeChatSessionId('session_ab_cd')).toBe('abcd');
  });

  it('会保留新版 sessionId，并对空值返回 null', () => {
    expect(normalizeChatSessionId('abc123')).toBe('abc123');
    expect(normalizeChatSessionId('   ')).toBeNull();
    expect(normalizeChatSessionId()).toBeNull();
  });
});
