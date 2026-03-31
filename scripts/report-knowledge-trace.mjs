import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const dbPackageJson = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../packages/db/package.json',
);
const dbRequire = createRequire(dbPackageJson);
const { PrismaClient } = dbRequire('@prisma/client');
const { PrismaPg } = dbRequire('@prisma/adapter-pg');

const DEV_DATABASE_URL =
  'postgresql://mianshitong:mianshitong@127.0.0.1:5432/mianshitong?schema=public';
const connectionString = process.env.DATABASE_URL || DEV_DATABASE_URL;

function parseArgs(argv) {
  const options = {
    days: 14,
    maxSessions: 500,
    intent: '',
    mode: '',
    keyword: '',
    candidateLimit: 5,
    fixtureSuggestions: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === '--days' && next) {
      options.days = Number(next) || options.days;
      index += 1;
      continue;
    }

    if (current === '--max-sessions' && next) {
      options.maxSessions = Number(next) || options.maxSessions;
      index += 1;
      continue;
    }

    if (current === '--intent' && next) {
      options.intent = next.trim();
      index += 1;
      continue;
    }

    if (current === '--mode' && next) {
      options.mode = next.trim();
      index += 1;
      continue;
    }

    if (current === '--keyword' && next) {
      options.keyword = next.trim().toLowerCase();
      index += 1;
      continue;
    }

    if (current === '--candidate-limit' && next) {
      options.candidateLimit = Number(next) || options.candidateLimit;
      index += 1;
      continue;
    }

    if (current === '--fixture-suggestions') {
      options.fixtureSuggestions = true;
    }
  }

  return options;
}

function createDateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function normalizeRuntime(runtime) {
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) {
    return { knowledgeRetrievalTrace: [] };
  }

  return {
    ...runtime,
    knowledgeRetrievalTrace: Array.isArray(runtime.knowledgeRetrievalTrace)
      ? runtime.knowledgeRetrievalTrace
      : [],
  };
}

function flattenTraceRows(sessions) {
  return sessions.flatMap((session) => {
    const runtime = normalizeRuntime(session.runtime);
    return runtime.knowledgeRetrievalTrace.map((entry) => ({
      ...entry,
      sessionId: session.id,
      sessionTitle: session.title,
      actorLabel: session.user?.email ?? session.actor?.displayName ?? '-',
      topDocumentTitle: entry.results?.[0]?.documentTitle ?? null,
      resultCount: Array.isArray(entry.results) ? entry.results.length : 0,
    }));
  });
}

function filterRows(rows, options) {
  return rows.filter((row) => {
    if (options.intent && row.intentKind !== options.intent) {
      return false;
    }

    if (options.mode && row.mode !== options.mode) {
      return false;
    }

    if (!options.keyword) {
      return true;
    }

    const haystack = [
      row.sessionTitle,
      row.actorLabel,
      row.queryPreview,
      ...(row.preferredTags ?? []),
      ...(row.results ?? []).map((result) => result.documentTitle),
      ...(row.results ?? []).flatMap((result) => result.headingPath ?? []),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(options.keyword);
  });
}

function countBy(rows, pick) {
  const counts = new Map();
  for (const row of rows) {
    const key = pick(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
}

function printRanked(title, rows, mapper = (key, count) => `${key}: ${count}`) {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log('- 无');
    return;
  }

  for (const [key, count] of rows) {
    console.log(`- ${mapper(key, count)}`);
  }
}

function buildRegressionCandidates(rows) {
  const map = new Map();

  for (const row of rows) {
    if (row.mode !== 'none' && row.mode !== 'weak') {
      continue;
    }

    const key = `${row.intentKind}::${row.queryPreview}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        queryPreview: row.queryPreview,
        intentKind: row.intentKind,
        mode: row.mode,
        count: 1,
        categories: [...(row.categories ?? [])],
        preferredTags: [...(row.preferredTags ?? [])],
        topDocumentTitle: row.topDocumentTitle,
      });
      continue;
    }

    existing.count += 1;
    if (existing.mode !== 'none' && row.mode === 'none') {
      existing.mode = 'none';
    }
  }

  return [...map.values()].sort((left, right) => {
    if (left.mode !== right.mode) {
      return left.mode === 'none' ? -1 : 1;
    }

    if (left.count !== right.count) {
      return right.count - left.count;
    }

    return left.queryPreview.localeCompare(right.queryPreview);
  });
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function escapeSingleQuotes(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function printFixtureSuggestions(candidates, limit) {
  console.log('\n候选 fixture 草稿');
  if (candidates.length === 0) {
    console.log('- 无');
    return;
  }

  for (const candidate of candidates.slice(0, limit)) {
    const id = `trace_${candidate.intentKind}_${slugify(candidate.queryPreview)}`;
    const categoriesText =
      candidate.categories.length > 0
        ? `[${candidate.categories.map((value) => `'${escapeSingleQuotes(value)}'`).join(', ')}]`
        : '[]';
    const preferredTagsText =
      candidate.preferredTags.length > 0
        ? `[${candidate.preferredTags
            .slice(0, 6)
            .map((value) => `'${escapeSingleQuotes(value)}'`)
            .join(', ')}]`
        : '[]';

    console.log(`- id: ${id}`);
    console.log('```ts');
    console.log('{');
    console.log(`  id: '${id}',`);
    console.log(`  description: '来自真实 trace 的 ${candidate.mode} 候选样本',`);
    console.log('  documents: KNOWLEDGE_EVAL_DOCUMENTS,');
    console.log('  query: {');
    console.log(`    text: '${escapeSingleQuotes(candidate.queryPreview)}',`);
    console.log(`    categories: ${categoriesText},`);
    console.log(`    preferredTags: ${preferredTagsText},`);
    console.log('    limit: 4,');
    console.log('  },');
    console.log('  expectations: {');
    console.log(`    expectedMode: '${candidate.mode}',`);
    if (candidate.topDocumentTitle) {
      console.log(
        `    expectedTopDocumentTitle: '${escapeSingleQuotes(candidate.topDocumentTitle)}',`,
      );
    }
    console.log('  },');
    console.log('},');
    console.log('```');
  }
}

const options = parseArgs(process.argv.slice(2));
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  log: ['error'],
});

try {
  const sessions = await prisma.chatSessionRecord.findMany({
    where: {
      updatedAt: {
        gte: createDateAfter(options.days),
      },
    },
    include: {
      user: { select: { email: true } },
      actor: { select: { displayName: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: options.maxSessions,
  });

  const rows = filterRows(flattenTraceRows(sessions), options);
  const tracedSessionCount = new Set(rows.map((row) => row.sessionId)).size;
  const regressionCandidates = buildRegressionCandidates(rows);

  console.log('知识检索 Trace 分析');
  console.log(`- 最近天数: ${options.days}`);
  console.log(`- 扫描会话数: ${sessions.length}`);
  console.log(`- Trace 总数: ${rows.length}`);
  console.log(`- 有 Trace 的会话数: ${tracedSessionCount}`);
  console.log(
    `- 过滤条件: intent=${options.intent || 'all'}, mode=${options.mode || 'all'}, keyword=${options.keyword || 'none'}`,
  );

  printRanked(
    '命中模式分布',
    countBy(rows, (row) => row.mode),
  );
  printRanked(
    '意图分布',
    countBy(rows, (row) => row.intentKind),
  );
  printRanked(
    '高频未命中 Query Top 10',
    countBy(
      rows.filter((row) => row.mode === 'none'),
      (row) => row.queryPreview,
    ).slice(0, 10),
    (key, count) => `${key} (${count})`,
  );
  printRanked(
    '高频弱命中 Query Top 10',
    countBy(
      rows.filter((row) => row.mode === 'weak'),
      (row) => row.queryPreview,
    ).slice(0, 10),
    (key, count) => `${key} (${count})`,
  );
  printRanked(
    '高频命中文档 Top 10',
    countBy(
      rows
        .flatMap((row) => row.results ?? [])
        .map((result) => ({
          documentTitle: result.documentTitle,
        })),
      (row) => row.documentTitle,
    ).slice(0, 10),
    (key, count) => `${key} (${count})`,
  );
  printRanked(
    `高优先级回归候选 Top ${options.candidateLimit}`,
    regressionCandidates
      .slice(0, options.candidateLimit)
      .map((candidate) => [
        `${candidate.mode} | ${candidate.intentKind} | ${candidate.queryPreview}`,
        candidate.count,
      ]),
    (key, count) => `${key} (${count})`,
  );

  if (options.fixtureSuggestions) {
    printFixtureSuggestions(regressionCandidates, options.candidateLimit);
  }
} finally {
  await prisma.$disconnect();
}
