import { describe, expect, test } from 'vitest';
import { REPORT_TRACE_EVAL_CASES } from './report-trace-fixtures';
import { runReportTraceEvalCase, runReportTraceEvalSuite } from './report-trace-evals';

describe('report trace evals', () => {
  test.for(REPORT_TRACE_EVAL_CASES)('$id', (evalCase) => {
    const result = runReportTraceEvalCase(evalCase);

    expect(result.passed, result.failures.join('\n')).toBe(true);
  });

  test('整套评测应全部通过', () => {
    const results = runReportTraceEvalSuite(REPORT_TRACE_EVAL_CASES);

    expect(results.every((result) => result.passed)).toBe(true);
  });
});
