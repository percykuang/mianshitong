import { describe, expect, it } from 'vitest';
import { createInterviewSession, processSessionMessage } from './index';

describe('interview engine', () => {
  it('starts in idle status with welcome message', () => {
    const session = createInterviewSession();

    expect(session.status).toBe('idle');
    expect(session.messages.length).toBe(1);
    expect(session.messages[0]?.role).toBe('assistant');
  });

  it('can start and finish a single-question interview', () => {
    const initial = createInterviewSession({
      config: {
        topics: ['javascript'],
        level: 'mid',
        questionCount: 1,
        feedbackMode: 'per_question',
      },
    });

    const started = processSessionMessage({
      session: initial,
      content: '开始模拟面试',
    }).session;

    expect(started.status).toBe('interviewing');
    expect(started.messages.at(-1)?.kind).toBe('question');

    const followUpRound = processSessionMessage({
      session: started,
      content: '我知道 Promise 和宏任务。',
    }).session;

    expect(followUpRound.runtime.followUpRound).toBe(1);
    expect(followUpRound.messages.at(-1)?.kind).toBe('question');

    const finished = processSessionMessage({
      session: followUpRound,
      content:
        '调用栈清空后会先执行微任务再执行宏任务，Promise 属于微任务，最后再进入下一轮事件循环。',
    }).session;

    expect(finished.status).toBe('completed');
    expect(finished.report).not.toBeNull();
    expect(finished.messages.at(-1)?.kind).toBe('report');
  });
});
