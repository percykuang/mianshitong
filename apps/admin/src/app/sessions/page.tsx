import { prisma, Prisma } from '@mianshitong/db';
import type { ActorType, SessionStatus } from '@mianshitong/shared';
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
    actorType?: string;
    status?: string;
    updatedFrom?: string;
    updatedTo?: string;
  }>;
}

interface SessionRow {
  id: string;
  title: string;
  status: string;
  messageCount: number;
  updatedAt: string;
  actorId: string;
  actorLabel: string;
  actorType: 'guest' | 'registered';
}

function normalizeActorType(value: string | undefined): ActorType | '' {
  if (value === 'guest' || value === 'registered') {
    return value;
  }

  return '';
}

function normalizeSessionStatus(value: string | undefined): SessionStatus | '' {
  if (value === 'idle' || value === 'interviewing' || value === 'completed') {
    return value;
  }

  return '';
}

function normalizeDateParam(value: string | undefined): string {
  if (!value) {
    return '';
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function createStartOfDay(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function createEndExclusive(dateString: string): Date {
  const nextDay = createStartOfDay(dateString);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay;
}

export default async function SessionsPage({ searchParams }: SessionsPageProps) {
  const adminUser = await requireAdminUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const page = normalizePage(resolvedSearchParams.page, 1);
  const pageSize = normalizePageSize(resolvedSearchParams.pageSize, 10);
  const userId = resolvedSearchParams.userId?.trim() ?? '';
  const user = resolvedSearchParams.user?.trim() ?? '';
  const title = resolvedSearchParams.title?.trim() ?? '';
  const actorType = normalizeActorType(resolvedSearchParams.actorType);
  const status = normalizeSessionStatus(resolvedSearchParams.status);
  const updatedFrom = normalizeDateParam(resolvedSearchParams.updatedFrom);
  const updatedTo = normalizeDateParam(resolvedSearchParams.updatedTo);

  const whereClauses: Prisma.ChatSessionRecordWhereInput[] = [];
  if (userId) {
    whereClauses.push({
      OR: [{ userId }, { actorId: userId }],
    });
  }
  if (user) {
    whereClauses.push({
      OR: [
        { user: { email: { contains: user, mode: 'insensitive' } } },
        { actor: { displayName: { contains: user, mode: 'insensitive' } } },
      ],
    });
  }
  if (title) {
    whereClauses.push({ title: { contains: title, mode: 'insensitive' } });
  }
  if (actorType) {
    whereClauses.push({ actor: { type: actorType } });
  }
  if (status) {
    whereClauses.push({ status });
  }
  if (updatedFrom || updatedTo) {
    whereClauses.push({
      updatedAt: {
        ...(updatedFrom ? { gte: createStartOfDay(updatedFrom) } : {}),
        ...(updatedTo ? { lt: createEndExclusive(updatedTo) } : {}),
      },
    });
  }

  const where = whereClauses.length ? { AND: whereClauses } : undefined;

  const [total, sessions] = await Promise.all([
    prisma.chatSessionRecord.count({ where }),
    prisma.chatSessionRecord.findMany({
      include: {
        user: { select: { email: true } },
        actor: { select: { id: true, type: true, displayName: true } },
      },
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
    actorId: session.actor.id,
    actorLabel: session.user?.email ?? session.actor.displayName,
    actorType: session.actor.type,
  }));

  return (
    <AdminShell title="会话管理" adminUser={adminUser}>
      <SessionsFilter
        userId={userId}
        user={user}
        title={title}
        actorType={actorType}
        status={status}
        updatedFrom={updatedFrom}
        updatedTo={updatedTo}
        pageSize={pagination.pageSize}
      />
      <SessionsTable rows={data} />
      <AdminPagination
        basePath="/sessions"
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={total}
        params={{ userId, user, title, actorType, status, updatedFrom, updatedTo }}
        totalLabel="条会话"
      />
    </AdminShell>
  );
}
