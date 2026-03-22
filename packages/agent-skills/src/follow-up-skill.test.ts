import { describe, expect, it } from 'vitest';
import { createFollowUpSkill } from './follow-up-skill';

describe('follow up skill', () => {
  const question = {
    id: 'js_event_loop',
    level: 'mid' as const,
    title: '事件循环与任务调度',
    prompt: '请讲一下事件循环。',
    keyPoints: ['Promise', '宏任务', '微任务'],
    followUps: ['Node.js 里的 nextTick 和 Promise 微任务顺序有什么差异？'],
    tags: ['javascript'],
  };

  it('asks follow up when key points are missing', async () => {
    const result = await createFollowUpSkill().execute({
      question,
      answers: ['我知道 Promise。'],
      followUpRound: 0,
      now: '2026-03-22T10:00:00.000Z',
    });

    expect(result.shouldAskFollowUp).toBe(true);
    expect(result.trace.decision).toBe('ask_follow_up');
    expect(result.trace.askedMissingPoint).toBe('宏任务');
  });

  it('skips when max follow up round is reached', async () => {
    const result = await createFollowUpSkill().execute({
      question,
      answers: ['Promise、宏任务、微任务我都知道。'],
      followUpRound: 1,
      now: '2026-03-22T10:00:00.000Z',
    });

    expect(result.shouldAskFollowUp).toBe(false);
    expect(result.trace.decision).toBe('skip_max_round');
    expect(result.trace.askedMissingPoint).toBeNull();
  });
});
