import {
  clamp,
  createEmptyScores,
  type DimensionScores,
  type InterviewAssessmentTrace,
  type InterviewReport,
  type InterviewReportDimensionTrace,
  type InterviewReportLevel,
  type InterviewReportNextStepTrace,
  type InterviewReportPointTrace,
  type InterviewReportTrace,
  type InterviewRuntimeState,
  type QuestionAssessment,
} from '@mianshitong/shared';
import { includesKeyword } from './session-core';

const SCORE_DIMENSIONS = [
  { key: 'correctness', label: '正确性' },
  { key: 'depth', label: '深度' },
  { key: 'communication', label: '表达' },
  { key: 'engineering', label: '工程化' },
  { key: 'tradeoffs', label: '权衡' },
] as const satisfies ReadonlyArray<{ key: keyof DimensionScores; label: string }>;

function buildAnswerPreview(answer: string): string {
  const normalized = answer.replace(/\s+/g, ' ').trim();
  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
}

function deriveScores(input: {
  answer: string;
  matchedCount: number;
  keyPointCount: number;
}): DimensionScores {
  const coverage = input.keyPointCount > 0 ? input.matchedCount / input.keyPointCount : 0;
  const lengthBonus = input.answer.length > 120 ? 1 : 0;
  const hasTradeOffKeyword = /权衡|取舍|成本|收益|边界|场景/.test(input.answer);
  const hasEngineeringKeyword = /测试|监控|发布|回滚|告警|性能/.test(input.answer);

  return {
    correctness: clamp(Math.round(2 + coverage * 3), 1, 5),
    depth: clamp(Math.round(1 + coverage * 3 + lengthBonus), 1, 5),
    communication: clamp(Math.round(2 + coverage * 2 + (input.answer.length > 80 ? 1 : 0)), 1, 5),
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

export function buildAssessmentResult(
  question: InterviewRuntimeState['questionPlan'][number],
  answer: string,
  createdAt: string,
): {
  assessment: QuestionAssessment;
  trace: InterviewAssessmentTrace;
} {
  const keyPoints = question.keyPoints ?? [];
  const matchedPoints = keyPoints.filter((item) => includesKeyword(answer, item));
  const missingPoints = keyPoints.filter((item) => !includesKeyword(answer, item));
  const scores = deriveScores({
    answer,
    matchedCount: matchedPoints.length,
    keyPointCount: keyPoints.length,
  });
  const averageScore =
    (scores.correctness +
      scores.depth +
      scores.communication +
      scores.engineering +
      scores.tradeoffs) /
    5;
  const roundedAverageScore = Number(averageScore.toFixed(1));
  const summary = buildAssessmentSummary(averageScore);

  return {
    assessment: {
      questionId: question.id,
      questionTitle: question.title,
      topic: question.topic ?? null,
      summary,
      matchedPoints,
      missingPoints,
      scores,
    },
    trace: {
      questionId: question.id,
      questionTitle: question.title,
      answerPreview: buildAnswerPreview(answer),
      answerLength: answer.length,
      keyPointCount: keyPoints.length,
      matchedPoints,
      missingPoints,
      scores,
      averageScore: roundedAverageScore,
      summary,
      createdAt,
    },
  };
}

export function buildAssessment(
  question: InterviewRuntimeState['questionPlan'][number],
  answer: string,
): QuestionAssessment {
  return buildAssessmentResult(question, answer, new Date().toISOString()).assessment;
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

export function buildInterviewReportResult(
  assessments: QuestionAssessment[],
  createdAt: string,
): {
  report: InterviewReport;
  trace: InterviewReportTrace;
} {
  const dimensionSummary = aggregateDimensionScores(assessments);
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
  const strengthTrace = buildPointTraces(assessments, 'matchedPoints');
  const gapTrace = buildPointTraces(assessments, 'missingPoints');
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
      breakdown: assessments,
    },
    trace: {
      createdAt,
      assessmentCount: assessments.length,
      dimensionSummary,
      dimensionTraces: buildDimensionTraces(assessments, dimensionSummary),
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

export function buildInterviewReport(assessments: QuestionAssessment[]): InterviewReport {
  return buildInterviewReportResult(assessments, new Date().toISOString()).report;
}
