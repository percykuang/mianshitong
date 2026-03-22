import { describe, expect, it } from 'vitest';
import type { ChatSession } from '@mianshitong/shared';
import { normalizeInterviewConfig } from '@mianshitong/shared';
import { setSessionMessageFeedback } from './chat-message-feedback';

function createSession(): ChatSession {
  return {
    id: 'session-1',
    title: '测试会话',
    modelId: 'deepseek-chat',
    isPrivate: true,
    status: 'idle',
    config: normalizeInterviewConfig(undefined),
    report: null,
    runtime: {
      questionPlan: [],
      currentQuestionIndex: 0,
      followUpRound: 0,
      activeQuestionAnswers: [],
      assessments: [],
      followUpTrace: [],
      assessmentTrace: [],
      resumeProfile: null,
      interviewBlueprint: null,
      planningSummary: null,
      planGeneratedAt: null,
      planningTrace: null,
      reportTrace: null,
    },
    createdAt: '2026-03-09T00:00:00.000Z',
    updatedAt: '2026-03-09T00:00:00.000Z',
    pinnedAt: null,
    messages: [
      {
        id: 'user-1',
        role: 'user',
        kind: 'text',
        content: '你好',
        createdAt: '2026-03-09T00:00:00.000Z',
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        kind: 'text',
        content: '你好，请问我可以帮你什么？',
        createdAt: '2026-03-09T00:00:01.000Z',
      },
    ],
  };
}

describe('setSessionMessageFeedback', () => {
  it('为 assistant 消息写入反馈', () => {
    const session = createSession();

    const result = setSessionMessageFeedback({
      session,
      messageId: 'assistant-1',
      feedback: 'like',
      now: '2026-03-09T00:00:02.000Z',
    });

    expect(result?.messages[1]?.feedback).toBe('like');
    expect(result?.updatedAt).toBe('2026-03-09T00:00:02.000Z');
  });

  it('支持取消已写入的反馈', () => {
    const session = createSession();
    session.messages[1] = { ...session.messages[1], feedback: 'dislike' };

    const result = setSessionMessageFeedback({
      session,
      messageId: 'assistant-1',
      feedback: null,
      now: '2026-03-09T00:00:03.000Z',
    });

    expect(result?.messages[1]?.feedback).toBeNull();
  });

  it('支持在 like 和 dislike 之间切换', () => {
    const session = createSession();
    session.messages[1] = { ...session.messages[1], feedback: 'like' };

    const result = setSessionMessageFeedback({
      session,
      messageId: 'assistant-1',
      feedback: 'dislike',
      now: '2026-03-09T00:00:04.000Z',
    });

    expect(result?.messages[1]?.feedback).toBe('dislike');
    expect(result?.updatedAt).toBe('2026-03-09T00:00:04.000Z');
  });

  it('忽略非 assistant 消息', () => {
    const session = createSession();

    const result = setSessionMessageFeedback({
      session,
      messageId: 'user-1',
      feedback: 'like',
    });

    expect(result).toBeNull();
  });
});
