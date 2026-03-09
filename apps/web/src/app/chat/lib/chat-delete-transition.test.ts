import { describe, expect, it } from 'vitest';
import { getDeleteSessionTransitionPlan } from './chat-delete-transition';

describe('getDeleteSessionTransitionPlan', () => {
  it('删除的不是当前激活会话时不做切换', () => {
    expect(
      getDeleteSessionTransitionPlan({
        activeSessionId: 'session_active',
        deletedSessionId: 'session_other',
        nextSessionId: 'session_next',
        hasCachedNextSession: true,
      }),
    ).toEqual({ kind: 'noop' });
  });

  it('删掉当前会话且没有剩余会话时重置到新会话页', () => {
    expect(
      getDeleteSessionTransitionPlan({
        activeSessionId: 'session_active',
        deletedSessionId: 'session_active',
        nextSessionId: null,
        hasCachedNextSession: false,
      }),
    ).toEqual({ kind: 'reset' });
  });

  it('有缓存的下一个会话时优先用缓存', () => {
    expect(
      getDeleteSessionTransitionPlan({
        activeSessionId: 'session_active',
        deletedSessionId: 'session_active',
        nextSessionId: 'session_next',
        hasCachedNextSession: true,
      }),
    ).toEqual({ kind: 'use-cached', sessionId: 'session_next' });
  });

  it('无缓存时走远端拉取', () => {
    expect(
      getDeleteSessionTransitionPlan({
        activeSessionId: 'session_active',
        deletedSessionId: 'session_active',
        nextSessionId: 'session_next',
        hasCachedNextSession: false,
      }),
    ).toEqual({ kind: 'fetch-remote', sessionId: 'session_next' });
  });
});
