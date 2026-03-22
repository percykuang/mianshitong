import { planInterviewFromSource } from '@mianshitong/interview-engine';
import type { InterviewConfig, InterviewLevel, InterviewQuestion } from '@mianshitong/shared';

export interface QuestionPlanningEvalExpectations {
  questionCount: number;
  requiredTags?: string[];
  minLevelCounts?: Partial<Record<InterviewLevel, number>>;
  maxLevelCounts?: Partial<Record<InterviewLevel, number>>;
  mustIncludeQuestionIds?: string[];
  requirePlanningTrace?: boolean;
}

export interface QuestionPlanningEvalCase {
  id: string;
  description: string;
  sourceText: string;
  config: InterviewConfig;
  questionBank: InterviewQuestion[];
  expectations: QuestionPlanningEvalExpectations;
}

export interface QuestionPlanningEvalResult {
  caseId: string;
  description: string;
  passed: boolean;
  failures: string[];
  questionPlanIds: string[];
  levelCounts: Record<InterviewLevel, number>;
  tagCounts: Record<string, number>;
  traceStepCount: number;
}

function normalizeTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s._/-]+/g, '');
}

function countLevels(questionPlan: InterviewQuestion[]): Record<InterviewLevel, number> {
  return questionPlan.reduce<Record<InterviewLevel, number>>(
    (counts, question) => {
      counts[question.level] += 1;
      return counts;
    },
    { junior: 0, mid: 0, senior: 0 },
  );
}

function countTags(questionPlan: InterviewQuestion[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const question of questionPlan) {
    for (const tag of question.tags.map(normalizeTag)) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }

  return counts;
}

function validateExpectations(input: {
  evalCase: QuestionPlanningEvalCase;
  questionPlan: InterviewQuestion[];
  planningTraceStepCount: number;
}): QuestionPlanningEvalResult {
  const failures: string[] = [];
  const levelCounts = countLevels(input.questionPlan);
  const tagCounts = countTags(input.questionPlan);
  const questionPlanIds = input.questionPlan.map((question) => question.id);

  if (input.questionPlan.length !== input.evalCase.expectations.questionCount) {
    failures.push(
      `题目数量不符合预期：实际 ${input.questionPlan.length}，预期 ${input.evalCase.expectations.questionCount}`,
    );
  }

  for (const tag of input.evalCase.expectations.requiredTags ?? []) {
    if (!tagCounts[normalizeTag(tag)]) {
      failures.push(`题单未覆盖必需标签：${tag}`);
    }
  }

  for (const [level, count] of Object.entries(input.evalCase.expectations.minLevelCounts ?? {})) {
    if (levelCounts[level as InterviewLevel] < (count ?? 0)) {
      failures.push(
        `题单 ${level} 难度数量不足：实际 ${levelCounts[level as InterviewLevel]}，预期至少 ${count}`,
      );
    }
  }

  for (const [level, count] of Object.entries(input.evalCase.expectations.maxLevelCounts ?? {})) {
    if (levelCounts[level as InterviewLevel] > (count ?? Number.MAX_SAFE_INTEGER)) {
      failures.push(
        `题单 ${level} 难度数量超出预期：实际 ${levelCounts[level as InterviewLevel]}，预期最多 ${count}`,
      );
    }
  }

  for (const questionId of input.evalCase.expectations.mustIncludeQuestionIds ?? []) {
    if (!questionPlanIds.includes(questionId)) {
      failures.push(`题单未命中关键题目：${questionId}`);
    }
  }

  if (input.evalCase.expectations.requirePlanningTrace && input.planningTraceStepCount === 0) {
    failures.push('规划 trace 缺失');
  }

  if (
    input.evalCase.expectations.requirePlanningTrace &&
    input.planningTraceStepCount !== input.questionPlan.length
  ) {
    failures.push(
      `规划 trace 步数异常：实际 ${input.planningTraceStepCount}，应与题目数量 ${input.questionPlan.length} 一致`,
    );
  }

  return {
    caseId: input.evalCase.id,
    description: input.evalCase.description,
    passed: failures.length === 0,
    failures,
    questionPlanIds,
    levelCounts,
    tagCounts,
    traceStepCount: input.planningTraceStepCount,
  };
}

export async function runQuestionPlanningEvalCase(
  evalCase: QuestionPlanningEvalCase,
): Promise<QuestionPlanningEvalResult> {
  const planningResult = await planInterviewFromSource({
    sourceText: evalCase.sourceText,
    config: evalCase.config,
    questionBank: evalCase.questionBank,
    threadId: `eval:${evalCase.id}`,
  });

  return validateExpectations({
    evalCase,
    questionPlan: planningResult.questionPlan,
    planningTraceStepCount: planningResult.planningTrace.steps.length,
  });
}

export async function runQuestionPlanningEvalSuite(
  evalCases: QuestionPlanningEvalCase[],
): Promise<QuestionPlanningEvalResult[]> {
  const results: QuestionPlanningEvalResult[] = [];

  for (const evalCase of evalCases) {
    results.push(await runQuestionPlanningEvalCase(evalCase));
  }

  return results;
}
