import { prisma } from '@mianshitong/db';
import { AdminPagination } from '@/components/admin-pagination';
import { AdminShell } from '@/components/admin-shell';
import { UsersTable } from '@/components/users-table';
import { requireAdminUser } from '@/lib/admin-auth';
import { buildPaginationMeta, normalizePage, normalizePageSize } from '@/lib/pagination';

interface UsersPageProps {
  searchParams?: Promise<{ page?: string; pageSize?: string }>;
}

interface UserRow {
  id: string;
  email: string;
  createdAt: string;
  sessionCount: number;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const adminUser = await requireAdminUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const page = normalizePage(resolvedSearchParams.page, 1);
  const pageSize = normalizePageSize(resolvedSearchParams.pageSize, 10);

  const [total, users] = await Promise.all([
    prisma.authUser.count(),
    prisma.authUser.findMany({
      select: {
        id: true,
        email: true,
        createdAt: true,
        _count: { select: { chatSessions: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const pagination = buildPaginationMeta(page, pageSize, total);
  const data: UserRow[] = users.map((user) => ({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    sessionCount: user._count.chatSessions,
  }));

  return (
    <AdminShell title="用户管理" adminUser={adminUser}>
      <UsersTable rows={data} />
      <AdminPagination
        basePath="/users"
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={total}
        totalLabel="位用户"
      />
    </AdminShell>
  );
}
