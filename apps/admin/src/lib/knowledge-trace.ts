import type {
  ActorType,
  ChatSession,
  KnowledgeRetrievalTraceEntry,
  KnowledgeRetrievalTraceResult,
} from '@mianshitong/shared';

export type KnowledgeTraceIntentKind = KnowledgeRetrievalTraceEntry['intentKind'];
export type KnowledgeTraceMode = KnowledgeRetrievalTraceEntry['mode'];

export interface KnowledgeTraceSessionSource {
  sessionId: string;
  sessionTitle: string;
  sessionUpdatedAt: string;
  actorId: string;
  actorLabel: string;
  actorType: ActorType;
  runtime: ChatSession['runtime'];
}

export interface KnowledgeTraceRow extends KnowledgeRetrievalTraceEntry {
  id: string;
  queryHash: string;
  sessionId: string;
  sessionTitle: string;
  sessionUpdatedAt: string;
  actorId: string;
  actorLabel: string;
  actorType: ActorType;
  resultCount: number;
  topDocumentTitle: string | null;
  topDocumentCategory: KnowledgeRetrievalTraceResult['category'] | null;
}

export interface KnowledgeTraceRecordSource {
  id: string;
  sessionId: string;
  sessionTitle: string;
  sessionUpdatedAt: string;
  actorId: string;
  actorLabel: string;
  actorType: ActorType;
  entry: KnowledgeRetrievalTraceEntry;
}

export interface KnowledgeTraceFilters {
  intentKind?: KnowledgeTraceIntentKind | '';
  mode?: KnowledgeTraceMode | '';
  keyword?: string;
}

export interface KnowledgeTraceOverviewItem {
  key: string;
  label: string;
  count: number;
}

export interface KnowledgeTraceOverview {
  totalTraces: number;
  tracedSessionCount: number;
  strongCount: number;
  weakCount: number;
  noneCount: number;
  modeDistribution: KnowledgeTraceOverviewItem[];
  intentDistribution: KnowledgeTraceOverviewItem[];
  topQueries: KnowledgeTraceOverviewItem[];
  topDocuments: KnowledgeTraceOverviewItem[];
}

export interface KnowledgeTraceRegressionCandidate {
  key: string;
  queryPreview: string;
  intentKind: KnowledgeTraceIntentKind;
  dominantMode: 'none' | 'weak';
  count: number;
  categories: string[];
  topDocumentTitle: string | null;
  exampleSessionId: string;
  exampleSessionTitle: string;
  latestCreatedAt: string;
}

export const KNOWLEDGE_TRACE_INTENT_VALUES: KnowledgeTraceIntentKind[] = [
  'technical_question',
  'interview_playbook',
  'project_highlight',
  'resume_optimize',
  'self_intro',
];

export const KNOWLEDGE_TRACE_MODE_VALUES: KnowledgeTraceMode[] = ['strong', 'weak', 'none'];

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function createOverviewItems(
  counts: Map<string, number>,
  labels: Record<string, string>,
  limit = Number.POSITIVE_INFINITY,
): KnowledgeTraceOverviewItem[] {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key, count]) => ({
      key,
      label: labels[key] ?? key,
      count,
    }));
}

function incrementCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function normalizeKnowledgeTraceIntentKind(
  value: string | undefined,
): KnowledgeTraceIntentKind | '' {
  return KNOWLEDGE_TRACE_INTENT_VALUES.includes(value as KnowledgeTraceIntentKind)
    ? (value as KnowledgeTraceIntentKind)
    : '';
}

export function normalizeKnowledgeTraceMode(value: string | undefined): KnowledgeTraceMode | '' {
  return KNOWLEDGE_TRACE_MODE_VALUES.includes(value as KnowledgeTraceMode)
    ? (value as KnowledgeTraceMode)
    : '';
}

export function flattenKnowledgeTraceRows(
  sessions: KnowledgeTraceSessionSource[],
): KnowledgeTraceRow[] {
  return sessions.flatMap((session) =>
    (session.runtime.knowledgeRetrievalTrace ?? []).map((entry, index) => ({
      id: `${session.sessionId}:${entry.createdAt}:${index}`,
      queryHash: entry.queryHash ?? `${entry.intentKind}::${entry.queryPreview}`,
      ...entry,
      sessionId: session.sessionId,
      sessionTitle: session.sessionTitle,
      sessionUpdatedAt: session.sessionUpdatedAt,
      actorId: session.actorId,
      actorLabel: session.actorLabel,
      actorType: session.actorType,
      resultCount: entry.results.length,
      topDocumentTitle: entry.results[0]?.documentTitle ?? null,
      topDocumentCategory: entry.results[0]?.category ?? null,
    })),
  );
}

export function mapKnowledgeTraceRecordSourcesToRows(
  sources: KnowledgeTraceRecordSource[],
): KnowledgeTraceRow[] {
  return sources.map((source) => ({
    id: source.id,
    queryHash: source.entry.queryHash ?? `${source.entry.intentKind}::${source.entry.queryPreview}`,
    ...source.entry,
    sessionId: source.sessionId,
    sessionTitle: source.sessionTitle,
    sessionUpdatedAt: source.sessionUpdatedAt,
    actorId: source.actorId,
    actorLabel: source.actorLabel,
    actorType: source.actorType,
    resultCount: source.entry.results.length,
    topDocumentTitle: source.entry.results[0]?.documentTitle ?? null,
    topDocumentCategory: source.entry.results[0]?.category ?? null,
  }));
}

export function filterKnowledgeTraceRows(
  rows: KnowledgeTraceRow[],
  filters: KnowledgeTraceFilters,
): KnowledgeTraceRow[] {
  const keyword = normalizeSearchText(filters.keyword ?? '');

  return rows.filter((row) => {
    if (filters.intentKind && row.intentKind !== filters.intentKind) {
      return false;
    }

    if (filters.mode && row.mode !== filters.mode) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const haystack = [
      row.sessionTitle,
      row.actorLabel,
      row.queryPreview,
      ...row.preferredTags,
      ...row.categories,
      ...row.results.map((result) => result.documentTitle),
      ...row.results.flatMap((result) => result.headingPath),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(keyword);
  });
}

export function buildKnowledgeTraceOverview(rows: KnowledgeTraceRow[]): KnowledgeTraceOverview {
  const modeCounts = new Map<string, number>();
  const intentCounts = new Map<string, number>();
  const queryCounts = new Map<string, number>();
  const queryLabels = new Map<string, string>();
  const documentCounts = new Map<string, number>();
  const sessionIds = new Set<string>();

  for (const row of rows) {
    sessionIds.add(row.sessionId);
    incrementCount(modeCounts, row.mode);
    incrementCount(intentCounts, row.intentKind);
    incrementCount(queryCounts, row.queryHash);
    if (!queryLabels.has(row.queryHash)) {
      queryLabels.set(row.queryHash, row.queryPreview);
    }

    for (const result of row.results) {
      incrementCount(documentCounts, result.documentTitle);
    }
  }

  const modeLabels: Record<string, string> = {
    strong: '强命中',
    weak: '弱命中',
    none: '未命中',
  };
  const intentLabels: Record<string, string> = {
    technical_question: '技术问答',
    interview_playbook: '面试打法',
    project_highlight: '项目亮点',
    resume_optimize: '简历优化',
    self_intro: '自我介绍',
  };

  return {
    totalTraces: rows.length,
    tracedSessionCount: sessionIds.size,
    strongCount: modeCounts.get('strong') ?? 0,
    weakCount: modeCounts.get('weak') ?? 0,
    noneCount: modeCounts.get('none') ?? 0,
    modeDistribution: createOverviewItems(modeCounts, modeLabels),
    intentDistribution: createOverviewItems(intentCounts, intentLabels),
    topQueries: createOverviewItems(queryCounts, Object.fromEntries(queryLabels.entries()), 5),
    topDocuments: createOverviewItems(documentCounts, {}, 5),
  };
}

function compareCandidateMode(left: 'none' | 'weak', right: 'none' | 'weak') {
  if (left === right) {
    return 0;
  }

  return left === 'none' ? -1 : 1;
}

export function buildKnowledgeTraceRegressionCandidates(
  rows: KnowledgeTraceRow[],
  limit = 10,
): KnowledgeTraceRegressionCandidate[] {
  const candidateMap = new Map<string, KnowledgeTraceRegressionCandidate>();

  for (const row of rows) {
    if (row.mode !== 'none' && row.mode !== 'weak') {
      continue;
    }

    const key = `${row.intentKind}::${row.queryHash}`;
    const existing = candidateMap.get(key);

    if (!existing) {
      candidateMap.set(key, {
        key,
        queryPreview: row.queryPreview,
        intentKind: row.intentKind,
        dominantMode: row.mode,
        count: 1,
        categories: [...row.categories],
        topDocumentTitle: row.topDocumentTitle,
        exampleSessionId: row.sessionId,
        exampleSessionTitle: row.sessionTitle,
        latestCreatedAt: row.createdAt,
      });
      continue;
    }

    existing.count += 1;
    if (compareCandidateMode(row.mode, existing.dominantMode) < 0) {
      existing.dominantMode = row.mode;
    }

    if (row.createdAt > existing.latestCreatedAt) {
      existing.categories = [...row.categories];
      existing.topDocumentTitle = row.topDocumentTitle;
      existing.exampleSessionId = row.sessionId;
      existing.exampleSessionTitle = row.sessionTitle;
      existing.latestCreatedAt = row.createdAt;
    }
  }

  return [...candidateMap.values()]
    .sort((left, right) => {
      const modeCompare = compareCandidateMode(left.dominantMode, right.dominantMode);
      if (modeCompare !== 0) {
        return modeCompare;
      }

      if (left.count !== right.count) {
        return right.count - left.count;
      }

      return right.latestCreatedAt.localeCompare(left.latestCreatedAt);
    })
    .slice(0, limit);
}
