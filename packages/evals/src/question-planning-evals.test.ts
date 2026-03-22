import { describe, expect, test } from 'vitest';
import { QUESTION_PLANNING_EVAL_CASES } from './question-planning-fixtures';
import {
  runQuestionPlanningEvalCase,
  runQuestionPlanningEvalSuite,
} from './question-planning-evals';

describe('question planning evals', () => {
  test.for(QUESTION_PLANNING_EVAL_CASES)('$id', async (evalCase) => {
    const result = await runQuestionPlanningEvalCase(evalCase);

    expect(result.passed, result.failures.join('\n')).toBe(true);
  });

  test('整套评测应全部通过', async () => {
    const results = await runQuestionPlanningEvalSuite(QUESTION_PLANNING_EVAL_CASES);

    expect(results.every((result) => result.passed)).toBe(true);
  });
});
