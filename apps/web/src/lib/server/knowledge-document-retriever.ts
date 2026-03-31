import { createHash } from 'node:crypto';
import { prisma } from '@mianshitong/db';
import {
  resolveKnowledgeDocumentHitMode,
  searchKnowledgeDocumentChunks,
  tokenizeKnowledgeRetrievalText,
  type KnowledgeDocumentCategory,
  type KnowledgeDocumentContentShape,
  type KnowledgeDocumentHitMode,
  type SearchableKnowledgeDocumentChunk,
} from '@mianshitong/retrieval';
import {
  mergeKnowledgeRetrievalTraceEntries,
  normalizeKnowledgeTracePreferredTags,
  type ChatSession,
  type KnowledgeRetrievalTraceEntry,
} from '@mianshitong/shared';
import { resolveGeneralChatIntent, type GeneralChatIntent } from '@/lib/server/chat-general-policy';
import type { KnowledgeDocumentContext } from './knowledge-document-context';

const DEFAULT_KNOWLEDGE_RETRIEVAL_RESULT_LIMIT = 4;
const INTERVIEW_PLAYBOOK_RESULT_LIMIT = 8;
const INTERVIEW_PLAYBOOK_CONTEXT_CHAR_BUDGET = 3600;
const KNOWLEDGE_RETRIEVAL_QUERY_PREVIEW_LIMIT = 120;
const KNOWLEDGE_DOCUMENT_CACHE_TTL_MS = 15_000;

let searchableKnowledgeChunksCache: {
  expiresAt: number;
  chunks: SearchableKnowledgeDocumentChunk[];
} | null = null;

type KnowledgeSearchResult = ReturnType<typeof searchKnowledgeDocumentChunks>;
type KnowledgeRetrievalIntent = Extract<
  GeneralChatIntent,
  {
    kind:
      | 'resume_optimize'
      | 'self_intro'
      | 'project_highlight'
      | 'technical_question'
      | 'interview_playbook';
  }
>;

function isKnowledgeRetrievalIntent(
  intent: GeneralChatIntent | null,
): intent is KnowledgeRetrievalIntent {
  return (
    intent?.kind === 'technical_question' ||
    intent?.kind === 'interview_playbook' ||
    intent?.kind === 'project_highlight' ||
    intent?.kind === 'resume_optimize' ||
    intent?.kind === 'self_intro'
  );
}

function resolveKnowledgeCategories(
  intent: GeneralChatIntent | null,
): KnowledgeDocumentCategory[] | null {
  if (!intent) {
    return null;
  }

  if (intent.kind === 'technical_question') {
    return ['tech_knowledge', 'interview_playbook'];
  }

  if (intent.kind === 'interview_playbook') {
    return ['interview_playbook'];
  }

  if (intent.kind === 'project_highlight' || intent.kind === 'resume_optimize') {
    return ['project_resume', 'interview_playbook'];
  }

  if (intent.kind === 'self_intro') {
    return ['interview_playbook', 'project_resume'];
  }

  return null;
}

function resolvePreferredTags(intent: GeneralChatIntent | null, content: string): string[] {
  const baseTags = tokenizeKnowledgeRetrievalText(content).filter((token) => token.length >= 2);
  if (intent?.kind === 'technical_question') {
    return [...new Set(baseTags.concat(['前端', 'frontend']))];
  }

  if (intent?.kind === 'interview_playbook') {
    return [...new Set(baseTags.concat(['面试']))];
  }

  if (intent?.kind === 'project_highlight' || intent?.kind === 'resume_optimize') {
    return [...new Set(baseTags.concat(['项目', '简历']))];
  }

  if (intent?.kind === 'self_intro') {
    return [...new Set(baseTags.concat(['面试', '自我介绍']))];
  }

  return [...new Set(baseTags)];
}

export interface KnowledgeRetrievalPlan {
  categories: KnowledgeDocumentCategory[];
  preferredTags: string[];
  resultLimit: number;
}

export interface ResolvedKnowledgeDocumentContextResult {
  context: KnowledgeDocumentContext;
  trace: KnowledgeRetrievalTraceEntry;
}

function estimateKnowledgeContextEntrySize(chunk: SearchableKnowledgeDocumentChunk): number {
  return chunk.content.length + chunk.title.length + chunk.headingPath.join(' > ').length + 96;
}

function selectTopDocumentForOrderedExpansion(results: KnowledgeSearchResult): string | null {
  const aggregates = new Map<
    string,
    { score: number; matchedCount: number; bestScore: number; firstRank: number }
  >();

  for (const [index, result] of results.entries()) {
    const current = aggregates.get(result.chunk.documentId);
    const weightedScore = result.score * (index === 0 ? 1 : index === 1 ? 0.72 : 0.5);

    if (!current) {
      aggregates.set(result.chunk.documentId, {
        score: weightedScore,
        matchedCount: 1,
        bestScore: result.score,
        firstRank: index,
      });
      continue;
    }

    current.score += weightedScore;
    current.matchedCount += 1;
    current.bestScore = Math.max(current.bestScore, result.score);
  }

  const ranked = [...aggregates.entries()].sort((left, right) => {
    const [, leftMeta] = left;
    const [, rightMeta] = right;

    if (rightMeta.score !== leftMeta.score) {
      return rightMeta.score - leftMeta.score;
    }

    if (rightMeta.bestScore !== leftMeta.bestScore) {
      return rightMeta.bestScore - leftMeta.bestScore;
    }

    if (rightMeta.matchedCount !== leftMeta.matchedCount) {
      return rightMeta.matchedCount - leftMeta.matchedCount;
    }

    return leftMeta.firstRank - rightMeta.firstRank;
  });

  return ranked[0]?.[0] ?? null;
}

function expandResultsInDocumentOrder(input: {
  searchableChunks: SearchableKnowledgeDocumentChunk[];
  rankedResults: KnowledgeSearchResult;
  documentId: string;
  maxCharacters: number;
}): KnowledgeSearchResult {
  const rankedResultMap = new Map(
    input.rankedResults.map((result) => [result.chunk.id, result] as const),
  );
  const orderedChunks = input.searchableChunks
    .filter((chunk) => chunk.documentId === input.documentId)
    .sort((left, right) => left.chunkOrder - right.chunkOrder);

  const expanded: KnowledgeSearchResult = [];
  let usedCharacters = 0;

  for (const chunk of orderedChunks) {
    const ranked = rankedResultMap.get(chunk.id);
    const entrySize = estimateKnowledgeContextEntrySize(chunk);

    if (expanded.length > 0 && usedCharacters + entrySize > input.maxCharacters) {
      break;
    }

    expanded.push(
      ranked ?? {
        chunk,
        score: 0,
        lexicalOverlap: [],
        matchedTags: [],
        breakdown: {
          lexical: 0,
          heading: 0,
          tag: 0,
          penalty: 0,
        },
      },
    );
    usedCharacters += entrySize;
  }

  return expanded;
}

export function selectKnowledgeSearchResultsForContext(input: {
  searchableChunks: SearchableKnowledgeDocumentChunk[];
  rankedResults: KnowledgeSearchResult;
  resultLimit: number;
}): KnowledgeSearchResult {
  const topResult = input.rankedResults[0];
  if (!topResult || topResult.chunk.contentShape !== 'process') {
    return input.rankedResults.slice(0, input.resultLimit);
  }

  const processResults = input.rankedResults.filter(
    (result) => result.chunk.contentShape === 'process',
  );
  const topDocumentId = selectTopDocumentForOrderedExpansion(processResults);
  if (!topDocumentId) {
    return [];
  }

  return expandResultsInDocumentOrder({
    searchableChunks: input.searchableChunks,
    rankedResults: input.rankedResults,
    documentId: topDocumentId,
    maxCharacters: INTERVIEW_PLAYBOOK_CONTEXT_CHAR_BUDGET,
  });
}

export function resolveKnowledgeRetrievalPlan(input: {
  intent: GeneralChatIntent | null;
  content: string;
}): KnowledgeRetrievalPlan | null {
  const categories = resolveKnowledgeCategories(input.intent);
  if (!categories || categories.length === 0) {
    return null;
  }

  return {
    categories,
    preferredTags: resolvePreferredTags(input.intent, input.content),
    resultLimit:
      input.intent?.kind === 'interview_playbook'
        ? INTERVIEW_PLAYBOOK_RESULT_LIMIT
        : DEFAULT_KNOWLEDGE_RETRIEVAL_RESULT_LIMIT,
  };
}

export function buildKnowledgeDocumentContextFromResults(input: {
  mode: KnowledgeDocumentHitMode;
  results: KnowledgeSearchResult;
}): KnowledgeDocumentContext {
  if (input.mode === 'none') {
    return { mode: 'none', entries: [] };
  }

  return {
    mode: input.mode,
    entries: input.results.map((result) => ({
      documentId: result.chunk.documentId,
      documentTitle: result.chunk.title,
      category: result.chunk.category,
      contentShape: result.chunk.contentShape,
      headingPath: [...result.chunk.headingPath],
      content: result.chunk.content,
      score: result.score,
    })),
  };
}

export function buildKnowledgeTraceQueryPreview(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= KNOWLEDGE_RETRIEVAL_QUERY_PREVIEW_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, KNOWLEDGE_RETRIEVAL_QUERY_PREVIEW_LIMIT - 1)}...`;
}

export function buildKnowledgeTraceQueryHash(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim().toLowerCase();
  return createHash('sha256').update(normalized).digest('hex');
}

export function buildKnowledgeRetrievalTraceEntry(input: {
  intent: KnowledgeRetrievalIntent;
  content: string;
  plan: KnowledgeRetrievalPlan;
  mode: KnowledgeDocumentHitMode;
  results: KnowledgeSearchResult;
  now?: string;
}): KnowledgeRetrievalTraceEntry {
  return {
    createdAt: input.now ?? new Date().toISOString(),
    intentKind: input.intent.kind,
    mode: input.mode,
    categories: [...input.plan.categories],
    preferredTags: normalizeKnowledgeTracePreferredTags(
      input.plan.preferredTags,
      input.intent.kind,
    ),
    queryHash: buildKnowledgeTraceQueryHash(input.content),
    queryPreview: buildKnowledgeTraceQueryPreview(input.content),
    results: input.results.map((result) => ({
      documentId: result.chunk.documentId,
      documentTitle: result.chunk.title,
      category: result.chunk.category,
      headingPath: [...result.chunk.headingPath],
      score: Math.round(result.score * 1000) / 1000,
    })),
  };
}

export function appendKnowledgeRetrievalTrace(
  session: ChatSession,
  trace: KnowledgeRetrievalTraceEntry | null,
): ChatSession {
  if (!trace) {
    return session;
  }

  const currentTrace = session.runtime.knowledgeRetrievalTrace ?? [];

  return {
    ...session,
    runtime: {
      ...session.runtime,
      knowledgeRetrievalTrace: mergeKnowledgeRetrievalTraceEntries(currentTrace, [trace]),
    },
  };
}

export function trimKnowledgeRetrievalTraceForEditedMessage(
  session: ChatSession,
  messageId: string,
): ChatSession {
  const targetIndex = session.messages.findIndex(
    (message) => message.id === messageId && message.role === 'user',
  );
  if (targetIndex < 0) {
    return session;
  }

  const targetMessage = session.messages[targetIndex];
  if (!targetMessage) {
    return session;
  }

  const userMessageCountBefore = session.messages
    .slice(0, targetIndex)
    .filter((message) => message.role === 'user').length;
  const intent = resolveGeneralChatIntent({
    content: targetMessage.content,
    userMessageCount: userMessageCountBefore,
  });

  if (!isKnowledgeRetrievalIntent(intent)) {
    return session;
  }

  const currentTrace = session.runtime.knowledgeRetrievalTrace ?? [];
  if (currentTrace.length === 0) {
    return session;
  }

  return {
    ...session,
    runtime: {
      ...session.runtime,
      knowledgeRetrievalTrace: currentTrace.slice(0, -1),
    },
  };
}

async function listPublishedSearchableKnowledgeChunks(): Promise<
  SearchableKnowledgeDocumentChunk[]
> {
  const now = Date.now();
  if (searchableKnowledgeChunksCache && searchableKnowledgeChunksCache.expiresAt > now) {
    return searchableKnowledgeChunksCache.chunks;
  }

  const chunks = await prisma.knowledgeDocumentChunk.findMany({
    where: {
      document: {
        isPublished: true,
      },
    },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          category: true,
          contentShape: true,
        },
      },
    },
    orderBy: [{ document: { updatedAt: 'desc' } }, { chunkOrder: 'asc' }],
  });

  const searchableChunks = chunks.map((chunk) => ({
    id: chunk.id,
    documentId: chunk.documentId,
    title: chunk.document.title,
    category: chunk.document.category as KnowledgeDocumentCategory,
    contentShape: chunk.document.contentShape as KnowledgeDocumentContentShape,
    chunkOrder: chunk.chunkOrder,
    headingPath: [...chunk.headingPath],
    headingText: chunk.headingText,
    content: chunk.content,
    searchText: chunk.searchText,
    tags: [...chunk.tags],
    normalizedTags: [...chunk.normalizedTags],
    tokens: tokenizeKnowledgeRetrievalText(chunk.searchText),
  }));

  searchableKnowledgeChunksCache = {
    expiresAt: now + KNOWLEDGE_DOCUMENT_CACHE_TTL_MS,
    chunks: searchableChunks,
  };

  return searchableChunks;
}

export async function resolveKnowledgeDocumentContext(input: {
  intent: GeneralChatIntent | null;
  content: string;
}): Promise<ResolvedKnowledgeDocumentContextResult | null> {
  const plan = resolveKnowledgeRetrievalPlan(input);
  if (!plan || !isKnowledgeRetrievalIntent(input.intent)) {
    return null;
  }

  const searchableChunks = await listPublishedSearchableKnowledgeChunks();

  const rankedResults =
    searchableChunks.length === 0
      ? []
      : searchKnowledgeDocumentChunks({
          chunks: searchableChunks,
          query: {
            queryText: input.content,
            categories: plan.categories,
            preferredTags: plan.preferredTags,
            limit: searchableChunks.length,
          },
        });

  const mode = resolveKnowledgeDocumentHitMode(rankedResults);
  const contextResults = selectKnowledgeSearchResultsForContext({
    searchableChunks,
    rankedResults,
    resultLimit: plan.resultLimit,
  });

  return {
    context: buildKnowledgeDocumentContextFromResults({ mode, results: contextResults }),
    trace: buildKnowledgeRetrievalTraceEntry({
      intent: input.intent,
      content: input.content,
      plan,
      mode,
      results: rankedResults.slice(0, plan.resultLimit),
    }),
  };
}
