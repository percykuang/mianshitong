import { createHash } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DEFAULT_DATABASE_URL =
  'postgresql://mianshitong:mianshitong@127.0.0.1:5432/mianshitong?schema=public';
const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_EMBED_MODEL = 'nomic-embed-text';
const DEFAULT_EMBEDDING_VERSION = 'v1';
const BATCH_SIZE = 16;

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

function resolveEmbeddingProvider() {
  const provider = (process.env.EMBEDDING_PROVIDER || 'ollama').trim().toLowerCase();
  if (provider !== 'ollama') {
    throw new Error('当前仅支持通过 Ollama 回填题库 embedding。');
  }

  return {
    baseUrl: (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, ''),
    model: process.env.OLLAMA_EMBED_MODEL || DEFAULT_OLLAMA_EMBED_MODEL,
    version: process.env.EMBEDDING_VERSION || DEFAULT_EMBEDDING_VERSION,
    dimensions:
      process.env.OLLAMA_EMBED_DIMENSIONS &&
      /^\d+$/.test(process.env.OLLAMA_EMBED_DIMENSIONS.trim())
        ? Number(process.env.OLLAMA_EMBED_DIMENSIONS.trim())
        : undefined,
  };
}

function toStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => typeof item === 'string');
}

function normalizeTag(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s._/-]+/g, '');
}

function buildSearchText(questionItem) {
  return [
    questionItem.title,
    questionItem.prompt,
    questionItem.answer,
    ...toStringArray(questionItem.keyPoints),
    ...toStringArray(questionItem.followUps),
    ...toStringArray(questionItem.tags),
  ]
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .join('\n');
}

function buildRetrievalPayload(questionItem) {
  const searchText = buildSearchText(questionItem);
  const normalizedTags = [
    ...new Set(toStringArray(questionItem.tags).map(normalizeTag).filter(Boolean)),
  ];
  const contentHash = createHash('sha256')
    .update(JSON.stringify({ searchText, normalizedTags }))
    .digest('hex');

  return {
    questionItemId: questionItem.id,
    searchText,
    normalizedTags,
    contentHash,
  };
}

async function embedTexts(config, texts) {
  const response = await fetch(`${config.baseUrl}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      input: texts,
      ...(config.dimensions ? { dimensions: config.dimensions } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Ollama embedding 请求失败（${response.status}）`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.embeddings)) {
    throw new Error('Ollama embedding 响应格式无效。');
  }

  return payload.embeddings;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: resolveDatabaseUrl(),
  }),
  log: ['error'],
});

try {
  const embeddingConfig = resolveEmbeddingProvider();
  const questionItems = await prisma.questionBankItem.findMany({
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });

  if (questionItems.length === 0) {
    console.log('题库为空，无需回填 embedding。');
    process.exit(0);
  }

  const retrievalRows = await prisma.$queryRaw`
    SELECT
      "questionItemId",
      "contentHash",
      "embeddingModel",
      "embeddingVersion",
      "embeddingDimensions",
      "embedding" IS NOT NULL AS "hasEmbedding"
    FROM "QuestionRetrievalDoc"
  `;
  const retrievalMap = new Map(retrievalRows.map((row) => [row.questionItemId, row]));

  let createdCount = 0;
  let updatedCount = 0;
  const pendingRows = [];

  for (const questionItem of questionItems) {
    const payload = buildRetrievalPayload(questionItem);
    const existing = retrievalMap.get(questionItem.id);

    if (!existing) {
      await prisma.questionRetrievalDoc.create({ data: payload });
      createdCount += 1;
      pendingRows.push(payload);
      continue;
    }

    const hasEmbedding = Boolean(existing.hasEmbedding);
    const dimensionsMatch =
      embeddingConfig.dimensions === undefined ||
      existing.embeddingDimensions === embeddingConfig.dimensions;
    const metadataMatches =
      existing.contentHash === payload.contentHash &&
      existing.embeddingModel === embeddingConfig.model &&
      existing.embeddingVersion === embeddingConfig.version &&
      dimensionsMatch;

    if (!metadataMatches) {
      await prisma.$transaction(async (tx) => {
        await tx.questionRetrievalDoc.update({
          where: { questionItemId: questionItem.id },
          data: {
            searchText: payload.searchText,
            normalizedTags: payload.normalizedTags,
            contentHash: payload.contentHash,
            embeddingModel: null,
            embeddingVersion: null,
            embeddingDimensions: null,
          },
        });

        await tx.$executeRaw`
          UPDATE "QuestionRetrievalDoc"
          SET "embedding" = NULL
          WHERE "questionItemId" = ${questionItem.id}
        `;
      });

      updatedCount += 1;
      pendingRows.push(payload);
      continue;
    }

    if (!hasEmbedding) {
      pendingRows.push(payload);
    }
  }

  if (pendingRows.length === 0) {
    console.log(
      `检索索引已是最新状态。共 ${questionItems.length} 题，新增索引 ${createdCount} 条，更新索引 ${updatedCount} 条。`,
    );
    process.exit(0);
  }

  let embeddedCount = 0;

  for (let index = 0; index < pendingRows.length; index += BATCH_SIZE) {
    const batch = pendingRows.slice(index, index + BATCH_SIZE);
    const embeddings = await embedTexts(
      embeddingConfig,
      batch.map((item) => item.searchText),
    );

    if (!Array.isArray(embeddings) || embeddings.length !== batch.length) {
      throw new Error('embedding 返回数量和回填批次不一致。');
    }

    for (let batchIndex = 0; batchIndex < batch.length; batchIndex += 1) {
      const embedding = embeddings[batchIndex];
      if (!Array.isArray(embedding) || embedding.some((item) => typeof item !== 'number')) {
        throw new Error(`第 ${index + batchIndex + 1} 条 embedding 格式无效。`);
      }

      const vectorLiteral = `[${embedding.join(',')}]`;
      await prisma.$executeRaw`
        UPDATE "QuestionRetrievalDoc"
        SET
          "embedding" = CAST(${vectorLiteral} AS vector),
          "embeddingModel" = ${embeddingConfig.model},
          "embeddingVersion" = ${embeddingConfig.version},
          "embeddingDimensions" = ${embedding.length},
          "updatedAt" = NOW()
        WHERE "questionItemId" = ${batch[batchIndex].questionItemId}
      `;
      embeddedCount += 1;
    }
  }

  console.log(
    `embedding 回填完成。题目 ${questionItems.length} 条，新增索引 ${createdCount} 条，更新索引 ${updatedCount} 条，回填向量 ${embeddedCount} 条。`,
  );
} finally {
  await prisma.$disconnect();
}
