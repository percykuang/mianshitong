import {
  createEmptyScores,
  type DimensionScores,
  type InterviewReport,
  type InterviewReportDimensionTrace,
  type InterviewReportLevel,
  type InterviewReportNextStepTrace,
  type InterviewReportPointTrace,
  type InterviewReportTrace,
  type QuestionAssessment,
} from '@mianshitong/shared';
import type { ChatTurn } from '@mianshitong/llm';
import type { AgentSkill, SkillExecutionContext } from './contracts';
import { createDeepSeekStructuredOutputProvider } from './deepseek-skill-helpers';

const SCORE_DIMENSIONS = [
  { key: 'correctness', label: '正确性' },
  { key: 'depth', label: '深度' },
  { key: 'communication', label: '表达' },
  { key: 'engineering', label: '工程化' },
  { key: 'tradeoffs', label: '权衡' },
] as const satisfies ReadonlyArray<{ key: keyof DimensionScores; label: string }>;

export interface ReportSkillInput {
  assessments: QuestionAssessment[];
  createdAt: string;
}

export interface ReportSkillResult {
  report: InterviewReport;
  trace: InterviewReportTrace;
}

export interface ReportInferenceNextStep {
  gap?: string;
  action?: string;
}

export interface ReportInference {
  overallSummary?: string;
  strengths?: string[];
  gaps?: string[];
  nextSteps?: ReportInferenceNextStep[];
}

export type ReportInferenceRunner = (
  input: ReportSkillInput,
  context?: SkillExecutionContext,
) => Promise<ReportInference | null>;

export type ReportSkill = AgentSkill<ReportSkillInput, ReportSkillResult>;

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function uniqueTextItems(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    if (seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function aggregateDimensionScores(assessments: QuestionAssessment[]): DimensionScores {
  if (assessments.length === 0) {
    return createEmptyScores();
  }

  const sum = assessments.reduce(
    (acc, item) => ({
      correctness: acc.correctness + item.scores.correctness,
      depth: acc.depth + item.scores.depth,
      communication: acc.communication + item.scores.communication,
      engineering: acc.engineering + item.scores.engineering,
      tradeoffs: acc.tradeoffs + item.scores.tradeoffs,
    }),
    createEmptyScores(),
  );

  return {
    correctness: Number((sum.correctness / assessments.length).toFixed(1)),
    depth: Number((sum.depth / assessments.length).toFixed(1)),
    communication: Number((sum.communication / assessments.length).toFixed(1)),
    engineering: Number((sum.engineering / assessments.length).toFixed(1)),
    tradeoffs: Number((sum.tradeoffs / assessments.length).toFixed(1)),
  };
}

function buildDimensionTraces(
  assessments: QuestionAssessment[],
  dimensionSummary: DimensionScores,
): InterviewReportDimensionTrace[] {
  return SCORE_DIMENSIONS.map((dimension) => ({
    dimension: dimension.key,
    averageScore: dimensionSummary[dimension.key],
    sources: assessments.map((assessment) => ({
      questionId: assessment.questionId,
      questionTitle: assessment.questionTitle,
      score: assessment.scores[dimension.key],
    })),
  }));
}

function buildPointTraces(
  assessments: QuestionAssessment[],
  field: 'matchedPoints' | 'missingPoints',
): InterviewReportPointTrace[] {
  const pointMap = new Map<
    string,
    { point: string; sources: InterviewReportPointTrace['sources'] }
  >();

  for (const assessment of assessments) {
    for (const point of assessment[field]) {
      const current = pointMap.get(point) ?? {
        point,
        sources: [],
      };

      if (!current.sources.some((item) => item.questionId === assessment.questionId)) {
        current.sources.push({
          questionId: assessment.questionId,
          questionTitle: assessment.questionTitle,
        });
      }

      pointMap.set(point, current);
    }
  }

  return Array.from(pointMap.values())
    .map((item) => ({
      point: item.point,
      count: item.sources.length,
      sources: item.sources,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.point.localeCompare(right.point, 'zh-CN');
    });
}

function buildNextStepTraces(gaps: InterviewReportPointTrace[]): InterviewReportNextStepTrace[] {
  return gaps.slice(0, 3).map((item) => ({
    gap: item.point,
    action: `围绕“${item.point}”整理一页复盘笔记，并给出一个项目例子。`,
    sources: item.sources,
  }));
}

function resolveReportLevel(overallScore: number): {
  level: InterviewReportLevel;
  levelReason: string;
} {
  if (overallScore < 2.5) {
    return {
      level: 'needs-work',
      levelReason: 'overallScore < 2.5，当前基础掌握还不稳定。',
    };
  }

  if (overallScore < 4.3) {
    return {
      level: 'solid',
      levelReason: '2.5 <= overallScore < 4.3，整体基础合格，但还需要继续拉高上限。',
    };
  }

  return {
    level: 'strong',
    levelReason: 'overallScore >= 4.3，整体表现优秀，具备较强的系统化表达与分析能力。',
  };
}

function buildOverallSummary(level: InterviewReportLevel): string {
  if (level === 'needs-work') {
    return '当前基础还不稳定，建议优先补核心概念与常见场景。';
  }

  if (level === 'strong') {
    return '整体表现优秀，继续强化系统化表达和复杂场景推理。';
  }

  return '你的基础能力不错，建议继续加强工程化和取舍表达。';
}

function normalizeSummary(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeStringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueTextItems(value.filter((item): item is string => typeof item === 'string')).slice(
    0,
    limit,
  );
}

function normalizeNextStepList(value: unknown): ReportInferenceNextStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const results: ReportInferenceNextStep[] = [];

  for (const item of value) {
    if (typeof item === 'string') {
      const action = item.trim();
      if (!action) {
        continue;
      }

      results.push({ action });
      continue;
    }

    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const gap = normalizeSummary(record.gap);
    const action = normalizeSummary(record.action);
    if (!gap && !action) {
      continue;
    }

    results.push({ gap, action });
  }

  return results.slice(0, 4);
}

function parseReportInference(payload: unknown): ReportInference | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const overallSummary = normalizeSummary(record.overallSummary);
  const strengths = normalizeStringList(record.strengths, 4);
  const gaps = normalizeStringList(record.gaps, 4);
  const nextSteps = normalizeNextStepList(record.nextSteps);

  if (!overallSummary && strengths.length === 0 && gaps.length === 0 && nextSteps.length === 0) {
    return null;
  }

  return {
    overallSummary,
    strengths,
    gaps,
    nextSteps,
  };
}

function buildReportInferenceMessages(input: {
  assessments: QuestionAssessment[];
  dimensionSummary: DimensionScores;
  overallScore: number;
  level: InterviewReportLevel;
  strengths: InterviewReportPointTrace[];
  gaps: InterviewReportPointTrace[];
}): ChatTurn[] {
  const dimensionText = SCORE_DIMENSIONS.map(
    (dimension) => `${dimension.label}:${input.dimensionSummary[dimension.key]}`,
  ).join('，');

  const assessmentText = input.assessments
    .map((assessment, index) =>
      [
        `题目 ${index + 1}：${assessment.questionTitle}`,
        `总结：${assessment.summary}`,
        `得分：正确性 ${assessment.scores.correctness}，深度 ${assessment.scores.depth}，表达 ${assessment.scores.communication}，工程化 ${assessment.scores.engineering}，权衡 ${assessment.scores.tradeoffs}`,
        `命中点：${assessment.matchedPoints.join('、') || '无'}`,
        `缺失点：${assessment.missingPoints.join('、') || '无'}`,
      ].join('\n'),
    )
    .join('\n\n');

  return [
    {
      role: 'system',
      content: [
        '你是一个前端模拟面试报告生成器，需要基于结构化评分结果输出报告叙述层 JSON。',
        '你必须只返回一个 JSON object，不要返回 Markdown、解释、代码块或额外文字。',
        '整体分数、等级、维度均分已经由系统计算完成，你不要修改这些数值，只需要生成：overallSummary、strengths、gaps、nextSteps。',
        'strengths 和 gaps 请尽量优先复用已有要点措辞，不要凭空发明不存在的事实。',
        'nextSteps 推荐输出对象数组，每项包含 gap 和 action，action 要具体、可执行。',
        '返回 JSON schema 示例：',
        '{"overallSummary":"基础扎实，但工程化与权衡表达还能继续加强。","strengths":["Promise","memo"],"gaps":["宏任务","边界场景"],"nextSteps":[{"gap":"宏任务","action":"整理浏览器事件循环与宏任务/微任务的对比表，并结合一道输出顺序题做一次口述复盘。"}]}',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `系统计算结果：overallScore=${input.overallScore}，level=${input.level}`,
        `维度均分：${dimensionText}`,
        `系统识别的优势点：${input.strengths.map((item) => item.point).join('、') || '无'}`,
        `系统识别的短板点：${input.gaps.map((item) => item.point).join('、') || '无'}`,
        '逐题评估如下：',
        assessmentText,
      ].join('\n\n'),
    },
  ];
}

function resolvePointTraceSelection(
  selectedPoints: string[] | undefined,
  availableTraces: InterviewReportPointTrace[],
  fallbackTraces: InterviewReportPointTrace[],
): InterviewReportPointTrace[] {
  if (!selectedPoints || selectedPoints.length === 0) {
    return fallbackTraces;
  }

  const resolved: InterviewReportPointTrace[] = [];
  const seen = new Set<string>();

  for (const point of selectedPoints) {
    const normalized = normalizeText(point);
    const matched = availableTraces.find((trace) => {
      const normalizedPoint = normalizeText(trace.point);
      return (
        normalizedPoint === normalized ||
        normalizedPoint.includes(normalized) ||
        normalized.includes(normalizedPoint)
      );
    });

    if (!matched || seen.has(matched.point)) {
      continue;
    }

    seen.add(matched.point);
    resolved.push(matched);
  }

  if (resolved.length === 0) {
    return fallbackTraces;
  }

  for (const item of fallbackTraces) {
    if (resolved.length >= fallbackTraces.length) {
      break;
    }

    if (seen.has(item.point)) {
      continue;
    }

    seen.add(item.point);
    resolved.push(item);
  }

  return resolved.slice(0, fallbackTraces.length);
}

function resolveNextStepSelection(input: {
  inferredNextSteps: ReportInferenceNextStep[] | undefined;
  selectedGapTraces: InterviewReportPointTrace[];
  fallbackGapTraces: InterviewReportPointTrace[];
  fallbackNextSteps: InterviewReportNextStepTrace[];
}): InterviewReportNextStepTrace[] {
  if (!input.inferredNextSteps || input.inferredNextSteps.length === 0) {
    return input.fallbackNextSteps;
  }

  const availableGapTraces =
    input.selectedGapTraces.length > 0 ? input.selectedGapTraces : input.fallbackGapTraces;
  const results: InterviewReportNextStepTrace[] = [];
  const seen = new Set<string>();

  for (const item of input.inferredNextSteps) {
    if (!item.action) {
      continue;
    }

    let gapTrace =
      item.gap &&
      availableGapTraces.find((trace) => {
        const normalizedGap = normalizeText(item.gap ?? '');
        const normalizedPoint = normalizeText(trace.point);
        return (
          normalizedPoint === normalizedGap ||
          normalizedPoint.includes(normalizedGap) ||
          normalizedGap.includes(normalizedPoint)
        );
      });

    if (!gapTrace) {
      gapTrace = availableGapTraces[results.length] ?? input.fallbackGapTraces[results.length];
    }

    if (!gapTrace || seen.has(gapTrace.point)) {
      continue;
    }

    seen.add(gapTrace.point);
    results.push({
      gap: gapTrace.point,
      action: item.action,
      sources: gapTrace.sources,
    });
  }

  if (results.length === 0) {
    return input.fallbackNextSteps;
  }

  for (const fallback of input.fallbackNextSteps) {
    if (results.length >= input.fallbackNextSteps.length) {
      break;
    }

    if (seen.has(fallback.gap)) {
      continue;
    }

    seen.add(fallback.gap);
    results.push(fallback);
  }

  return results.slice(0, input.fallbackNextSteps.length);
}

function buildRuleBasedReportSkillResult(input: ReportSkillInput): ReportSkillResult {
  const dimensionSummary = aggregateDimensionScores(input.assessments);
  const overallScore = Number(
    (
      (dimensionSummary.correctness +
        dimensionSummary.depth +
        dimensionSummary.communication +
        dimensionSummary.engineering +
        dimensionSummary.tradeoffs) /
      5
    ).toFixed(1),
  );

  const { level, levelReason } = resolveReportLevel(overallScore);
  const strengthTrace = buildPointTraces(input.assessments, 'matchedPoints');
  const gapTrace = buildPointTraces(input.assessments, 'missingPoints');
  const nextStepTrace = buildNextStepTraces(gapTrace);
  const overallSummary = buildOverallSummary(level);

  return {
    report: {
      overallSummary,
      overallScore,
      level,
      strengths: strengthTrace.slice(0, 4).map((item) => item.point),
      gaps: gapTrace.slice(0, 4).map((item) => item.point),
      nextSteps: nextStepTrace.map((item) => item.action),
      dimensionSummary,
      breakdown: input.assessments,
    },
    trace: {
      createdAt: input.createdAt,
      assessmentCount: input.assessments.length,
      dimensionSummary,
      dimensionTraces: buildDimensionTraces(input.assessments, dimensionSummary),
      overallScore,
      overallScoreFormula: '先按题目聚合五个维度均分，再对五个维度均值继续取平均。',
      level,
      levelReason,
      summaryTemplate: level,
      overallSummary,
      strengths: strengthTrace.slice(0, 4),
      gaps: gapTrace.slice(0, 4),
      nextSteps: nextStepTrace,
    },
  };
}

function mergeReportInference(
  fallbackResult: ReportSkillResult,
  inference: ReportInference,
): ReportSkillResult {
  const strengthTraces = resolvePointTraceSelection(
    inference.strengths,
    fallbackResult.trace.strengths,
    fallbackResult.trace.strengths,
  );
  const gapTraces = resolvePointTraceSelection(
    inference.gaps,
    fallbackResult.trace.gaps,
    fallbackResult.trace.gaps,
  );
  const nextStepTraces = resolveNextStepSelection({
    inferredNextSteps: inference.nextSteps,
    selectedGapTraces: gapTraces,
    fallbackGapTraces: fallbackResult.trace.gaps,
    fallbackNextSteps: fallbackResult.trace.nextSteps,
  });
  const overallSummary = inference.overallSummary ?? fallbackResult.report.overallSummary;

  return {
    report: {
      ...fallbackResult.report,
      overallSummary,
      strengths: strengthTraces.map((item) => item.point),
      gaps: gapTraces.map((item) => item.point),
      nextSteps: nextStepTraces.map((item) => item.action),
    },
    trace: {
      ...fallbackResult.trace,
      overallSummary,
      strengths: strengthTraces,
      gaps: gapTraces,
      nextSteps: nextStepTraces,
    },
  };
}

function createDeepSeekReportInferenceRunner(): ReportInferenceRunner | undefined {
  const provider = createDeepSeekStructuredOutputProvider(['DEEPSEEK_MODEL']);
  if (!provider) {
    return undefined;
  }

  return async (input, context) => {
    const fallbackResult = buildRuleBasedReportSkillResult(input);
    const payload = await provider.completeJson({
      messages: buildReportInferenceMessages({
        assessments: input.assessments,
        dimensionSummary: fallbackResult.trace.dimensionSummary,
        overallScore: fallbackResult.trace.overallScore,
        level: fallbackResult.trace.level,
        strengths: fallbackResult.trace.strengths,
        gaps: fallbackResult.trace.gaps,
      }),
      maxTokens: 1100,
      temperature: 0.2,
      signal: context?.signal,
    });

    return parseReportInference(payload);
  };
}

export function buildReportSkillResult(input: ReportSkillInput): ReportSkillResult {
  return buildRuleBasedReportSkillResult(input);
}

export function createReportSkill(options?: {
  name?: string;
  version?: string;
  inferReport?: ReportInferenceRunner | null;
  fallbackOnInferenceError?: boolean;
}): ReportSkill {
  const fallbackOnInferenceError = options?.fallbackOnInferenceError ?? true;
  const inferReport =
    options?.inferReport === undefined
      ? createDeepSeekReportInferenceRunner()
      : (options.inferReport ?? undefined);

  return {
    name: options?.name ?? 'report',
    version: options?.version ?? 'v1',
    async execute(input, context) {
      const fallbackResult = buildRuleBasedReportSkillResult(input);

      if (!inferReport || input.assessments.length === 0) {
        if (!inferReport && !fallbackOnInferenceError) {
          throw new Error('ReportSkill 未启用可用的结构化推断器。');
        }

        return fallbackResult;
      }

      try {
        const inference = await inferReport(input, context);
        if (!inference) {
          if (!fallbackOnInferenceError) {
            throw new Error('ReportSkill 未返回有效的结构化报告结果。');
          }

          return fallbackResult;
        }

        return mergeReportInference(fallbackResult, inference);
      } catch (error) {
        if (!fallbackOnInferenceError) {
          throw error;
        }

        return fallbackResult;
      }
    },
  };
}

export const defaultReportSkill = createReportSkill();
