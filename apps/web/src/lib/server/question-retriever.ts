import { Prisma, prisma } from '@mianshitong/db';
import { OllamaEmbeddingProvider } from '@mianshitong/llm';
import {
  buildQuestionRetrievalDocs,
  createLexicalQuestionRetriever,
  createVectorQuestionRetriever,
  type QuestionRetrievalQuery,
  type QuestionRetriever,
  type QuestionVectorSearchMatch,
  type QuestionVectorStore,
} from '@mianshitong/retrieval';
import type { InterviewPlanningStrategy, InterviewQuestion } from '@mianshitong/shared';

const DEFAULT_OLLAMA_EMBED_MODEL = 'nomic-embed-text';
const DEFAULT_EMBEDDING_VERSION = 'v1';

interface VectorAvailabilityRow {
  count: bigint | number;
}

interface QuestionVectorRow {
  questionId: string;
  level: string;
  title: string;
  prompt: string | null;
  answer: string | null;
  keyPoints: unknown;
  followUps: unknown;
  tags: unknown;
  order: number | null;
  similarity: number | string;
}

interface EmbeddingConfig {
  baseUrl: string;
  model: string;
  version: string;
  dimensions?: number;
}

export interface ResolvedQuestionRetriever {
  questionRetriever: QuestionRetriever;
  retrievalStrategy: InterviewPlanningStrategy;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function toFiniteNumber(value: number | string): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveEmbeddingConfig(): EmbeddingConfig | null {
  const provider = (process.env.EMBEDDING_PROVIDER ?? '').trim().toLowerCase();
  if (provider !== 'ollama') {
    return null;
  }

  const dimensionsValue = process.env.OLLAMA_EMBED_DIMENSIONS?.trim();
  const dimensions =
    dimensionsValue && /^\d+$/.test(dimensionsValue) ? Number(dimensionsValue) : undefined;

  return {
    baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
    model: process.env.OLLAMA_EMBED_MODEL ?? DEFAULT_OLLAMA_EMBED_MODEL,
    version: process.env.EMBEDDING_VERSION ?? DEFAULT_EMBEDDING_VERSION,
    dimensions,
  };
}

class PrismaQuestionVectorStore implements QuestionVectorStore {
  constructor(private readonly config: EmbeddingConfig) {}

  async hasAvailableEmbeddings(): Promise<boolean> {
    const whereClauses = [
      Prisma.sql`q."isActive" = TRUE`,
      Prisma.sql`rd."embedding" IS NOT NULL`,
      Prisma.sql`rd."embeddingModel" = ${this.config.model}`,
      Prisma.sql`rd."embeddingVersion" = ${this.config.version}`,
    ];

    if (typeof this.config.dimensions === 'number') {
      whereClauses.push(Prisma.sql`rd."embeddingDimensions" = ${this.config.dimensions}`);
    }

    const rows = await prisma.$queryRaw<VectorAvailabilityRow[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM "QuestionRetrievalDoc" rd
      INNER JOIN "QuestionBankItem" q ON q."id" = rd."questionItemId"
      WHERE ${Prisma.join(whereClauses, ' AND ')}
    `);

    return Number(rows[0]?.count ?? 0) > 0;
  }

  async searchByEmbedding(input: {
    embedding: number[];
    query: QuestionRetrievalQuery;
    limit: number;
  }): Promise<QuestionVectorSearchMatch[]> {
    if (input.embedding.length === 0) {
      return [];
    }

    const vectorLiteral = `[${input.embedding.join(',')}]`;
    const whereClauses = [
      Prisma.sql`q."isActive" = TRUE`,
      Prisma.sql`rd."embedding" IS NOT NULL`,
      Prisma.sql`rd."embeddingModel" = ${this.config.model}`,
      Prisma.sql`rd."embeddingVersion" = ${this.config.version}`,
      Prisma.sql`rd."embeddingDimensions" = ${input.embedding.length}`,
    ];

    if (input.query.allowedLevels && input.query.allowedLevels.length > 0) {
      whereClauses.push(
        Prisma.sql`q."level" IN (${Prisma.join(input.query.allowedLevels.map((item) => Prisma.sql`${item}`))})`,
      );
    }

    if (input.query.excludeQuestionIds && input.query.excludeQuestionIds.length > 0) {
      whereClauses.push(
        Prisma.sql`q."questionId" NOT IN (${Prisma.join(input.query.excludeQuestionIds.map((item) => Prisma.sql`${item}`))})`,
      );
    }

    const rows = await prisma.$queryRaw<QuestionVectorRow[]>(Prisma.sql`
      SELECT
        q."questionId" AS "questionId",
        q."level" AS "level",
        q."title" AS "title",
        q."prompt" AS "prompt",
        q."answer" AS "answer",
        q."keyPoints" AS "keyPoints",
        q."followUps" AS "followUps",
        q."tags" AS "tags",
        q."order" AS "order",
        1 - (rd."embedding" <=> CAST(${vectorLiteral} AS vector)) AS "similarity"
      FROM "QuestionRetrievalDoc" rd
      INNER JOIN "QuestionBankItem" q ON q."id" = rd."questionItemId"
      WHERE ${Prisma.join(whereClauses, ' AND ')}
      ORDER BY rd."embedding" <=> CAST(${vectorLiteral} AS vector) ASC
      LIMIT ${Math.max(1, input.limit)}
    `);

    return rows.map((row) => {
      const question: InterviewQuestion = {
        id: row.questionId,
        level: row.level as InterviewQuestion['level'],
        title: row.title,
        prompt: row.prompt,
        answer: row.answer,
        keyPoints: toStringArray(row.keyPoints),
        followUps: toStringArray(row.followUps),
        tags: toStringArray(row.tags),
        order: row.order,
      };
      const [doc] = buildQuestionRetrievalDocs([question]);
      if (!doc) {
        throw new Error(`题目 ${row.questionId} 无法构建检索文档`);
      }

      return {
        doc,
        similarity: toFiniteNumber(row.similarity),
      };
    });
  }
}

export async function resolveQuestionRetriever(
  questionBank: InterviewQuestion[],
): Promise<ResolvedQuestionRetriever> {
  const fallbackRetriever = createLexicalQuestionRetriever({ questionBank });
  const embeddingConfig = resolveEmbeddingConfig();
  if (!embeddingConfig) {
    return {
      questionRetriever: fallbackRetriever,
      retrievalStrategy: 'hybrid-lexical-v1',
    };
  }

  const vectorStore = new PrismaQuestionVectorStore(embeddingConfig);
  if (!(await vectorStore.hasAvailableEmbeddings())) {
    return {
      questionRetriever: fallbackRetriever,
      retrievalStrategy: 'hybrid-lexical-v1',
    };
  }

  return {
    questionRetriever: createVectorQuestionRetriever({
      embeddingProvider: new OllamaEmbeddingProvider({
        baseUrl: embeddingConfig.baseUrl,
        model: embeddingConfig.model,
        dimensions: embeddingConfig.dimensions,
      }),
      vectorStore,
      fallbackRetriever,
    }),
    retrievalStrategy: 'hybrid-vector-v1',
  };
}
