import { describe, expect, it } from 'vitest';
import { buildAssessmentSkillResult, createAssessmentSkill } from './assessment-skill';

describe('assessment skill', () => {
  const question = {
    id: 'react_render',
    level: 'mid' as const,
    title: 'React 渲染机制',
    prompt: 'React 为什么会重复渲染？',
    keyPoints: ['state', 'props', 'memo'],
    followUps: ['你会如何排查无效重渲染？'],
    tags: ['react', 'performance'],
  };

  it('builds assessment and trace for a question answer', async () => {
    const skill = createAssessmentSkill();
    const result = await skill.execute({
      question,
      answer: '组件会因为 state 和 props 变化触发渲染，可以配合 memo 降低不必要的重渲染。',
      createdAt: '2026-03-22T12:00:00.000Z',
    });

    expect(skill.name).toBe('assessment');
    expect(result.assessment.questionId).toBe('react_render');
    expect(result.assessment.matchedPoints).toEqual(['state', 'props', 'memo']);
    expect(result.trace.averageScore).toBeGreaterThanOrEqual(3);
  });

  it('keeps missing points in trace when answer is incomplete', () => {
    const result = buildAssessmentSkillResult({
      question,
      answer: '我会先看 state 的变化。',
      createdAt: '2026-03-22T12:00:00.000Z',
    });

    expect(result.assessment.matchedPoints).toEqual(['state']);
    expect(result.assessment.missingPoints).toEqual(['props', 'memo']);
    expect(result.trace.summary).toContain('建议');
  });

  it('prefers inferred assessment when llm inference succeeds', async () => {
    const skill = createAssessmentSkill({
      inferAssessment: async () => ({
        scores: {
          correctness: 5,
          depth: 4,
          communication: 4,
          engineering: 4,
          tradeoffs: 3,
        },
        matchedPoints: ['state', 'memo'],
        missingPoints: ['props'],
        summary: '回答正确且表达清晰，但可以再补充 props 变化的影响。',
      }),
    });

    const result = await skill.execute({
      question,
      answer: '组件会因为 state 和 props 变化触发渲染，可以配合 memo 降低不必要的重渲染。',
      createdAt: '2026-03-22T12:00:00.000Z',
    });

    expect(result.assessment.scores.correctness).toBe(5);
    expect(result.assessment.matchedPoints).toEqual(['state', 'memo']);
    expect(result.assessment.missingPoints).toEqual(['props']);
    expect(result.trace.summary).toBe('回答正确且表达清晰，但可以再补充 props 变化的影响。');
    expect(result.trace.averageScore).toBe(4);
  });

  it('falls back to heuristic scoring when key points are empty and llm is unavailable', async () => {
    const skill = createAssessmentSkill({
      inferAssessment: async () => {
        throw new Error('llm unavailable');
      },
    });

    const result = await skill.execute({
      question: {
        ...question,
        keyPoints: [],
      },
      answer:
        '结论是要先定位触发源，再结合监控、性能面板和发布回滚信息定位具体问题，同时权衡修复范围和上线风险。',
      createdAt: '2026-03-22T12:00:00.000Z',
    });

    expect(result.assessment.matchedPoints).toEqual([]);
    expect(result.assessment.scores.engineering).toBeGreaterThanOrEqual(3);
    expect(result.assessment.scores.tradeoffs).toBeGreaterThanOrEqual(3);
    expect(result.trace.averageScore).toBeGreaterThanOrEqual(3);
  });

  it('rethrows inference error when strict live-eval mode is enabled', async () => {
    const skill = createAssessmentSkill({
      fallbackOnInferenceError: false,
      inferAssessment: async () => {
        throw new Error('llm unavailable');
      },
    });

    await expect(
      skill.execute({
        question,
        answer: '组件会因为 state 和 props 变化触发渲染，可以配合 memo 降低不必要的重渲染。',
        createdAt: '2026-03-22T12:00:00.000Z',
      }),
    ).rejects.toThrow('llm unavailable');
  });
});
