import {
  buildKnowledgeDocumentChunks,
  resolveKnowledgeDocumentHitMode,
  searchKnowledgeDocumentChunks,
  tokenizeKnowledgeRetrievalText,
  type SearchableKnowledgeDocumentChunk,
} from '@mianshitong/retrieval';
import type { KnowledgeAnswerEvalCase, KnowledgeRetrievalEvalCase } from './knowledge-rag-fixtures';

export interface KnowledgeRetrievalEvalResult {
  caseId: string;
  description: string;
  passed: boolean;
  failures: string[];
  resultDocumentTitles: string[];
  mode: 'strong' | 'weak' | 'none';
  topResultTitle: string | null;
  topResultHeadingPath: string[];
  topScore: number | null;
}

export interface KnowledgeAnswerEvalResult {
  caseId: string;
  description: string;
  passed: boolean;
  failures: string[];
  coveredRequiredPhrases: string[];
  forbiddenPhrasesFound: string[];
  baselineCoveredRequiredPhrases: string[];
  knowledgeCoverageGain: number;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function includesPhrase(text: string, phrase: string): boolean {
  return normalizeText(text).includes(normalizeText(phrase));
}

function buildSearchableChunks(
  evalCase: KnowledgeRetrievalEvalCase,
): SearchableKnowledgeDocumentChunk[] {
  return evalCase.documents.flatMap((document) =>
    buildKnowledgeDocumentChunks(document).map((chunk) => ({
      id: `${document.documentId}:${chunk.chunkOrder}`,
      documentId: document.documentId,
      title: document.title,
      category: document.category,
      contentShape: chunk.contentShape,
      chunkOrder: chunk.chunkOrder,
      headingPath: [...chunk.headingPath],
      headingText: chunk.headingText,
      content: chunk.content,
      searchText: chunk.searchText,
      tags: [...chunk.tags],
      normalizedTags: [...chunk.normalizedTags],
      tokens: tokenizeKnowledgeRetrievalText(chunk.searchText),
    })),
  );
}

export function runKnowledgeRetrievalEvalCase(
  evalCase: KnowledgeRetrievalEvalCase,
): KnowledgeRetrievalEvalResult {
  const failures: string[] = [];
  const results = searchKnowledgeDocumentChunks({
    chunks: buildSearchableChunks(evalCase),
    query: {
      queryText: evalCase.query.text,
      categories: evalCase.query.categories,
      preferredTags: evalCase.query.preferredTags,
      limit: evalCase.query.limit,
    },
  });

  const topResult = results[0];
  const mode = resolveKnowledgeDocumentHitMode(results);
  const resultDocumentTitles = results.map((result) => result.chunk.title);

  if (evalCase.expectations.expectedMode && mode !== evalCase.expectations.expectedMode) {
    failures.push(`命中模式不符合预期：实际 ${mode}，预期 ${evalCase.expectations.expectedMode}`);
  }

  if (
    evalCase.expectations.expectedTopDocumentTitle &&
    topResult?.chunk.title !== evalCase.expectations.expectedTopDocumentTitle
  ) {
    failures.push(
      `Top1 文档不符合预期：实际 ${topResult?.chunk.title ?? '空'}，预期 ${evalCase.expectations.expectedTopDocumentTitle}`,
    );
  }

  if (
    evalCase.expectations.expectedTopHeadingIncludes &&
    !topResult?.chunk.headingPath
      .join(' > ')
      .includes(evalCase.expectations.expectedTopHeadingIncludes)
  ) {
    failures.push(
      `Top1 标题路径未包含预期文本：${evalCase.expectations.expectedTopHeadingIncludes}`,
    );
  }

  for (const title of evalCase.expectations.requiredDocumentTitlesInTopK ?? []) {
    if (!resultDocumentTitles.includes(title)) {
      failures.push(`TopK 未命中文档：${title}`);
    }
  }

  for (const title of evalCase.expectations.excludedDocumentTitlesInTopK ?? []) {
    if (resultDocumentTitles.includes(title)) {
      failures.push(`TopK 出现了不应命中的文档：${title}`);
    }
  }

  if (
    typeof evalCase.expectations.minTopScore === 'number' &&
    (topResult?.score ?? Number.NEGATIVE_INFINITY) < evalCase.expectations.minTopScore
  ) {
    failures.push(
      `Top1 分数低于预期：实际 ${topResult?.score ?? '空'}，预期至少 ${evalCase.expectations.minTopScore}`,
    );
  }

  if (
    typeof evalCase.expectations.maxTopScore === 'number' &&
    (topResult?.score ?? Number.POSITIVE_INFINITY) > evalCase.expectations.maxTopScore
  ) {
    failures.push(
      `Top1 分数高于预期：实际 ${topResult?.score ?? '空'}，预期最多 ${evalCase.expectations.maxTopScore}`,
    );
  }

  if (
    typeof evalCase.expectations.minResultCount === 'number' &&
    results.length < evalCase.expectations.minResultCount
  ) {
    failures.push(
      `结果数量低于预期：实际 ${results.length}，预期至少 ${evalCase.expectations.minResultCount}`,
    );
  }

  if (
    typeof evalCase.expectations.expectedResultCount === 'number' &&
    results.length !== evalCase.expectations.expectedResultCount
  ) {
    failures.push(
      `结果数量不符合预期：实际 ${results.length}，预期 ${evalCase.expectations.expectedResultCount}`,
    );
  }

  return {
    caseId: evalCase.id,
    description: evalCase.description,
    passed: failures.length === 0,
    failures,
    resultDocumentTitles,
    mode,
    topResultTitle: topResult?.chunk.title ?? null,
    topResultHeadingPath: [...(topResult?.chunk.headingPath ?? [])],
    topScore: topResult?.score ?? null,
  };
}

export function runKnowledgeRetrievalEvalSuite(
  evalCases: KnowledgeRetrievalEvalCase[],
): KnowledgeRetrievalEvalResult[] {
  return evalCases.map((evalCase) => runKnowledgeRetrievalEvalCase(evalCase));
}

export function runKnowledgeAnswerEvalCase(
  evalCase: KnowledgeAnswerEvalCase,
): KnowledgeAnswerEvalResult {
  const failures: string[] = [];
  const requiredPhrases = evalCase.expectations.requiredPhrases ?? [];
  const forbiddenPhrases = evalCase.expectations.forbiddenPhrases ?? [];
  const coveredRequiredPhrases = requiredPhrases.filter((phrase) =>
    includesPhrase(evalCase.answer, phrase),
  );
  const forbiddenPhrasesFound = forbiddenPhrases.filter((phrase) =>
    includesPhrase(evalCase.answer, phrase),
  );
  const baselineCoveredRequiredPhrases = evalCase.baselineAnswer
    ? requiredPhrases.filter((phrase) => includesPhrase(evalCase.baselineAnswer!, phrase))
    : [];
  const knowledgeCoverageGain =
    coveredRequiredPhrases.length - baselineCoveredRequiredPhrases.length;

  for (const phrase of requiredPhrases) {
    if (!coveredRequiredPhrases.includes(phrase)) {
      failures.push(`回答未覆盖关键事实：${phrase}`);
    }
  }

  if (
    typeof evalCase.expectations.minCoveredPhraseCount === 'number' &&
    coveredRequiredPhrases.length < evalCase.expectations.minCoveredPhraseCount
  ) {
    failures.push(
      `回答覆盖关键事实数量不足：实际 ${coveredRequiredPhrases.length}，预期至少 ${evalCase.expectations.minCoveredPhraseCount}`,
    );
  }

  for (const phrase of forbiddenPhrasesFound) {
    failures.push(`回答包含禁用结论：${phrase}`);
  }

  if (
    evalCase.expectations.requireDifferentFromBaseline &&
    evalCase.baselineAnswer &&
    normalizeText(evalCase.answer) === normalizeText(evalCase.baselineAnswer)
  ) {
    failures.push('知识增强回答与无知识基线完全一致');
  }

  if (
    typeof evalCase.expectations.minKnowledgeCoverageGain === 'number' &&
    knowledgeCoverageGain < evalCase.expectations.minKnowledgeCoverageGain
  ) {
    failures.push(
      `知识覆盖增益不足：实际 ${knowledgeCoverageGain}，预期至少 ${evalCase.expectations.minKnowledgeCoverageGain}`,
    );
  }

  return {
    caseId: evalCase.id,
    description: evalCase.description,
    passed: failures.length === 0,
    failures,
    coveredRequiredPhrases,
    forbiddenPhrasesFound,
    baselineCoveredRequiredPhrases,
    knowledgeCoverageGain,
  };
}

export function runKnowledgeAnswerEvalSuite(
  evalCases: KnowledgeAnswerEvalCase[],
): KnowledgeAnswerEvalResult[] {
  return evalCases.map((evalCase) => runKnowledgeAnswerEvalCase(evalCase));
}
