import { describe, expect, it } from 'vitest';
import { buildReportSkillResult, createReportSkill } from './report-skill';

const assessments = [
  {
    questionId: 'q1',
    questionTitle: '事件循环',
    topic: 'javascript' as const,
    summary: '回答较完整。',
    matchedPoints: ['Promise', '微任务'],
    missingPoints: ['宏任务'],
    scores: {
      correctness: 4,
      depth: 4,
      communication: 4,
      engineering: 3,
      tradeoffs: 3,
    },
  },
  {
    questionId: 'q2',
    questionTitle: 'React 渲染',
    topic: 'react' as const,
    summary: '回答扎实。',
    matchedPoints: ['memo', 'props'],
    missingPoints: ['边界场景'],
    scores: {
      correctness: 5,
      depth: 4,
      communication: 4,
      engineering: 4,
      tradeoffs: 4,
    },
  },
];

describe('report skill', () => {
  it('builds report and trace from assessments', async () => {
    const skill = createReportSkill();
    const result = await skill.execute({
      assessments,
      createdAt: '2026-03-22T12:30:00.000Z',
    });

    expect(skill.name).toBe('report');
    expect(result.report.level).toBe('solid');
    expect(result.trace.assessmentCount).toBe(2);
    expect(result.trace.dimensionTraces).toHaveLength(5);
  });

  it('keeps trace sources and next steps stable', () => {
    const result = buildReportSkillResult({
      assessments,
      createdAt: '2026-03-22T12:30:00.000Z',
    });

    expect(result.report.strengths).toEqual(expect.arrayContaining(['Promise', 'memo']));
    expect(result.trace.gaps.map((item) => item.point)).toEqual(
      expect.arrayContaining(['宏任务', '边界场景']),
    );
    expect(result.trace.nextSteps[0]?.action).toContain('整理一页复盘笔记');
  });

  it('prefers inferred narrative when llm inference succeeds', async () => {
    const skill = createReportSkill({
      inferReport: async () => ({
        overallSummary: '整体基础不错，但事件循环边界和复杂场景表达还可以更完整。',
        strengths: ['memo'],
        gaps: ['宏任务'],
        nextSteps: [
          {
            gap: '宏任务',
            action: '补一页事件循环复盘，重点梳理宏任务、微任务和渲染时机之间的关系。',
          },
        ],
      }),
    });

    const result = await skill.execute({
      assessments,
      createdAt: '2026-03-22T12:30:00.000Z',
    });

    expect(result.report.overallSummary).toBe(
      '整体基础不错，但事件循环边界和复杂场景表达还可以更完整。',
    );
    expect(result.report.strengths[0]).toBe('memo');
    expect(result.report.gaps[0]).toBe('宏任务');
    expect(result.trace.nextSteps[0]?.action).toBe(
      '补一页事件循环复盘，重点梳理宏任务、微任务和渲染时机之间的关系。',
    );
    expect(result.trace.nextSteps[0]?.sources[0]?.questionId).toBe('q1');
  });

  it('falls back to rule report when llm inference fails', async () => {
    const skill = createReportSkill({
      inferReport: async () => {
        throw new Error('llm unavailable');
      },
    });

    const result = await skill.execute({
      assessments,
      createdAt: '2026-03-22T12:30:00.000Z',
    });

    expect(result.report.level).toBe('solid');
    expect(result.report.overallSummary).toBe('你的基础能力不错，建议继续加强工程化和取舍表达。');
    expect(result.trace.nextSteps[0]?.action).toContain('整理一页复盘笔记');
  });

  it('rethrows inference error when strict live-eval mode is enabled', async () => {
    const skill = createReportSkill({
      fallbackOnInferenceError: false,
      inferReport: async () => {
        throw new Error('llm unavailable');
      },
    });

    await expect(
      skill.execute({
        assessments,
        createdAt: '2026-03-22T12:30:00.000Z',
      }),
    ).rejects.toThrow('llm unavailable');
  });
});
