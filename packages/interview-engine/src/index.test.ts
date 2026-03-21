import { describe, expect, it } from 'vitest';
import type { InterviewQuestion } from '@mianshitong/shared';
import { createInterviewSession, processSessionMessage } from './index';

const questionBank: InterviewQuestion[] = [
  {
    id: 'js_event_loop',
    level: 'mid',
    title: '事件循环与任务调度',
    prompt: '请你讲一下浏览器事件循环里宏任务和微任务的执行顺序。',
    keyPoints: ['Promise', '宏任务', '微任务'],
    followUps: ['Node.js 里的 nextTick 和 Promise 微任务顺序有什么差异？'],
    tags: ['javascript', 'JavaScript'],
  },
];

describe('interview engine', () => {
  it('starts in idle status without welcome message', () => {
    const session = createInterviewSession();

    expect(session.status).toBe('idle');
    expect(session.messages.length).toBe(0);
  });

  it('can start and finish a single-question interview', () => {
    const initial = createInterviewSession({
      config: {
        topics: ['javascript'],
        level: 'mid',
        questionCount: 1,
        feedbackMode: 'per_question',
      },
      questionBank: [...questionBank],
    });

    const started = processSessionMessage({
      session: initial,
      content: '开始模拟面试',
    }).session;

    expect(started.status).toBe('interviewing');
    expect(started.messages.at(-1)?.kind).toBe('question');

    const followUpRound = processSessionMessage({
      session: started,
      content: '我知道 Promise。',
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
