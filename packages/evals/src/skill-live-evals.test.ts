import {
  createAssessmentSkill,
  createReportSkill,
  createResumeProfileSkill,
} from '@mianshitong/agent-skills';
import type { InterviewTopic } from '@mianshitong/shared';
import { describe, expect, test, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });

const env =
  (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const liveEvalRequested = env.RUN_LLM_EVALS === '1';
const deepseekReady =
  (env.LLM_PROVIDER ?? '').trim().toLowerCase() === 'deepseek' &&
  Boolean(env.DEEPSEEK_API_KEY?.trim());

function requireDeepSeekLiveEvalEnv() {
  if (deepseekReady) {
    return;
  }

  throw new Error(
    '运行 live eval 前请配置 LLM_PROVIDER=deepseek、DEEPSEEK_API_KEY，并通过 RUN_LLM_EVALS=1 显式开启真实模型评测。',
  );
}

const resumeInput = {
  sourceText:
    '7 年前端经验，主导 React + TypeScript 中后台体系建设，负责 Monorepo、性能治理、灰度发布和团队协作流程设计，也参与 Node BFF 与监控告警方案落地。',
  config: {
    topics: ['javascript', 'react', 'engineering'] as InterviewTopic[],
    level: 'mid' as const,
    questionCount: 4,
    feedbackMode: 'end_summary' as const,
  },
};

const assessmentInput = {
  question: {
    id: 'incident_review',
    level: 'senior' as const,
    title: '线上事故复盘',
    prompt: '如果线上出现高频白屏，你会如何定位与止损？',
    keyPoints: ['止损', '监控', '回滚', '根因定位', '权衡'],
    followUps: [],
    tags: ['engineering', 'performance'],
  },
  answer:
    '我会先止损并确认影响范围，再结合监控、日志、性能面板和发布记录定位触发源，同时权衡回滚、热修复和灰度发布的成本与风险。',
  createdAt: '2026-03-22T12:10:00.000Z',
};

const reportInput = {
  assessments: [
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
  ],
  createdAt: '2026-03-22T12:30:00.000Z',
};

describe.runIf(liveEvalRequested)('skill live evals', () => {
  test('应提供 DeepSeek 真实模型评测所需环境变量', () => {
    requireDeepSeekLiveEvalEnv();
  });

  test.runIf(deepseekReady)('ResumeProfileSkill 应在真实模型下返回有效画像', async () => {
    const liveSkill = createResumeProfileSkill({
      fallbackOnInferenceError: false,
    });

    const liveProfile = await liveSkill.execute(resumeInput);

    expect(liveProfile.seniority).toBeOneOf(['mid', 'senior']);
    const focusTags = new Set([
      ...liveProfile.primaryTags.map((item) => item.tag),
      ...liveProfile.secondaryTags.map((item) => item.tag),
    ]);
    const hitCount = ['react', 'typescript', 'engineering'].filter((tag) =>
      focusTags.has(tag),
    ).length;

    expect(hitCount).toBeGreaterThanOrEqual(2);
    expect(liveProfile.evidence.length).toBeGreaterThan(0);
    expect(liveProfile.confidence).toBeGreaterThan(0.5);
  });

  test.runIf(deepseekReady)('AssessmentSkill 应在真实模型下给出有效结构化反馈', async () => {
    const liveSkill = createAssessmentSkill({
      fallbackOnInferenceError: false,
    });

    const liveResult = await liveSkill.execute(assessmentInput);

    expect(liveResult.assessment.questionId).toBe(assessmentInput.question.id);
    expect(liveResult.trace.averageScore).toBeGreaterThanOrEqual(3);
    expect(
      liveResult.assessment.matchedPoints.length + liveResult.assessment.missingPoints.length,
    ).toBeGreaterThan(0);
    expect(liveResult.assessment.summary.trim().length).toBeGreaterThanOrEqual(8);
  });

  test.runIf(deepseekReady)('ReportSkill 应保持数值稳定，并生成有效叙述层输出', async () => {
    const fallbackSkill = createReportSkill({ inferReport: null });
    const liveSkill = createReportSkill({
      fallbackOnInferenceError: false,
    });

    const [fallbackResult, liveResult] = await Promise.all([
      fallbackSkill.execute(reportInput),
      liveSkill.execute(reportInput),
    ]);

    expect(liveResult.report.level).toBe(fallbackResult.report.level);
    expect(liveResult.report.overallScore).toBe(fallbackResult.report.overallScore);
    expect(liveResult.report.overallSummary.trim().length).toBeGreaterThanOrEqual(12);
    expect(liveResult.report.strengths.length + liveResult.report.gaps.length).toBeGreaterThan(0);
    expect(liveResult.report.nextSteps.length).toBeGreaterThan(0);
  });
});
