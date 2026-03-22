import {
  clamp,
  type DimensionScores,
  type InterviewAssessmentTrace,
  type InterviewQuestion,
  type QuestionAssessment,
} from '@mianshitong/shared';
import type { ChatTurn } from '@mianshitong/llm';
import type { AgentSkill, SkillExecutionContext } from './contracts';
import { createDeepSeekStructuredOutputProvider } from './deepseek-skill-helpers';

const SCORE_DIMENSIONS = [
  'correctness',
  'depth',
  'communication',
  'engineering',
  'tradeoffs',
] as const;

const ENGINEERING_KEYWORD_PATTERN = /测试|监控|发布|回滚|告警|性能|灰度|埋点/;
const TRADEOFF_KEYWORD_PATTERN = /权衡|取舍|成本|收益|边界|场景|复杂度|利弊/;
const STRUCTURE_KEYWORD_PATTERN = /结论|原因|比如|例如|首先|其次|最后|一是|二是|三是/;

export interface AssessmentSkillInput {
  question: InterviewQuestion;
  answer: string;
  createdAt: string;
}

export interface AssessmentSkillResult {
  assessment: QuestionAssessment;
  trace: InterviewAssessmentTrace;
}

export interface AssessmentInference {
  summary?: string;
  matchedPoints?: string[];
  missingPoints?: string[];
  scores?: Partial<DimensionScores>;
}

export type AssessmentInferenceRunner = (
  input: AssessmentSkillInput,
  context?: SkillExecutionContext,
) => Promise<AssessmentInference | null>;

export type AssessmentSkill = AgentSkill<AssessmentSkillInput, AssessmentSkillResult>;

function includesKeyword(answer: string, keyword: string): boolean {
  const normalizedAnswer = answer.toLowerCase();
  const normalizedKeyword = keyword.toLowerCase();
  return normalizedAnswer.includes(normalizedKeyword);
}

function buildAnswerPreview(answer: string): string {
  const normalized = answer.replace(/\s+/g, ' ').trim();
  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
}

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

function averageScores(scores: DimensionScores): number {
  return (
    SCORE_DIMENSIONS.reduce((total, dimension) => total + scores[dimension], 0) /
    SCORE_DIMENSIONS.length
  );
}

function resolveAnswerSignal(answer: string): number {
  let signal = 0.22;

  if (answer.length > 40) {
    signal += 0.08;
  }

  if (answer.length > 100) {
    signal += 0.12;
  }

  if (answer.length > 180) {
    signal += 0.08;
  }

  if (ENGINEERING_KEYWORD_PATTERN.test(answer)) {
    signal += 0.14;
  }

  if (TRADEOFF_KEYWORD_PATTERN.test(answer)) {
    signal += 0.14;
  }

  if (STRUCTURE_KEYWORD_PATTERN.test(answer)) {
    signal += 0.1;
  }

  return clamp(signal, 0.2, 0.78);
}

function deriveScores(input: {
  answer: string;
  matchedCount: number;
  keyPointCount: number;
}): DimensionScores {
  const coverage =
    input.keyPointCount > 0
      ? input.matchedCount / input.keyPointCount
      : resolveAnswerSignal(input.answer);
  const lengthBonus = input.answer.length > 120 ? 1 : 0;
  const hasTradeOffKeyword = TRADEOFF_KEYWORD_PATTERN.test(input.answer);
  const hasEngineeringKeyword = ENGINEERING_KEYWORD_PATTERN.test(input.answer);
  const hasStructuredAnswer = STRUCTURE_KEYWORD_PATTERN.test(input.answer);

  return {
    correctness: clamp(Math.round(2 + coverage * 3), 1, 5),
    depth: clamp(Math.round(1 + coverage * 3 + lengthBonus), 1, 5),
    communication: clamp(
      Math.round(
        2 + coverage * 2 + (input.answer.length > 80 ? 1 : 0) + (hasStructuredAnswer ? 1 : 0),
      ),
      1,
      5,
    ),
    engineering: clamp(Math.round(1 + coverage * 2 + (hasEngineeringKeyword ? 2 : 0)), 1, 5),
    tradeoffs: clamp(Math.round(1 + coverage * 2 + (hasTradeOffKeyword ? 2 : 0)), 1, 5),
  };
}

function buildAssessmentSummary(averageScore: number): string {
  if (averageScore < 2.5) {
    return '这题还需要补基础，建议先讲核心概念，再补一个落地例子。';
  }

  if (averageScore > 4.2) {
    return '回答扎实，继续保持这种“结论 -> 原因 -> 例子 -> 权衡”的表达结构。';
  }

  return '回答基本覆盖了关键点，建议在边界场景里再补一个真实案例。';
}

function normalizePointList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueTextItems(value.filter((item): item is string => typeof item === 'string'));
}

function canonicalizePointSelection(selectedPoints: string[], keyPoints: string[]): string[] {
  if (selectedPoints.length === 0) {
    return [];
  }

  if (keyPoints.length === 0) {
    return selectedPoints.slice(0, 6);
  }

  const matched = new Map<string, string>();

  for (const item of selectedPoints) {
    const normalized = normalizeText(item);
    const exactMatched = keyPoints.find((keyPoint) => normalizeText(keyPoint) === normalized);
    if (exactMatched) {
      matched.set(normalizeText(exactMatched), exactMatched);
      continue;
    }

    const resolved = keyPoints.find((candidate) => {
      const normalizedCandidate = normalizeText(candidate);
      return normalizedCandidate.includes(normalized) || normalized.includes(normalizedCandidate);
    });

    if (resolved) {
      matched.set(normalizeText(resolved), resolved);
    }
  }

  return uniqueTextItems([...matched.values()]).slice(0, 6);
}

function normalizeScores(value: unknown): Partial<DimensionScores> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  const scores = value as Record<string, unknown>;
  const normalized: Partial<DimensionScores> = {};

  for (const dimension of SCORE_DIMENSIONS) {
    const rawValue = scores[dimension];
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
      continue;
    }

    normalized[dimension] = clamp(Math.round(rawValue), 1, 5);
  }

  return normalized;
}

function mergeScores(
  fallbackScores: DimensionScores,
  inferredScores: Partial<DimensionScores>,
): DimensionScores {
  return {
    correctness: inferredScores.correctness ?? fallbackScores.correctness,
    depth: inferredScores.depth ?? fallbackScores.depth,
    communication: inferredScores.communication ?? fallbackScores.communication,
    engineering: inferredScores.engineering ?? fallbackScores.engineering,
    tradeoffs: inferredScores.tradeoffs ?? fallbackScores.tradeoffs,
  };
}

function normalizeSummary(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseAssessmentInference(payload: unknown): AssessmentInference | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const summary = normalizeSummary(record.summary);
  const matchedPoints = normalizePointList(record.matchedPoints);
  const missingPoints = normalizePointList(record.missingPoints);
  const scores = normalizeScores(record.scores);

  if (
    !summary &&
    matchedPoints.length === 0 &&
    missingPoints.length === 0 &&
    Object.keys(scores).length === 0
  ) {
    return null;
  }

  return {
    summary,
    matchedPoints,
    missingPoints,
    scores,
  };
}

function buildAssessmentInferenceMessages(input: AssessmentSkillInput): ChatTurn[] {
  const keyPoints = input.question.keyPoints ?? [];

  return [
    {
      role: 'system',
      content: [
        '你是一个前端面试评估器，需要基于题目与候选人回答输出结构化评分 JSON。',
        '你必须只返回一个 JSON object，不要返回 Markdown、解释、代码块或额外文字。',
        '评分维度必须是 1-5 的整数：correctness、depth、communication、engineering、tradeoffs。',
        '评分标准：',
        '- correctness：概念是否正确、是否答到题目核心。',
        '- depth：是否解释机制、原理、复杂场景。',
        '- communication：是否有清晰结构、表达是否易于理解。',
        '- engineering：是否考虑测试、监控、发布、回滚、性能、可维护性。',
        '- tradeoffs：是否讨论边界、异常、成本、复杂度、方案取舍。',
        keyPoints.length > 0
          ? `matchedPoints 和 missingPoints 必须只从以下 keyPoints 中选择：${keyPoints.join('、')}`
          : '如果没有给定 keyPoints，可以根据你的判断补充 matchedPoints 和 missingPoints。',
        '返回 JSON schema 示例：',
        '{"scores":{"correctness":4,"depth":3,"communication":4,"engineering":3,"tradeoffs":2},"matchedPoints":["state"],"missingPoints":["memo"],"summary":"回答基本正确，但边界与工程实践可以再展开。"}',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `题目标题：${input.question.title}`,
        `题目难度：${input.question.level}`,
        `题目标签：${input.question.tags.join('、') || '无'}`,
        `题目描述：${input.question.prompt ?? input.question.title}`,
        `题目要点：${keyPoints.join('、') || '未提供'}`,
        '候选人回答：',
        input.answer.trim(),
      ].join('\n'),
    },
  ];
}

function buildRuleBasedAssessmentSkillResult(input: AssessmentSkillInput): AssessmentSkillResult {
  const keyPoints = input.question.keyPoints ?? [];
  const matchedPoints = keyPoints.filter((item) => includesKeyword(input.answer, item));
  const missingPoints = keyPoints.filter((item) => !includesKeyword(input.answer, item));
  const scores = deriveScores({
    answer: input.answer,
    matchedCount: matchedPoints.length,
    keyPointCount: keyPoints.length,
  });
  const averageScore = averageScores(scores);
  const roundedAverageScore = Number(averageScore.toFixed(1));
  const summary = buildAssessmentSummary(averageScore);

  return {
    assessment: {
      questionId: input.question.id,
      questionTitle: input.question.title,
      topic: input.question.topic ?? null,
      summary,
      matchedPoints,
      missingPoints,
      scores,
    },
    trace: {
      questionId: input.question.id,
      questionTitle: input.question.title,
      answerPreview: buildAnswerPreview(input.answer),
      answerLength: input.answer.length,
      keyPointCount: keyPoints.length,
      matchedPoints,
      missingPoints,
      scores,
      averageScore: roundedAverageScore,
      summary,
      createdAt: input.createdAt,
    },
  };
}

function mergeAssessmentInference(
  fallbackResult: AssessmentSkillResult,
  input: AssessmentSkillInput,
  inference: AssessmentInference,
): AssessmentSkillResult {
  const keyPoints = input.question.keyPoints ?? [];
  const matchedPoints =
    inference.matchedPoints && inference.matchedPoints.length > 0
      ? canonicalizePointSelection(inference.matchedPoints, keyPoints)
      : fallbackResult.assessment.matchedPoints;
  const inferredMissingPoints = canonicalizePointSelection(
    inference.missingPoints ?? [],
    keyPoints,
  );
  const missingPoints =
    keyPoints.length > 0
      ? uniqueTextItems([
          ...inferredMissingPoints,
          ...keyPoints.filter((item) => !matchedPoints.includes(item)),
        ])
      : inferredMissingPoints.length > 0
        ? inferredMissingPoints
        : fallbackResult.assessment.missingPoints;
  const scores = mergeScores(fallbackResult.assessment.scores, inference.scores ?? {});
  const averageScore = averageScores(scores);
  const roundedAverageScore = Number(averageScore.toFixed(1));
  const summary = inference.summary ?? buildAssessmentSummary(averageScore);

  return {
    assessment: {
      questionId: input.question.id,
      questionTitle: input.question.title,
      topic: input.question.topic ?? null,
      summary,
      matchedPoints,
      missingPoints,
      scores,
    },
    trace: {
      questionId: input.question.id,
      questionTitle: input.question.title,
      answerPreview: buildAnswerPreview(input.answer),
      answerLength: input.answer.length,
      keyPointCount: keyPoints.length,
      matchedPoints,
      missingPoints,
      scores,
      averageScore: roundedAverageScore,
      summary,
      createdAt: input.createdAt,
    },
  };
}

function createDeepSeekAssessmentInferenceRunner(): AssessmentInferenceRunner | undefined {
  const provider = createDeepSeekStructuredOutputProvider(['DEEPSEEK_MODEL']);
  if (!provider) {
    return undefined;
  }

  return async (input, context) => {
    const payload = await provider.completeJson({
      messages: buildAssessmentInferenceMessages(input),
      maxTokens: 900,
      temperature: 0.1,
      signal: context?.signal,
    });

    return parseAssessmentInference(payload);
  };
}

export function buildAssessmentSkillResult(input: AssessmentSkillInput): AssessmentSkillResult {
  return buildRuleBasedAssessmentSkillResult(input);
}

export function createAssessmentSkill(options?: {
  name?: string;
  version?: string;
  inferAssessment?: AssessmentInferenceRunner | null;
  fallbackOnInferenceError?: boolean;
}): AssessmentSkill {
  const fallbackOnInferenceError = options?.fallbackOnInferenceError ?? true;
  const inferAssessment =
    options?.inferAssessment === undefined
      ? createDeepSeekAssessmentInferenceRunner()
      : (options.inferAssessment ?? undefined);

  return {
    name: options?.name ?? 'assessment',
    version: options?.version ?? 'v1',
    async execute(input, context) {
      const fallbackResult = buildRuleBasedAssessmentSkillResult(input);

      if (!inferAssessment) {
        if (!fallbackOnInferenceError) {
          throw new Error('AssessmentSkill 未启用可用的结构化推断器。');
        }

        return fallbackResult;
      }

      try {
        const inference = await inferAssessment(input, context);
        if (!inference) {
          if (!fallbackOnInferenceError) {
            throw new Error('AssessmentSkill 未返回有效的结构化评分结果。');
          }

          return fallbackResult;
        }

        return mergeAssessmentInference(fallbackResult, input, inference);
      } catch (error) {
        if (!fallbackOnInferenceError) {
          throw error;
        }

        return fallbackResult;
      }
    },
  };
}

export const defaultAssessmentSkill = createAssessmentSkill();
