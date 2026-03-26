import { prisma, Prisma } from '@mianshitong/db';
import { AdminPagination } from '@/components/admin-pagination';
import { AdminShell } from '@/components/admin-shell';
import { QuestionsFilter } from '@/components/questions-filter';
import { QuestionsTableCard } from '@/components/questions-table-card';
import { requireAdminUser } from '@/lib/admin-auth';
import { buildPaginationMeta, normalizePage, normalizePageSize } from '@/lib/pagination';
import { normalizeQuestionTags } from '@/components/question-bank-options';

interface QuestionsPageProps {
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
    tags?: string;
    topic?: string;
    level?: string;
    status?: string;
    title?: string;
    keyword?: string;
  }>;
}

export default async function QuestionsPage({ searchParams }: QuestionsPageProps) {
  const adminUser = await requireAdminUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const page = normalizePage(resolvedSearchParams.page, 1);
  const pageSize = normalizePageSize(resolvedSearchParams.pageSize, 10);
  const tags = normalizeQuestionTags([
    ...(resolvedSearchParams.tags ? resolvedSearchParams.tags.split(',') : []),
    ...(resolvedSearchParams.topic ? [resolvedSearchParams.topic] : []),
  ]);
  const level = resolvedSearchParams.level?.trim() ?? '';
  const status = resolvedSearchParams.status?.trim() ?? '';
  const title = resolvedSearchParams.title?.trim() ?? resolvedSearchParams.keyword?.trim() ?? '';

  const whereClauses: Prisma.QuestionBankItemWhereInput[] = [];
  if (tags.length > 0) {
    whereClauses.push({
      OR: tags.map((tag) => ({ tags: { array_contains: [tag] } })),
    });
  }
  if (level) {
    whereClauses.push({ level });
  }
  if (status === 'active') {
    whereClauses.push({ isActive: true });
  }
  if (status === 'inactive') {
    whereClauses.push({ isActive: false });
  }
  if (title) {
    whereClauses.push({
      title: { contains: title, mode: 'insensitive' },
    });
  }

  const where = whereClauses.length ? { AND: whereClauses } : undefined;
  const [total, questions] = await Promise.all([
    prisma.questionBankItem.count({ where }),
    prisma.questionBankItem.findMany({
      where,
      orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const data = questions.map((question) => ({
    id: question.id,
    level: question.level,
    title: question.title,
    tags: normalizeQuestionTags(question.tags),
    order: question.order ?? null,
    isActive: question.isActive,
    updatedAt: question.updatedAt.toISOString(),
  }));
  const pagination = buildPaginationMeta(page, pageSize, total);

  return (
    <AdminShell title="题库管理" adminUser={adminUser}>
      <QuestionsFilter
        title={title}
        tags={tags}
        level={level}
        status={status}
        pageSize={pagination.pageSize}
      />
      <QuestionsTableCard rows={data} />
      <AdminPagination
        basePath="/questions"
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={total}
        params={{ title, tags: tags.length ? tags.join(',') : undefined, level, status }}
        totalLabel="道题目"
      />
    </AdminShell>
  );
}
