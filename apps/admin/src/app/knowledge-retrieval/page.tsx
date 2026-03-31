import { prisma } from '@mianshitong/db';
import { AdminPagination } from '@/components/admin-pagination';
import { AdminShell } from '@/components/admin-shell';
import { KnowledgeTraceFilter } from '@/components/knowledge-trace-filter';
import { KnowledgeTraceCandidateCard } from '@/components/knowledge-trace-candidate-card';
import { KnowledgeTraceSummaryCards } from '@/components/knowledge-trace-summary-cards';
import { KnowledgeTraceTableCard } from '@/components/knowledge-trace-table-card';
import { requireAdminUser } from '@/lib/admin-auth';
import {
  buildKnowledgeTraceOverview,
  buildKnowledgeTraceRegressionCandidates,
  filterKnowledgeTraceRows,
  mapKnowledgeTraceRecordSourcesToRows,
  normalizeKnowledgeTraceIntentKind,
  normalizeKnowledgeTraceMode,
} from '@/lib/knowledge-trace';
import { buildPaginationMeta, normalizePage, normalizePageSize } from '@/lib/pagination';

interface KnowledgeRetrievalPageProps {
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
    days?: string;
    intent?: string;
    mode?: string;
    keyword?: string;
  }>;
}

const DEFAULT_DAYS = 14;
const MAX_ANALYZED_TRACES = 1000;

function normalizeDays(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DAYS;
  }

  return Math.floor(parsed);
}

function createDateAfter(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export default async function KnowledgeRetrievalPage({
  searchParams,
}: KnowledgeRetrievalPageProps) {
  const adminUser = await requireAdminUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const page = normalizePage(resolvedSearchParams.page, 1);
  const pageSize = normalizePageSize(resolvedSearchParams.pageSize, 20);
  const days = normalizeDays(resolvedSearchParams.days);
  const intentKind = normalizeKnowledgeTraceIntentKind(resolvedSearchParams.intent);
  const mode = normalizeKnowledgeTraceMode(resolvedSearchParams.mode);
  const keyword = resolvedSearchParams.keyword?.trim() ?? '';
  const updatedAfter = createDateAfter(days);
  const where = {
    createdAt: { gte: updatedAfter },
    ...(intentKind ? { intentKind } : {}),
    ...(mode ? { mode } : {}),
  };

  const [traceTotalInRange, traceRecords] = await Promise.all([
    prisma.knowledgeRetrievalTraceRecord.count({ where }),
    prisma.knowledgeRetrievalTraceRecord.findMany({
      where,
      include: {
        results: {
          orderBy: { rank: 'asc' },
        },
        session: {
          select: {
            id: true,
            title: true,
            updatedAt: true,
          },
        },
        user: { select: { email: true } },
        actor: { select: { id: true, type: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_ANALYZED_TRACES,
    }),
  ]);

  const analyzedTraceCount = traceRecords.length;
  const sourceRows = mapKnowledgeTraceRecordSourcesToRows(
    traceRecords.map((record) => ({
      id: record.id,
      sessionId: record.session.id,
      sessionTitle: record.session.title,
      sessionUpdatedAt: record.session.updatedAt.toISOString(),
      actorId: record.actor.id,
      actorLabel: record.user?.email ?? record.actor.displayName,
      actorType: record.actor.type,
      entry: {
        createdAt: record.createdAt.toISOString(),
        intentKind: record.intentKind,
        mode: record.mode,
        categories: [...record.categories],
        preferredTags: [...record.preferredTags],
        queryHash: record.queryHash,
        queryPreview: record.queryPreview,
        results: record.results.map((result) => ({
          documentId: result.documentId,
          documentTitle: result.documentTitle,
          category: result.category,
          headingPath: [...result.headingPath],
          score: result.score,
        })),
      },
    })),
  );

  const filteredRows = filterKnowledgeTraceRows(sourceRows, {
    intentKind,
    mode,
    keyword,
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const overview = buildKnowledgeTraceOverview(filteredRows);
  const regressionCandidates = buildKnowledgeTraceRegressionCandidates(filteredRows, 8);
  const pagination = buildPaginationMeta(page, pageSize, filteredRows.length);
  const pagedRows = filteredRows.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize,
  );

  return (
    <AdminShell title="知识检索" adminUser={adminUser}>
      <KnowledgeTraceFilter
        days={days}
        keyword={keyword}
        intentKind={intentKind}
        mode={mode}
        pageSize={pagination.pageSize}
      />
      <KnowledgeTraceSummaryCards
        overview={overview}
        analyzedTraceCount={analyzedTraceCount}
        truncated={traceTotalInRange > MAX_ANALYZED_TRACES}
      />
      <KnowledgeTraceCandidateCard candidates={regressionCandidates} />
      <KnowledgeTraceTableCard
        rows={pagedRows}
        modeDistribution={overview.modeDistribution}
        intentDistribution={overview.intentDistribution}
      />
      <AdminPagination
        basePath="/knowledge-retrieval"
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={filteredRows.length}
        totalLabel="条 Trace"
        params={{
          days,
          intent: intentKind,
          mode,
          keyword,
        }}
      />
    </AdminShell>
  );
}
