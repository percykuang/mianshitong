import { describe, expect, it } from 'vitest';
import { decodeSessionRuntime } from './chat-session-ui-state';

describe('decodeSessionRuntime', () => {
  it('兼容旧 runtime，缺少 planningTrace 时自动补 null', () => {
    const decoded = decodeSessionRuntime({
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
      reportTrace: null,
      __chatUi: {
        pinnedAt: '2026-03-22T00:00:00.000Z',
      },
    });

    expect(decoded.pinnedAt).toBe('2026-03-22T00:00:00.000Z');
    expect(decoded.runtime.followUpTrace).toEqual([]);
    expect(decoded.runtime.assessmentTrace).toEqual([]);
    expect(decoded.runtime.planningTrace).toBeNull();
    expect(decoded.runtime.reportTrace).toBeNull();
  });
});
