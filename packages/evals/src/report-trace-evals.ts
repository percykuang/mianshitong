import { buildInterviewReportResult } from '@mianshitong/interview-engine';
import type {
  InterviewReportLevel,
  InterviewScoreDimension,
  QuestionAssessment,
} from '@mianshitong/shared';

const SCORE_DIMENSIONS = [
  'correctness',
  'depth',
  'communication',
  'engineering',
  'tradeoffs',
] as const satisfies ReadonlyArray<InterviewScoreDimension>;

export interface ReportTraceEvalExpectations {
  level: InterviewReportLevel;
  minOverallScore?: number;
  maxOverallScore?: number;
  requiredStrengths?: string[];
  requiredGaps?: string[];
  nextStepCount?: number;
  requireNoNextSteps?: boolean;
  requireDimensionTrace?: boolean;
}

export interface ReportTraceEvalCase {
  id: string;
  description: string;
  createdAt?: string;
  assessments: QuestionAssessment[];
  expectations: ReportTraceEvalExpectations;
}

export interface ReportTraceEvalResult {
  caseId: string;
  description: string;
  passed: boolean;
  failures: string[];
  overallScore: number;
  level: InterviewReportLevel;
  strengths: string[];
  gaps: string[];
  nextStepCount: number;
}

function validateExpectations(input: {
  evalCase: ReportTraceEvalCase;
  report: ReturnType<typeof buildInterviewReportResult>['report'];
  trace: ReturnType<typeof buildInterviewReportResult>['trace'];
}): ReportTraceEvalResult {
  const failures: string[] = [];
  const { evalCase, report, trace } = input;
  const expected = evalCase.expectations;
  const traceStrengths = trace.strengths.map((item) => item.point);
  const traceGaps = trace.gaps.map((item) => item.point);
  const traceNextSteps = trace.nextSteps.map((item) => item.action);

  if (report.level !== expected.level) {
    failures.push(`报告等级不符合预期：实际 ${report.level}，预期 ${expected.level}`);
  }

  if (trace.level !== report.level) {
    failures.push(`trace.level 与 report.level 不一致：${trace.level} vs ${report.level}`);
  }

  if (trace.summaryTemplate !== trace.level) {
    failures.push(
      `summaryTemplate 与 level 不一致：template=${trace.summaryTemplate}，level=${trace.level}`,
    );
  }

  if (trace.overallSummary !== report.overallSummary) {
    failures.push('trace.overallSummary 与 report.overallSummary 不一致');
  }

  if (JSON.stringify(report.strengths) !== JSON.stringify(traceStrengths)) {
    failures.push('report.strengths 与 trace.strengths 不一致');
  }

  if (JSON.stringify(report.gaps) !== JSON.stringify(traceGaps)) {
    failures.push('report.gaps 与 trace.gaps 不一致');
  }

  if (JSON.stringify(report.nextSteps) !== JSON.stringify(traceNextSteps)) {
    failures.push('report.nextSteps 与 trace.nextSteps 不一致');
  }

  if (trace.assessmentCount !== evalCase.assessments.length) {
    failures.push(
      `assessmentCount 异常：实际 ${trace.assessmentCount}，预期 ${evalCase.assessments.length}`,
    );
  }

  if (
    typeof expected.minOverallScore === 'number' &&
    report.overallScore < expected.minOverallScore
  ) {
    failures.push(
      `overallScore 低于预期：实际 ${report.overallScore}，预期至少 ${expected.minOverallScore}`,
    );
  }

  if (
    typeof expected.maxOverallScore === 'number' &&
    report.overallScore > expected.maxOverallScore
  ) {
    failures.push(
      `overallScore 高于预期：实际 ${report.overallScore}，预期最多 ${expected.maxOverallScore}`,
    );
  }

  for (const strength of expected.requiredStrengths ?? []) {
    if (!traceStrengths.includes(strength)) {
      failures.push(`优势项缺失：${strength}`);
    }
  }

  for (const gap of expected.requiredGaps ?? []) {
    if (!traceGaps.includes(gap)) {
      failures.push(`短板项缺失：${gap}`);
    }
  }

  if (
    typeof expected.nextStepCount === 'number' &&
    trace.nextSteps.length !== expected.nextStepCount
  ) {
    failures.push(
      `nextSteps 数量不符合预期：实际 ${trace.nextSteps.length}，预期 ${expected.nextStepCount}`,
    );
  }

  if (expected.requireNoNextSteps && trace.nextSteps.length !== 0) {
    failures.push(`nextSteps 应为空，实际为 ${trace.nextSteps.length}`);
  }

  if (expected.requireDimensionTrace) {
    if (trace.dimensionTraces.length !== SCORE_DIMENSIONS.length) {
      failures.push(
        `dimensionTraces 数量异常：实际 ${trace.dimensionTraces.length}，预期 ${SCORE_DIMENSIONS.length}`,
      );
    }

    for (const dimension of SCORE_DIMENSIONS) {
      const dimensionTrace = trace.dimensionTraces.find((item) => item.dimension === dimension);
      if (!dimensionTrace) {
        failures.push(`缺少维度 trace：${dimension}`);
        continue;
      }

      if (dimensionTrace.averageScore !== report.dimensionSummary[dimension]) {
        failures.push(
          `维度均分不一致（${dimension}）：trace=${dimensionTrace.averageScore}，report=${report.dimensionSummary[dimension]}`,
        );
      }

      if (dimensionTrace.sources.length !== evalCase.assessments.length) {
        failures.push(
          `维度来源数量异常（${dimension}）：实际 ${dimensionTrace.sources.length}，预期 ${evalCase.assessments.length}`,
        );
      }
    }
  }

  for (const pointTrace of [...trace.strengths, ...trace.gaps]) {
    if (pointTrace.count !== pointTrace.sources.length) {
      failures.push(
        `pointTrace.count 与 sources.length 不一致：${pointTrace.point} -> ${pointTrace.count} vs ${pointTrace.sources.length}`,
      );
    }
  }

  return {
    caseId: evalCase.id,
    description: evalCase.description,
    passed: failures.length === 0,
    failures,
    overallScore: report.overallScore,
    level: report.level,
    strengths: report.strengths,
    gaps: report.gaps,
    nextStepCount: report.nextSteps.length,
  };
}

export function runReportTraceEvalCase(evalCase: ReportTraceEvalCase): ReportTraceEvalResult {
  const { report, trace } = buildInterviewReportResult(
    evalCase.assessments,
    evalCase.createdAt ?? '2026-03-22T00:00:00.000Z',
  );

  return validateExpectations({
    evalCase,
    report,
    trace,
  });
}

export function runReportTraceEvalSuite(evalCases: ReportTraceEvalCase[]): ReportTraceEvalResult[] {
  return evalCases.map((evalCase) => runReportTraceEvalCase(evalCase));
}
