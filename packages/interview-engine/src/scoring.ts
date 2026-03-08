import {
  clamp,
  createEmptyScores,
  type DimensionScores,
  type InterviewReport,
  type InterviewRuntimeState,
  type QuestionAssessment,
} from '@mianshitong/shared';
import { includesKeyword } from './session-core';

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

export function buildAssessment(
  question: InterviewRuntimeState['questionPlan'][number],
  answer: string,
): QuestionAssessment {
  const matchedPoints = question.keyPoints.filter((item) => includesKeyword(answer, item));
  const missingPoints = question.keyPoints.filter((item) => !includesKeyword(answer, item));
  const scores = deriveScores({
    answer,
    matchedCount: matchedPoints.length,
    keyPointCount: question.keyPoints.length,
  });
  const averageScore =
    (scores.correctness +
      scores.depth +
      scores.communication +
      scores.engineering +
      scores.tradeoffs) /
    5;

  let summary = '回答基本覆盖了关键点，建议在边界场景里再补一个真实案例。';
  if (averageScore < 2.5) {
    summary = '这题还需要补基础，建议先讲核心概念，再补一个落地例子。';
  } else if (averageScore > 4.2) {
    summary = '回答扎实，继续保持这种“结论 -> 原因 -> 例子 -> 权衡”的表达结构。';
  }

  return {
    questionId: question.id,
    questionTitle: question.title,
    topic: question.topic,
    summary,
    matchedPoints,
    missingPoints,
    scores,
  };
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

export function buildInterviewReport(assessments: QuestionAssessment[]): InterviewReport {
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

  const level = overallScore < 2.5 ? 'needs-work' : overallScore < 4.3 ? 'solid' : 'strong';
  const strengths = Array.from(new Set(assessments.flatMap((item) => item.matchedPoints))).slice(
    0,
    4,
  );
  const gaps = Array.from(new Set(assessments.flatMap((item) => item.missingPoints))).slice(0, 4);
  const nextSteps = gaps
    .slice(0, 3)
    .map((item) => `围绕“${item}”整理一页复盘笔记，并给出一个项目例子。`);

  let overallSummary = '你的基础能力不错，建议继续加强工程化和取舍表达。';
  if (level === 'needs-work') {
    overallSummary = '当前基础还不稳定，建议优先补核心概念与常见场景。';
  }
  if (level === 'strong') {
    overallSummary = '整体表现优秀，继续强化系统化表达和复杂场景推理。';
  }

  return {
    overallSummary,
    overallScore,
    level,
    strengths,
    gaps,
    nextSteps,
    dimensionSummary,
    breakdown: assessments,
  };
}
