import { describe, expect, test } from 'vitest';
import {
  KNOWLEDGE_ANSWER_EVAL_CASES,
  KNOWLEDGE_RETRIEVAL_EVAL_CASES,
} from './knowledge-rag-fixtures';
import {
  runKnowledgeAnswerEvalCase,
  runKnowledgeAnswerEvalSuite,
  runKnowledgeRetrievalEvalCase,
  runKnowledgeRetrievalEvalSuite,
} from './knowledge-rag-evals';

describe('knowledge rag evals', () => {
  test.for(KNOWLEDGE_RETRIEVAL_EVAL_CASES)('retrieval: $id', (evalCase) => {
    const result = runKnowledgeRetrievalEvalCase(evalCase);

    expect(result.passed, result.failures.join('\n')).toBe(true);
  });

  test.for(KNOWLEDGE_ANSWER_EVAL_CASES)('answer: $id', (evalCase) => {
    const result = runKnowledgeAnswerEvalCase(evalCase);

    expect(result.passed, result.failures.join('\n')).toBe(true);
  });

  test('整套知识库检索评测应全部通过', () => {
    const results = runKnowledgeRetrievalEvalSuite(KNOWLEDGE_RETRIEVAL_EVAL_CASES);

    expect(results.every((result) => result.passed)).toBe(true);
  });

  test('整套知识库回答评测应全部通过', () => {
    const results = runKnowledgeAnswerEvalSuite(KNOWLEDGE_ANSWER_EVAL_CASES);

    expect(results.every((result) => result.passed)).toBe(true);
  });
});
