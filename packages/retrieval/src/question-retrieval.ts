import type { InterviewLevel, InterviewQuestion, WeightedTag } from '@mianshitong/shared';

const LEVEL_WEIGHT: Record<InterviewLevel, number> = {
  junior: 1,
  mid: 2,
  senior: 3,
};

const LATIN_TOKEN_PATTERN = /[a-z0-9+#.]{2,}/g;
const CJK_SEGMENT_PATTERN = /[\u4e00-\u9fff]{2,}/g;

export interface QuestionRetrievalDoc {
  id: string;
  level: InterviewLevel;
  tags: string[];
  normalizedTags: string[];
  searchText: string;
  tokens: string[];
  order: number | null;
  question: InterviewQuestion;
}

export interface QuestionRetrievalSource {
  title: string;
  prompt?: string | null;
  answer?: string | null;
  keyPoints?: string[];
  followUps?: string[];
  tags: string[];
}

export interface QuestionRetrievalQuery {
  queryText?: string;
  targetLevel?: InterviewLevel | null;
  allowedLevels?: InterviewLevel[];
  preferredTags?: WeightedTag[];
  mustIncludeTags?: string[];
  optionalTags?: string[];
  excludeQuestionIds?: string[];
  limit?: number;
}

export interface QuestionRetrievalScoreBreakdown {
  semantic: number;
  lexical: number;
  tag: number;
  mustInclude: number;
  optional: number;
  level: number;
  penalty: number;
}

export interface QuestionRetrievalResult {
  doc: QuestionRetrievalDoc;
  score: number;
  matchedTags: string[];
  matchedMustIncludeTags: string[];
  matchedOptionalTags: string[];
  lexicalOverlap: string[];
  breakdown: QuestionRetrievalScoreBreakdown;
}

export interface QuestionRetriever {
  search(query: QuestionRetrievalQuery): Promise<QuestionRetrievalResult[]>;
}

export interface CreateLexicalQuestionRetrieverInput {
  questionBank?: InterviewQuestion[];
  docs?: QuestionRetrievalDoc[];
}

export interface SearchQuestionDocsInput {
  docs: QuestionRetrievalDoc[];
  query: QuestionRetrievalQuery;
  semanticScoresByQuestionId?: ReadonlyMap<string, number>;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeQuestionRetrievalTag(value: string): string {
  return normalizeText(value).replace(/[\s._/-]+/g, '');
}

function tokenizeForRetrieval(value: string): string[] {
  const normalized = normalizeText(value);
  const tokens = new Set<string>();

  for (const matched of normalized.matchAll(LATIN_TOKEN_PATTERN)) {
    const token = matched[0];
    tokens.add(token);
    tokens.add(token.replace(/[._/-]+/g, ''));
  }

  for (const matched of normalized.matchAll(CJK_SEGMENT_PATTERN)) {
    const segment = matched[0];
    tokens.add(segment);

    for (let index = 0; index < segment.length - 1; index += 1) {
      tokens.add(segment.slice(index, index + 2));
    }
  }

  tokens.delete('');
  return [...tokens];
}

function buildQuerySearchText(query: QuestionRetrievalQuery): string {
  return [
    query.queryText,
    ...(query.preferredTags ?? []).map((item) => item.tag),
    ...(query.mustIncludeTags ?? []),
    ...(query.optionalTags ?? []),
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildQuestionRetrievalSearchText(question: QuestionRetrievalSource): string {
  return [
    question.title,
    question.prompt,
    question.answer,
    ...(question.keyPoints ?? []),
    ...(question.followUps ?? []),
    ...question.tags,
  ]
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .join('\n');
}

function scoreLevelMatch(
  targetLevel: InterviewLevel | null | undefined,
  questionLevel: InterviewLevel,
): number {
  if (!targetLevel) {
    return 0;
  }

  const distance = Math.abs(LEVEL_WEIGHT[targetLevel] - LEVEL_WEIGHT[questionLevel]);
  if (distance === 0) {
    return 3.2;
  }

  if (distance === 1) {
    return 1.4;
  }

  return -0.8;
}

function getTagScore(
  normalizedQuestionTags: Set<string>,
  preferredTags: WeightedTag[],
): { matchedTags: string[]; score: number } {
  const matchedTags: string[] = [];
  let score = 0;

  for (const item of preferredTags) {
    const normalizedTag = normalizeQuestionRetrievalTag(item.tag);
    if (!normalizedTag || !normalizedQuestionTags.has(normalizedTag)) {
      continue;
    }

    matchedTags.push(normalizedTag);
    score += Math.max(0.5, item.weight) * 4.5;
  }

  return { matchedTags, score };
}

function getLexicalScore(questionTokens: Set<string>, queryTokens: Set<string>) {
  const lexicalOverlap = [...queryTokens].filter((token) => questionTokens.has(token));
  if (queryTokens.size === 0 || lexicalOverlap.length === 0) {
    return { lexicalOverlap, score: 0 };
  }

  const ratio = lexicalOverlap.length / queryTokens.size;
  const score = Math.min(4.2, ratio * 4 + lexicalOverlap.length * 0.12);

  return { lexicalOverlap, score };
}

function compareResults(left: QuestionRetrievalResult, right: QuestionRetrievalResult): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (right.matchedMustIncludeTags.length !== left.matchedMustIncludeTags.length) {
    return right.matchedMustIncludeTags.length - left.matchedMustIncludeTags.length;
  }

  if (right.matchedTags.length !== left.matchedTags.length) {
    return right.matchedTags.length - left.matchedTags.length;
  }

  const leftOrder = left.doc.order ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.doc.order ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.doc.id.localeCompare(right.doc.id);
}

export function buildQuestionRetrievalDocs(
  questionBank: InterviewQuestion[],
): QuestionRetrievalDoc[] {
  return questionBank.map((question) => {
    const searchText = buildQuestionRetrievalSearchText(question);

    return {
      id: question.id,
      level: question.level,
      tags: [...question.tags],
      normalizedTags: [
        ...new Set(question.tags.map(normalizeQuestionRetrievalTag).filter(Boolean)),
      ],
      searchText,
      tokens: tokenizeForRetrieval(searchText),
      order: question.order ?? null,
      question,
    };
  });
}

export function searchQuestionDocs(input: SearchQuestionDocsInput): QuestionRetrievalResult[] {
  const preferredTags = input.query.preferredTags ?? [];
  const mustIncludeTags = [
    ...new Set((input.query.mustIncludeTags ?? []).map(normalizeQuestionRetrievalTag)),
  ];
  const optionalTags = [
    ...new Set((input.query.optionalTags ?? []).map(normalizeQuestionRetrievalTag)),
  ];
  const excludedIds = new Set(input.query.excludeQuestionIds ?? []);
  const allowedLevels =
    input.query.allowedLevels && input.query.allowedLevels.length > 0
      ? new Set(input.query.allowedLevels)
      : null;
  const queryTokens = new Set(tokenizeForRetrieval(buildQuerySearchText(input.query)));

  const results = input.docs
    .filter((doc) => !excludedIds.has(doc.id))
    .filter((doc) => (allowedLevels ? allowedLevels.has(doc.level) : true))
    .map<QuestionRetrievalResult>((doc) => {
      const normalizedQuestionTags = new Set(doc.normalizedTags);
      const { matchedTags, score: tagScore } = getTagScore(normalizedQuestionTags, preferredTags);
      const matchedMustIncludeTags = mustIncludeTags.filter((tag) =>
        normalizedQuestionTags.has(tag),
      );
      const matchedOptionalTags = optionalTags.filter((tag) => normalizedQuestionTags.has(tag));
      const { lexicalOverlap, score: lexicalScore } = getLexicalScore(
        new Set(doc.tokens),
        queryTokens,
      );
      const semanticScore = input.semanticScoresByQuestionId?.get(doc.id) ?? 0;
      const levelScore = scoreLevelMatch(input.query.targetLevel, doc.level);
      const mustIncludeScore = matchedMustIncludeTags.length * 5.4;
      const optionalScore = matchedOptionalTags.length * 1.1;
      const penalty = preferredTags.length > 0 && matchedTags.length === 0 ? -0.8 : 0;
      const score =
        semanticScore +
        lexicalScore +
        tagScore +
        mustIncludeScore +
        optionalScore +
        levelScore +
        penalty;

      return {
        doc,
        score,
        matchedTags,
        matchedMustIncludeTags,
        matchedOptionalTags,
        lexicalOverlap,
        breakdown: {
          semantic: semanticScore,
          lexical: lexicalScore,
          tag: tagScore,
          mustInclude: mustIncludeScore,
          optional: optionalScore,
          level: levelScore,
          penalty,
        },
      };
    })
    .sort(compareResults);

  return results.slice(0, input.query.limit ?? 20);
}

export function createLexicalQuestionRetriever(
  input: CreateLexicalQuestionRetrieverInput,
): QuestionRetriever {
  const docs = input.docs ?? buildQuestionRetrievalDocs(input.questionBank ?? []);

  return {
    async search(query) {
      return searchQuestionDocs({ docs, query });
    },
  };
}

export { buildQuerySearchText };
