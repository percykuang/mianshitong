import { DEFAULT_INTERVIEW_CONFIG } from '../defaults';
import type { DimensionScores, InterviewConfig, KnowledgeRetrievalTraceEntry } from '../types';

const TRACE_TAG_LIMIT = 8;
const KNOWLEDGE_RETRIEVAL_TRACE_LIMIT = 12;
const TRACE_TAG_ALLOWED_VALUES = new Set([
  '前端',
  'frontend',
  '项目',
  '简历',
  '面试',
  '流程',
  '自我介绍',
  '一面',
  '二面',
  '三面',
  '终面',
  'hr',
  'offer',
  'react',
  'vue',
  'javascript',
  'typescript',
  'node',
  'css',
  'html',
  'http',
  'api',
  'sdk',
]);
const TRACE_TAG_NOISE_FRAGMENTS = [
  '我',
  '你',
  '他',
  '她',
  '它',
  '怎么',
  '如何',
  '可以',
  '一下',
  '现在',
  '里面',
  '出来',
  '知道',
  '容易',
  '让我',
  '这段',
  '这一段',
  '这个',
  '那个',
  '还是',
  '就是',
  '这样',
  '也更',
  '更有',
  '看出',
];

function normalizeTraceTagKey(tag: string): string {
  return tag.trim().toLowerCase();
}

function resolveTraceIntentAnchors(
  intentKind: KnowledgeRetrievalTraceEntry['intentKind'],
): string[] {
  if (intentKind === 'technical_question') {
    return ['前端', 'frontend'];
  }

  if (intentKind === 'interview_playbook') {
    return ['面试'];
  }

  if (intentKind === 'project_highlight' || intentKind === 'resume_optimize') {
    return ['项目', '简历'];
  }

  return ['面试', '自我介绍'];
}

function isAsciiTraceTag(tag: string): boolean {
  return /^[a-z0-9._+-]+$/i.test(tag);
}

function isChineseTraceTag(tag: string): boolean {
  return /^[\u4e00-\u9fa5]+$/u.test(tag);
}

function shouldKeepTraceTag(tag: string, allowedKeys: Set<string>): boolean {
  const normalized = tag.trim();
  const key = normalizeTraceTagKey(normalized);
  if (!normalized) {
    return false;
  }

  if (allowedKeys.has(key)) {
    return true;
  }

  if (normalized.length > 12) {
    return false;
  }

  if (isAsciiTraceTag(normalized)) {
    return normalized.length >= 3;
  }

  if (TRACE_TAG_NOISE_FRAGMENTS.some((fragment) => normalized.includes(fragment))) {
    return false;
  }

  if (isChineseTraceTag(normalized)) {
    return normalized.length >= 3;
  }

  return normalized.length >= 3;
}

function createKnowledgeTraceIdentity(entry: KnowledgeRetrievalTraceEntry): string {
  return JSON.stringify([
    entry.createdAt,
    entry.intentKind,
    entry.mode,
    entry.queryPreview,
    entry.categories,
    entry.preferredTags,
    entry.results.map((result) => [
      result.documentId,
      result.documentTitle,
      result.category,
      result.headingPath,
      result.score,
    ]),
  ]);
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

export function normalizeInterviewConfig(
  config: Partial<InterviewConfig> | undefined,
): InterviewConfig {
  const nextTopics = config?.topics?.length
    ? [...new Set(config.topics)]
    : DEFAULT_INTERVIEW_CONFIG.topics;

  return {
    topics: nextTopics,
    level: config?.level ?? DEFAULT_INTERVIEW_CONFIG.level,
    questionCount: clamp(config?.questionCount ?? DEFAULT_INTERVIEW_CONFIG.questionCount, 1, 8),
    feedbackMode: config?.feedbackMode ?? DEFAULT_INTERVIEW_CONFIG.feedbackMode,
  };
}

export function createEmptyScores(): DimensionScores {
  return {
    correctness: 0,
    depth: 0,
    communication: 0,
    engineering: 0,
    tradeoffs: 0,
  };
}

export function normalizeKnowledgeTracePreferredTags(
  tags: string[],
  intentKind: KnowledgeRetrievalTraceEntry['intentKind'],
  limit = TRACE_TAG_LIMIT,
): string[] {
  const anchors = resolveTraceIntentAnchors(intentKind);
  const allowedKeys = new Set(
    [...anchors, ...TRACE_TAG_ALLOWED_VALUES].map((value) => normalizeTraceTagKey(value)),
  );
  const next: string[] = [];
  const seen = new Set<string>();

  const append = (tag: string) => {
    const normalized = tag.trim();
    const key = normalizeTraceTagKey(normalized);
    if (!normalized || seen.has(key) || !shouldKeepTraceTag(normalized, allowedKeys)) {
      return;
    }

    next.push(normalized);
    seen.add(key);
  };

  for (const anchor of anchors) {
    append(anchor);
  }

  for (const tag of tags) {
    append(tag);
    if (next.length >= limit) {
      break;
    }
  }

  return next.slice(0, limit);
}

export function mergeKnowledgeRetrievalTraceEntries(
  existing: KnowledgeRetrievalTraceEntry[],
  incoming: KnowledgeRetrievalTraceEntry[],
  limit = KNOWLEDGE_RETRIEVAL_TRACE_LIMIT,
): KnowledgeRetrievalTraceEntry[] {
  const merged: KnowledgeRetrievalTraceEntry[] = [];
  const seen = new Set<string>();

  for (const entry of [...existing, ...incoming]) {
    const identity = createKnowledgeTraceIdentity(entry);
    if (seen.has(identity)) {
      continue;
    }

    merged.push(entry);
    seen.add(identity);
  }

  return merged.slice(-limit);
}
