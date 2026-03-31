import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DEFAULT_DATABASE_URL =
  'postgresql://mianshitong:mianshitong@127.0.0.1:5432/mianshitong?schema=public';
const DEFAULT_BATCH_SIZE = 100;

const VALID_INTENT_KINDS = new Set([
  'technical_question',
  'interview_playbook',
  'project_highlight',
  'resume_optimize',
  'self_intro',
]);
const VALID_MODES = new Set(['strong', 'weak', 'none']);
const VALID_CATEGORIES = new Set(['tech_knowledge', 'interview_playbook', 'project_resume']);
const DEFAULT_TRIGGER_KIND = 'new_message';

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map(normalizeString).filter(Boolean))];
}

function normalizeCategories(value) {
  return normalizeStringArray(value).filter((item) => VALID_CATEGORIES.has(item));
}

function normalizeDate(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeCliDate(value, flagName) {
  const date = normalizeDate(value);
  if (!date) {
    throw new Error(`\`${flagName}\` 必须是合法的 ISO 日期时间字符串。`);
  }

  return date;
}

export function buildLegacyKnowledgeTraceQueryHash(queryPreview) {
  const normalized = queryPreview.replace(/\s+/g, ' ').trim().toLowerCase();
  return createHash('sha256').update(normalized).digest('hex');
}

function normalizeTraceResult(result, rank) {
  if (!isRecord(result)) {
    return null;
  }

  const documentId = normalizeString(result.documentId);
  const documentTitle = normalizeString(result.documentTitle);
  const category = normalizeString(result.category);
  const headingPath = normalizeStringArray(result.headingPath);
  const score =
    typeof result.score === 'number' && Number.isFinite(result.score) ? result.score : null;

  if (!documentId || !documentTitle || !VALID_CATEGORIES.has(category) || score === null) {
    return null;
  }

  return {
    rank,
    documentId,
    documentTitle,
    category,
    headingPath,
    score,
  };
}

export function normalizeBackfillKnowledgeTraceRecord(input) {
  if (!isRecord(input.trace)) {
    return null;
  }

  const createdAt = normalizeDate(input.trace.createdAt);
  const intentKind = normalizeString(input.trace.intentKind);
  const mode = normalizeString(input.trace.mode);
  const queryPreview = normalizeString(input.trace.queryPreview);
  const queryHash =
    normalizeString(input.trace.queryHash) || buildLegacyKnowledgeTraceQueryHash(queryPreview);

  if (
    !createdAt ||
    !VALID_INTENT_KINDS.has(intentKind) ||
    !VALID_MODES.has(mode) ||
    !queryPreview
  ) {
    return null;
  }

  const rawResults = Array.isArray(input.trace.results) ? input.trace.results : [];
  const results = rawResults
    .map((result, index) => normalizeTraceResult(result, index))
    .filter((result) => result !== null);

  return {
    sessionId: input.sessionId,
    actorId: input.actorId,
    userId: input.userId ?? null,
    triggerKind: DEFAULT_TRIGGER_KIND,
    queryHash,
    queryPreview,
    intentKind,
    mode,
    categories: normalizeCategories(input.trace.categories),
    preferredTags: normalizeStringArray(input.trace.preferredTags),
    createdAt,
    results,
  };
}

export function buildKnowledgeTraceBackfillDedupKey(record) {
  return JSON.stringify([
    record.sessionId,
    record.triggerKind,
    record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt),
    record.intentKind,
    record.mode,
    record.queryHash,
    record.queryPreview,
  ]);
}

export function extractBackfillKnowledgeTraceRecordsFromRuntime(sessionRecord) {
  if (!isRecord(sessionRecord.runtime)) {
    return [];
  }

  const traceEntries = sessionRecord.runtime.knowledgeRetrievalTrace;
  if (!Array.isArray(traceEntries)) {
    return [];
  }

  return traceEntries
    .map((trace) =>
      normalizeBackfillKnowledgeTraceRecord({
        sessionId: sessionRecord.id,
        actorId: sessionRecord.actorId,
        userId: sessionRecord.userId ?? null,
        trace,
      }),
    )
    .filter((trace) => trace !== null);
}

export function parseBackfillKnowledgeTraceArgs(argv) {
  const options = {
    batchSize: DEFAULT_BATCH_SIZE,
    dryRun: false,
    limitSessions: null,
    sessionId: null,
    createdAfter: null,
    createdBefore: null,
    reportJson: null,
  };

  for (const arg of argv) {
    if (arg === '--') {
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg.startsWith('--batch-size=')) {
      const value = Number(arg.slice('--batch-size='.length));
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error('`--batch-size` 必须是正整数。');
      }
      options.batchSize = value;
      continue;
    }

    if (arg.startsWith('--limit-sessions=')) {
      const value = Number(arg.slice('--limit-sessions='.length));
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error('`--limit-sessions` 必须是正整数。');
      }
      options.limitSessions = value;
      continue;
    }

    if (arg.startsWith('--session-id=')) {
      const value = arg.slice('--session-id='.length).trim();
      if (!value) {
        throw new Error('`--session-id` 不能为空。');
      }
      options.sessionId = value;
      continue;
    }

    if (arg.startsWith('--created-after=')) {
      options.createdAfter = normalizeCliDate(
        arg.slice('--created-after='.length).trim(),
        '--created-after',
      );
      continue;
    }

    if (arg.startsWith('--created-before=')) {
      options.createdBefore = normalizeCliDate(
        arg.slice('--created-before='.length).trim(),
        '--created-before',
      );
      continue;
    }

    if (arg.startsWith('--report-json=')) {
      const value = arg.slice('--report-json='.length).trim();
      if (!value) {
        throw new Error('`--report-json` 不能为空。');
      }
      options.reportJson = value;
      continue;
    }

    throw new Error(`不支持的参数：${arg}`);
  }

  if (
    options.createdAfter &&
    options.createdBefore &&
    options.createdAfter > options.createdBefore
  ) {
    throw new Error('`--created-after` 不能晚于 `--created-before`。');
  }

  return options;
}

export function shouldIncludeBackfillRecord(record, options) {
  if (options.createdAfter && record.createdAt < options.createdAfter) {
    return false;
  }

  if (options.createdBefore && record.createdAt > options.createdBefore) {
    return false;
  }

  return true;
}

function serializeBackfillOptions(options) {
  return {
    batchSize: options.batchSize,
    dryRun: options.dryRun,
    limitSessions: options.limitSessions,
    sessionId: options.sessionId,
    createdAfter: options.createdAfter?.toISOString() ?? null,
    createdBefore: options.createdBefore?.toISOString() ?? null,
    reportJson: options.reportJson,
  };
}

export function buildKnowledgeTraceBackfillReport(input) {
  const { options, summary, startedAt, finishedAt } = input;

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    options: serializeBackfillOptions(options),
    summary,
  };
}

async function writeKnowledgeTraceBackfillReport(reportJsonPath, report) {
  const absolutePath = path.resolve(reportJsonPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(`${absolutePath}`, JSON.stringify(report, null, 2), 'utf8');
  return absolutePath;
}

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: resolveDatabaseUrl(),
    }),
    log: ['error'],
  });
}

async function backfillKnowledgeTraceRecords() {
  const options = parseBackfillKnowledgeTraceArgs(process.argv.slice(2));
  const prisma = createPrismaClient();
  const startedAt = new Date();
  const summary = {
    scannedSessions: 0,
    sessionsWithTrace: 0,
    extractedTraceRecords: 0,
    filteredOutByCreatedAt: 0,
    skippedExistingRecords: 0,
    createdTraceRecords: 0,
  };

  let cursorId = null;

  try {
    for (;;) {
      const remainingSessions =
        options.limitSessions === null
          ? options.batchSize
          : Math.min(options.batchSize, options.limitSessions - summary.scannedSessions);

      if (remainingSessions <= 0) {
        break;
      }

      const sessions = await prisma.chatSessionRecord.findMany({
        ...(options.sessionId
          ? {
              where: { id: options.sessionId },
            }
          : {
              ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
              take: remainingSessions,
              orderBy: { id: 'asc' },
            }),
        select: {
          id: true,
          actorId: true,
          userId: true,
          runtime: true,
        },
      });

      if (sessions.length === 0) {
        break;
      }

      summary.scannedSessions += sessions.length;
      const rawExtractedRecords = sessions.flatMap((session) =>
        extractBackfillKnowledgeTraceRecordsFromRuntime(session),
      );
      const extractedRecords = rawExtractedRecords.filter((record) =>
        shouldIncludeBackfillRecord(record, options),
      );
      summary.filteredOutByCreatedAt += rawExtractedRecords.length - extractedRecords.length;
      const sessionIds = [...new Set(extractedRecords.map((record) => record.sessionId))];

      if (extractedRecords.length > 0) {
        summary.sessionsWithTrace += new Set(
          extractedRecords.map((record) => record.sessionId),
        ).size;
        summary.extractedTraceRecords += extractedRecords.length;

        const existingRecords = await prisma.knowledgeRetrievalTraceRecord.findMany({
          where: {
            sessionId: {
              in: sessionIds,
            },
          },
          select: {
            sessionId: true,
            triggerKind: true,
            createdAt: true,
            intentKind: true,
            mode: true,
            queryHash: true,
            queryPreview: true,
          },
        });
        const existingKeys = new Set(
          existingRecords.map((record) => buildKnowledgeTraceBackfillDedupKey(record)),
        );
        const pendingRecords = extractedRecords.filter((record) => {
          const dedupKey = buildKnowledgeTraceBackfillDedupKey(record);
          if (existingKeys.has(dedupKey)) {
            return false;
          }

          existingKeys.add(dedupKey);
          return true;
        });

        summary.skippedExistingRecords += extractedRecords.length - pendingRecords.length;

        if (!options.dryRun) {
          for (const record of pendingRecords) {
            await prisma.knowledgeRetrievalTraceRecord.create({
              data: {
                sessionId: record.sessionId,
                actorId: record.actorId,
                userId: record.userId,
                triggerKind: record.triggerKind,
                queryHash: record.queryHash,
                queryPreview: record.queryPreview,
                intentKind: record.intentKind,
                mode: record.mode,
                categories: record.categories,
                preferredTags: record.preferredTags,
                createdAt: record.createdAt,
                ...(record.results.length > 0
                  ? {
                      results: {
                        create: record.results.map((result) => ({
                          rank: result.rank,
                          documentId: result.documentId,
                          documentTitle: result.documentTitle,
                          category: result.category,
                          headingPath: result.headingPath,
                          score: result.score,
                        })),
                      },
                    }
                  : {}),
              },
            });
          }
        }

        summary.createdTraceRecords += pendingRecords.length;
      }

      console.log(
        `[knowledge-trace-backfill] 已扫描 ${summary.scannedSessions} 个会话，发现 ${summary.extractedTraceRecords} 条历史 trace，待写入 ${summary.createdTraceRecords} 条。`,
      );

      if (options.sessionId) {
        break;
      }

      cursorId = sessions.at(-1)?.id ?? null;
    }

    const finishedAt = new Date();
    const report = buildKnowledgeTraceBackfillReport({
      options,
      summary,
      startedAt,
      finishedAt,
    });
    let reportPath = null;

    if (options.reportJson) {
      reportPath = await writeKnowledgeTraceBackfillReport(options.reportJson, report);
    }

    console.log(
      [
        `[knowledge-trace-backfill] 完成${options.dryRun ? '（dry-run）' : ''}。`,
        `扫描会话：${summary.scannedSessions}`,
        `命中历史 trace 的会话：${summary.sessionsWithTrace}`,
        `抽取到的 runtime trace：${summary.extractedTraceRecords}`,
        `按 createdAt 窗口过滤掉的 trace：${summary.filteredOutByCreatedAt}`,
        `跳过的已存在记录：${summary.skippedExistingRecords}`,
        `${options.dryRun ? '预计写入的新记录' : '实际写入的新记录'}：${summary.createdTraceRecords}`,
        ...(reportPath ? [`报告已写入：${reportPath}`] : []),
      ].join('\n'),
    );
  } finally {
    await prisma.$disconnect();
  }
}

const isMainModule =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMainModule) {
  backfillKnowledgeTraceRecords().catch((error) => {
    console.error('[knowledge-trace-backfill] 执行失败。');
    console.error(error);
    process.exit(1);
  });
}
