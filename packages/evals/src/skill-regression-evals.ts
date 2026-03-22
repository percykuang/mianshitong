import {
  createAssessmentSkill,
  createReportSkill,
  createResumeProfileSkill,
  type AssessmentInference,
  type AssessmentInferenceRunner,
  type ReportInference,
  type ReportInferenceRunner,
  type ResumeProfileInference,
  type ResumeProfileInferenceRunner,
} from '@mianshitong/agent-skills';
import type {
  AssessmentSkillEvalCase,
  ReportSkillEvalCase,
  ResumeProfileEvalCase,
} from './skill-regression-fixtures';

export interface SkillRegressionEvalResult {
  caseId: string;
  description: string;
  passed: boolean;
  failures: string[];
}

function normalizeTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s._/-]+/g, '');
}

function runResumeInference(
  inference: ResumeProfileInference | null,
): ResumeProfileInferenceRunner {
  return async () => inference;
}

function runAssessmentInference(
  inference: AssessmentInference | null | 'throw',
): AssessmentInferenceRunner {
  if (inference === 'throw') {
    return async () => {
      throw new Error('simulated inference failure');
    };
  }

  return async () => inference;
}

function runReportInference(inference: ReportInference | null | 'throw'): ReportInferenceRunner {
  if (inference === 'throw') {
    return async () => {
      throw new Error('simulated inference failure');
    };
  }

  return async () => inference;
}

export async function runResumeProfileEvalCase(
  evalCase: ResumeProfileEvalCase,
): Promise<SkillRegressionEvalResult> {
  const failures: string[] = [];
  const skill = createResumeProfileSkill({
    inferProfile: runResumeInference(evalCase.inference),
  });
  const profile = await skill.execute(evalCase.input);

  if (profile.seniority !== evalCase.expectations.seniority) {
    failures.push(
      `seniority 不符合预期：实际 ${profile.seniority}，预期 ${evalCase.expectations.seniority}`,
    );
  }

  const primaryTags = profile.primaryTags.map((item) => item.tag);
  const secondaryTags = profile.secondaryTags.map((item) => item.tag);
  const projectTags = profile.projectTags;

  for (const tag of evalCase.expectations.primaryTags) {
    if (!primaryTags.includes(tag)) {
      failures.push(`primaryTags 缺失：${tag}`);
    }
  }

  for (const tag of evalCase.expectations.secondaryTags ?? []) {
    if (!secondaryTags.includes(tag)) {
      failures.push(`secondaryTags 缺失：${tag}`);
    }
  }

  for (const tag of evalCase.expectations.projectTags ?? []) {
    if (!projectTags.includes(tag)) {
      failures.push(`projectTags 缺失：${tag}`);
    }
  }

  if (
    typeof evalCase.expectations.minConfidence === 'number' &&
    profile.confidence < evalCase.expectations.minConfidence
  ) {
    failures.push(
      `confidence 低于预期：实际 ${profile.confidence}，预期至少 ${evalCase.expectations.minConfidence}`,
    );
  }

  for (const strength of evalCase.expectations.requiredStrengths ?? []) {
    if (!profile.strengths.includes(strength)) {
      failures.push(`strengths 缺失：${strength}`);
    }
  }

  for (const evidence of evalCase.expectations.requiredEvidence ?? []) {
    if (!profile.evidence.includes(evidence)) {
      failures.push(`evidence 缺失：${evidence}`);
    }
  }

  if (evalCase.expectations.requireRiskFlags && profile.riskFlags.length === 0) {
    failures.push('期望存在 riskFlags，但实际为空');
  }

  const overlap = primaryTags.filter((tag: string) =>
    secondaryTags.some((secondaryTag: string) => normalizeTag(secondaryTag) === normalizeTag(tag)),
  );
  if (overlap.length > 0) {
    failures.push(`primaryTags 与 secondaryTags 出现重叠：${overlap.join('、')}`);
  }

  return {
    caseId: evalCase.id,
    description: evalCase.description,
    passed: failures.length === 0,
    failures,
  };
}

export async function runAssessmentSkillEvalCase(
  evalCase: AssessmentSkillEvalCase,
): Promise<SkillRegressionEvalResult> {
  const failures: string[] = [];
  const skill = createAssessmentSkill({
    inferAssessment: runAssessmentInference(evalCase.inference),
  });
  const result = await skill.execute(evalCase.input);

  if (
    JSON.stringify(result.assessment.matchedPoints) !==
    JSON.stringify(evalCase.expectations.matchedPoints ?? result.assessment.matchedPoints)
  ) {
    failures.push(
      `matchedPoints 不符合预期：实际 ${result.assessment.matchedPoints.join('、')}，预期 ${(evalCase.expectations.matchedPoints ?? []).join('、')}`,
    );
  }

  if (
    JSON.stringify(result.assessment.missingPoints) !==
    JSON.stringify(evalCase.expectations.missingPoints ?? result.assessment.missingPoints)
  ) {
    failures.push(
      `missingPoints 不符合预期：实际 ${result.assessment.missingPoints.join('、')}，预期 ${(evalCase.expectations.missingPoints ?? []).join('、')}`,
    );
  }

  if (
    typeof evalCase.expectations.minAverageScore === 'number' &&
    result.trace.averageScore < evalCase.expectations.minAverageScore
  ) {
    failures.push(
      `averageScore 低于预期：实际 ${result.trace.averageScore}，预期至少 ${evalCase.expectations.minAverageScore}`,
    );
  }

  for (const text of evalCase.expectations.expectedSummaryIncludes ?? []) {
    if (!result.trace.summary.includes(text)) {
      failures.push(`summary 未包含预期文本：${text}`);
    }
  }

  for (const [dimension, minScore] of Object.entries(evalCase.expectations.minScores ?? {})) {
    const actualScore =
      result.assessment.scores[dimension as keyof typeof result.assessment.scores];
    if (actualScore < (minScore ?? 0)) {
      failures.push(`${dimension} 分数低于预期：实际 ${actualScore}，预期至少 ${minScore}`);
    }
  }

  if (result.trace.summary !== result.assessment.summary) {
    failures.push('trace.summary 与 assessment.summary 不一致');
  }

  return {
    caseId: evalCase.id,
    description: evalCase.description,
    passed: failures.length === 0,
    failures,
  };
}

export async function runReportSkillEvalCase(
  evalCase: ReportSkillEvalCase,
): Promise<SkillRegressionEvalResult> {
  const failures: string[] = [];
  const skill = createReportSkill({
    inferReport: runReportInference(evalCase.inference),
  });
  const result = await skill.execute(evalCase.input);

  if (result.report.level !== evalCase.expectations.level) {
    failures.push(
      `level 不符合预期：实际 ${result.report.level}，预期 ${evalCase.expectations.level}`,
    );
  }

  if (result.report.overallScore < evalCase.expectations.minOverallScore) {
    failures.push(
      `overallScore 低于预期：实际 ${result.report.overallScore}，预期至少 ${evalCase.expectations.minOverallScore}`,
    );
  }

  for (const strength of evalCase.expectations.requiredStrengths ?? []) {
    if (!result.report.strengths.includes(strength)) {
      failures.push(`strengths 缺失：${strength}`);
    }
  }

  for (const gap of evalCase.expectations.requiredGaps ?? []) {
    if (!result.report.gaps.includes(gap)) {
      failures.push(`gaps 缺失：${gap}`);
    }
  }

  for (const text of evalCase.expectations.expectedSummaryIncludes ?? []) {
    if (!result.report.overallSummary.includes(text)) {
      failures.push(`overallSummary 未包含预期文本：${text}`);
    }
  }

  for (const text of evalCase.expectations.expectedNextStepIncludes ?? []) {
    if (!result.report.nextSteps.some((item) => item.includes(text))) {
      failures.push(`nextSteps 未包含预期文本：${text}`);
    }
  }

  if (
    JSON.stringify(result.report.strengths) !==
    JSON.stringify(result.trace.strengths.map((item: { point: string }) => item.point))
  ) {
    failures.push('report.strengths 与 trace.strengths 不一致');
  }

  if (
    JSON.stringify(result.report.gaps) !==
    JSON.stringify(result.trace.gaps.map((item: { point: string }) => item.point))
  ) {
    failures.push('report.gaps 与 trace.gaps 不一致');
  }

  if (
    JSON.stringify(result.report.nextSteps) !==
    JSON.stringify(result.trace.nextSteps.map((item: { action: string }) => item.action))
  ) {
    failures.push('report.nextSteps 与 trace.nextSteps 不一致');
  }

  return {
    caseId: evalCase.id,
    description: evalCase.description,
    passed: failures.length === 0,
    failures,
  };
}

export async function runSkillRegressionEvalSuite(input: {
  resumeProfileCases: ResumeProfileEvalCase[];
  assessmentCases: AssessmentSkillEvalCase[];
  reportCases: ReportSkillEvalCase[];
}): Promise<SkillRegressionEvalResult[]> {
  const results: SkillRegressionEvalResult[] = [];

  for (const evalCase of input.resumeProfileCases) {
    results.push(await runResumeProfileEvalCase(evalCase));
  }

  for (const evalCase of input.assessmentCases) {
    results.push(await runAssessmentSkillEvalCase(evalCase));
  }

  for (const evalCase of input.reportCases) {
    results.push(await runReportSkillEvalCase(evalCase));
  }

  return results;
}
