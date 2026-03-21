import { prisma, Prisma } from '@mianshitong/db';
import { AdminPagination } from '@/components/admin-pagination';
import { AdminShell } from '@/components/admin-shell';
import { SessionsFilter } from '@/components/sessions-filter';
import { SessionsTable } from '@/components/sessions-table';
import { requireAdminUser } from '@/lib/admin-auth';
import { buildPaginationMeta, normalizePage, normalizePageSize } from '@/lib/pagination';
import { countVisibleMessages } from '@/lib/session-messages';

interface SessionsPageProps {
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
    userId?: string;
    user?: string;
    title?: string;
  }>;
}

interface SessionRow {
  id: string;
  title: string;
  status: string;
  messageCount: number;
  updatedAt: string;
  userEmail: string;
}

export default async function SessionsPage({ searchParams }: SessionsPageProps) {
  const adminUser = await requireAdminUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const page = normalizePage(resolvedSearchParams.page, 1);
  const pageSize = normalizePageSize(resolvedSearchParams.pageSize, 10);
  const userId = resolvedSearchParams.userId?.trim() ?? '';
  const user = resolvedSearchParams.user?.trim() ?? '';
  const title = resolvedSearchParams.title?.trim() ?? '';

  const whereClauses: Prisma.ChatSessionRecordWhereInput[] = [];
  if (userId) {
    whereClauses.push({ userId });
  }
  if (user) {
    whereClauses.push({ user: { email: { contains: user, mode: 'insensitive' } } });
  }
  if (title) {
    whereClauses.push({ title: { contains: title, mode: 'insensitive' } });
  }

  const where = whereClauses.length ? { AND: whereClauses } : undefined;

  const [total, sessions] = await Promise.all([
    prisma.chatSessionRecord.count({ where }),
    prisma.chatSessionRecord.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { updatedAt: 'desc' },
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const pagination = buildPaginationMeta(page, pageSize, total);
  const data: SessionRow[] = sessions.map((session) => ({
    id: encodeURIComponent(session.id),
    title: session.title,
    status: session.status,
    messageCount: countVisibleMessages(session.messages),
    updatedAt: session.updatedAt.toISOString(),
    userEmail: session.user.email,
  }));

  return (
    <AdminShell title="会话管理" adminUser={adminUser}>
      <SessionsFilter userId={userId} user={user} title={title} pageSize={pagination.pageSize} />
      <SessionsTable rows={data} />
      <AdminPagination
        basePath="/sessions"
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={total}
        params={{ userId, user, title }}
        totalLabel="条会话"
      />
    </AdminShell>
  );
}
