import { describe, expect, it } from 'vitest';
import type { ChatSession } from '@mianshitong/shared';
import { finalizePersistedInterruptedTurn } from './chat-session-model';

function createSession(messages: ChatSession['messages']): ChatSession {
  return {
    id: 'session-1',
    title: '新的对话',
    modelId: 'deepseek-chat',
    isPrivate: true,
    status: 'interviewing',
    config: {
      level: 'mid',
      topics: ['engineering'],
      questionCount: 1,
      feedbackMode: 'per_question',
    },
    messages,
    report: null,
    runtime: {
      questionPlan: [],
      currentQuestionIndex: 0,
      followUpRound: 0,
      currentStage: 'technical',
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
      projectQuestion: null,
      knowledgeRetrievalTrace: [],
    },
    createdAt: '2026-04-02T00:00:00.000Z',
    updatedAt: '2026-04-02T00:00:00.000Z',
    pinnedAt: null,
  };
}

describe('finalizePersistedInterruptedTurn', () => {
  it('会把已先落库的 assistant 草稿收成 interrupted 部分内容', () => {
    const session = createSession([
      {
        id: 'user-1',
        role: 'user',
        kind: 'text',
        content: '解释事件循环',
        createdAt: '2026-04-02T00:00:00.000Z',
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        kind: 'question',
        content: '点评：完整草稿。\n第二个问题：完整题面。',
        createdAt: '2026-04-02T00:00:01.000Z',
        completionStatus: 'completed',
      },
    ]);

    const next = finalizePersistedInterruptedTurn(session, {
      userContent: '解释事件循环',
      assistantContent: '点评：',
      now: '2026-04-02T00:00:02.000Z',
    });

    expect(next?.messages).toHaveLength(2);
    expect(next?.messages[1]).toMatchObject({
      id: 'assistant-1',
      content: '点评：',
      completionStatus: 'interrupted',
    });
    expect(next?.updatedAt).toBe('2026-04-02T00:00:02.000Z');
  });

  it('如果中断前还没有可见 assistant 输出，会移除已先落库的 assistant 草稿', () => {
    const session = createSession([
      {
        id: 'user-1',
        role: 'user',
        kind: 'text',
        content: '解释事件循环',
        createdAt: '2026-04-02T00:00:00.000Z',
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        kind: 'question',
        content: '点评：完整草稿。\n第二个问题：完整题面。',
        createdAt: '2026-04-02T00:00:01.000Z',
        completionStatus: 'completed',
      },
    ]);

    const next = finalizePersistedInterruptedTurn(session, {
      userContent: '解释事件循环',
      assistantContent: '',
      now: '2026-04-02T00:00:02.000Z',
    });

    expect(next?.messages).toHaveLength(1);
    expect(next?.messages[0]).toMatchObject({
      role: 'user',
      content: '解释事件循环',
    });
  });
});
