import { describe, expect, test } from 'vitest';
import {
  ASSESSMENT_SKILL_EVAL_CASES,
  REPORT_SKILL_EVAL_CASES,
  RESUME_PROFILE_EVAL_CASES,
} from './skill-regression-fixtures';
import {
  runAssessmentSkillEvalCase,
  runReportSkillEvalCase,
  runResumeProfileEvalCase,
  runSkillRegressionEvalSuite,
} from './skill-regression-evals';

describe('skill regression evals', () => {
  test.for(RESUME_PROFILE_EVAL_CASES)('resume: $id', async (evalCase) => {
    const result = await runResumeProfileEvalCase(evalCase);

    expect(result.passed, result.failures.join('\n')).toBe(true);
  });

  test.for(ASSESSMENT_SKILL_EVAL_CASES)('assessment: $id', async (evalCase) => {
    const result = await runAssessmentSkillEvalCase(evalCase);

    expect(result.passed, result.failures.join('\n')).toBe(true);
  });

  test.for(REPORT_SKILL_EVAL_CASES)('report: $id', async (evalCase) => {
    const result = await runReportSkillEvalCase(evalCase);

    expect(result.passed, result.failures.join('\n')).toBe(true);
  });

  test('整套 Skill 回归基线应全部通过', async () => {
    const results = await runSkillRegressionEvalSuite({
      resumeProfileCases: RESUME_PROFILE_EVAL_CASES,
      assessmentCases: ASSESSMENT_SKILL_EVAL_CASES,
      reportCases: REPORT_SKILL_EVAL_CASES,
    });

    expect(results.every((result) => result.passed)).toBe(true);
  });
});
