const LATIN_TOKEN_PATTERN = /[a-z0-9+#.]{2,}/g;
const CJK_SEGMENT_PATTERN = /[\u4e00-\u9fff]{2,}/g;
const MAX_CHUNK_LENGTH = 780;

export type KnowledgeDocumentCategory = 'tech_knowledge' | 'interview_playbook' | 'project_resume';
export type KnowledgeDocumentContentShape = 'reference' | 'process' | 'checklist' | 'template';

export interface KnowledgeDocumentSource {
  documentId: string;
  title: string;
  category: KnowledgeDocumentCategory;
  contentShape: KnowledgeDocumentContentShape;
  summary?: string | null;
  tags: string[];
  content: string;
}

export interface KnowledgeDocumentChunkPayload {
  documentId: string;
  contentShape: KnowledgeDocumentContentShape;
  chunkOrder: number;
  headingPath: string[];
  headingText: string | null;
  content: string;
  searchText: string;
  tags: string[];
  normalizedTags: string[];
}

export interface SearchableKnowledgeDocumentChunk extends KnowledgeDocumentChunkPayload {
  id: string;
  title: string;
  category: KnowledgeDocumentCategory;
  tokens: string[];
}

export interface KnowledgeDocumentSearchQuery {
  queryText: string;
  categories?: KnowledgeDocumentCategory[];
  preferredTags?: string[];
  limit?: number;
}

export interface KnowledgeDocumentSearchScoreBreakdown {
  lexical: number;
  heading: number;
  tag: number;
  penalty: number;
}

export interface KnowledgeDocumentSearchResult {
  chunk: SearchableKnowledgeDocumentChunk;
  score: number;
  lexicalOverlap: string[];
  matchedTags: string[];
  breakdown: KnowledgeDocumentSearchScoreBreakdown;
}

export type KnowledgeDocumentHitMode = 'strong' | 'weak' | 'none';

const STRONG_HIT_MIN_SCORE = 4.6;
const WEAK_HIT_MIN_SCORE = 2.2;

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeKnowledgeDocumentTag(value: string): string {
  return normalizeText(value).replace(/[\s._/-]+/g, '');
}

export function tokenizeKnowledgeRetrievalText(value: string): string[] {
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

function normalizeMarkdownLine(line: string): string {
  return line.replace(/\t/g, '  ').trimEnd();
}

function splitMarkdownSections(content: string): Array<{ headingPath: string[]; content: string }> {
  const lines = content.split('\n').map(normalizeMarkdownLine);
  const sections: Array<{ headingPath: string[]; content: string }> = [];
  let headingPath: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const value = buffer.join('\n').trim();
    if (!value) {
      buffer = [];
      return;
    }

    sections.push({ headingPath: [...headingPath], content: value });
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!headingMatch) {
      buffer.push(line);
      continue;
    }

    flush();
    const level = headingMatch[1]?.length ?? 1;
    const headingText = headingMatch[2]?.trim() ?? '';
    headingPath = [...headingPath.slice(0, Math.max(0, level - 1)), headingText].filter(Boolean);
  }

  flush();

  if (sections.length > 0) {
    return sections;
  }

  const normalized = lines.join('\n').trim();
  return normalized ? [{ headingPath: [], content: normalized }] : [];
}

function splitIntoMarkdownBlocks(content: string): string[] {
  const lines = content.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;

  const flush = () => {
    const value = current.join('\n').trim();
    if (value) {
      blocks.push(value);
    }
    current = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const isFence = /^```/.test(line.trim());

    if (isFence) {
      current.push(line);
      inFence = !inFence;
      continue;
    }

    if (!inFence && line.trim().length === 0) {
      flush();
      continue;
    }

    current.push(line);
  }

  flush();
  return blocks;
}

function splitLongBlock(block: string, maxLength = MAX_CHUNK_LENGTH): string[] {
  if (block.length <= maxLength) {
    return [block];
  }

  const units = block
    .split(/(?<=[。！？；.!?;])/u)
    .map((item) => item.trim())
    .filter(Boolean);

  if (units.length <= 1) {
    const parts: string[] = [];
    for (let index = 0; index < block.length; index += maxLength) {
      parts.push(block.slice(index, index + maxLength).trim());
    }
    return parts.filter(Boolean);
  }

  const parts: string[] = [];
  let current = '';

  for (const unit of units) {
    const candidate = current ? `${current}${unit}` : unit;
    if (candidate.length > maxLength && current) {
      parts.push(current.trim());
      current = unit;
      continue;
    }

    current = candidate;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts.filter(Boolean);
}

function chunkSectionContent(content: string): string[] {
  const blocks = splitIntoMarkdownBlocks(content).flatMap((block) => splitLongBlock(block));
  const chunks: string[] = [];
  let current = '';

  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length > MAX_CHUNK_LENGTH && current) {
      chunks.push(current.trim());
      current = block;
      continue;
    }

    current = candidate;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter(Boolean);
}

export function buildKnowledgeDocumentSearchText(input: {
  title: string;
  summary?: string | null;
  headingPath: string[];
  tags: string[];
  content: string;
}): string {
  return [input.title, input.summary, ...input.headingPath, ...input.tags, input.content]
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .join('\n');
}

export function buildKnowledgeDocumentChunks(
  input: KnowledgeDocumentSource,
): KnowledgeDocumentChunkPayload[] {
  const normalizedTags = [
    ...new Set(input.tags.map(normalizeKnowledgeDocumentTag).filter(Boolean)),
  ];
  const sections = splitMarkdownSections(input.content);
  let chunkOrder = 0;

  return sections.flatMap((section) =>
    chunkSectionContent(section.content).map((chunkContent) => {
      const headingText = section.headingPath.at(-1) ?? null;
      const searchText = buildKnowledgeDocumentSearchText({
        title: input.title,
        summary: input.summary,
        headingPath: section.headingPath,
        tags: input.tags,
        content: chunkContent,
      });
      const chunk: KnowledgeDocumentChunkPayload = {
        documentId: input.documentId,
        contentShape: input.contentShape,
        chunkOrder,
        headingPath: [...section.headingPath],
        headingText,
        content: chunkContent,
        searchText,
        tags: [...input.tags],
        normalizedTags,
      };
      chunkOrder += 1;
      return chunk;
    }),
  );
}

function buildKnowledgeSearchableChunk(
  input: Omit<SearchableKnowledgeDocumentChunk, 'tokens'>,
): SearchableKnowledgeDocumentChunk {
  return {
    ...input,
    tokens: tokenizeKnowledgeRetrievalText(input.searchText),
  };
}

function getLexicalScore(chunkTokens: Set<string>, queryTokens: Set<string>) {
  const lexicalOverlap = [...queryTokens].filter((token) => chunkTokens.has(token));
  if (queryTokens.size === 0 || lexicalOverlap.length === 0) {
    return { lexicalOverlap, score: 0 };
  }

  const ratio = lexicalOverlap.length / queryTokens.size;
  const score = Math.min(4.6, ratio * 4.2 + lexicalOverlap.length * 0.14);
  return { lexicalOverlap, score };
}

function getHeadingScore(headingTokens: Set<string>, queryTokens: Set<string>): number {
  if (headingTokens.size === 0 || queryTokens.size === 0) {
    return 0;
  }

  const overlap = [...queryTokens].filter((token) => headingTokens.has(token)).length;
  return Math.min(2.2, overlap * 0.9);
}

function getMatchedTags(normalizedTags: string[], preferredTags: string[]): string[] {
  const queryTags = new Set(preferredTags.map(normalizeKnowledgeDocumentTag).filter(Boolean));
  return normalizedTags.filter((tag) => queryTags.has(tag));
}

function compareKnowledgeResults(
  left: KnowledgeDocumentSearchResult,
  right: KnowledgeDocumentSearchResult,
): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (right.matchedTags.length !== left.matchedTags.length) {
    return right.matchedTags.length - left.matchedTags.length;
  }

  if (right.lexicalOverlap.length !== left.lexicalOverlap.length) {
    return right.lexicalOverlap.length - left.lexicalOverlap.length;
  }

  if (left.chunk.chunkOrder !== right.chunk.chunkOrder) {
    return left.chunk.chunkOrder - right.chunk.chunkOrder;
  }

  return left.chunk.id.localeCompare(right.chunk.id);
}

export function searchKnowledgeDocumentChunks(input: {
  chunks: Array<
    Omit<SearchableKnowledgeDocumentChunk, 'tokens'> | SearchableKnowledgeDocumentChunk
  >;
  query: KnowledgeDocumentSearchQuery;
}): KnowledgeDocumentSearchResult[] {
  const queryTokens = new Set(tokenizeKnowledgeRetrievalText(input.query.queryText));
  const preferredTags = input.query.preferredTags ?? [];
  const allowedCategories =
    input.query.categories && input.query.categories.length > 0
      ? new Set(input.query.categories)
      : null;

  return input.chunks
    .map((chunk) => ('tokens' in chunk ? chunk : buildKnowledgeSearchableChunk(chunk)))
    .filter((chunk) => (allowedCategories ? allowedCategories.has(chunk.category) : true))
    .map<KnowledgeDocumentSearchResult>((chunk) => {
      const { lexicalOverlap, score: lexicalScore } = getLexicalScore(
        new Set(chunk.tokens),
        queryTokens,
      );
      const headingScore = getHeadingScore(
        new Set(tokenizeKnowledgeRetrievalText(chunk.headingPath.join('\n'))),
        queryTokens,
      );
      const matchedTags = getMatchedTags(chunk.normalizedTags, preferredTags);
      const tagScore = matchedTags.length * 2.1;
      const penalty = lexicalOverlap.length === 0 && matchedTags.length === 0 ? -0.9 : 0;

      return {
        chunk,
        score: lexicalScore + headingScore + tagScore + penalty,
        lexicalOverlap,
        matchedTags,
        breakdown: {
          lexical: lexicalScore,
          heading: headingScore,
          tag: tagScore,
          penalty,
        },
      };
    })
    .sort(compareKnowledgeResults)
    .slice(0, input.query.limit ?? 5);
}

export function resolveKnowledgeDocumentHitMode(
  results: KnowledgeDocumentSearchResult[],
): KnowledgeDocumentHitMode {
  const topResult = results[0];
  if (!topResult) {
    return 'none';
  }

  if (
    topResult.score >= STRONG_HIT_MIN_SCORE &&
    (topResult.lexicalOverlap.length >= 2 ||
      topResult.breakdown.heading >= 0.9 ||
      topResult.matchedTags.length > 0)
  ) {
    return 'strong';
  }

  if (topResult.score >= WEAK_HIT_MIN_SCORE) {
    return 'weak';
  }

  return 'none';
}
