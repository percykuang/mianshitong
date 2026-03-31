import { prisma, Prisma } from '@mianshitong/db';
import { AdminPagination } from '@/components/admin-pagination';
import { AdminShell } from '@/components/admin-shell';
import { KnowledgeDocumentsFilter } from '@/components/knowledge-documents-filter';
import { KnowledgeDocumentsTableCard } from '@/components/knowledge-documents-table-card';
import {
  isKnowledgeDocumentCategory,
  normalizeKnowledgeDocumentTags,
} from '@/components/knowledge-document-options';
import { requireAdminUser } from '@/lib/admin-auth';
import { buildPaginationMeta, normalizePage, normalizePageSize } from '@/lib/pagination';

interface DocumentsPageProps {
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
    title?: string;
    category?: string;
    status?: string;
    tags?: string;
  }>;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const adminUser = await requireAdminUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const page = normalizePage(resolvedSearchParams.page, 1);
  const pageSize = normalizePageSize(resolvedSearchParams.pageSize, 10);
  const title = resolvedSearchParams.title?.trim() ?? '';
  const category = resolvedSearchParams.category?.trim() ?? '';
  const status = resolvedSearchParams.status?.trim() ?? '';
  const tags = normalizeKnowledgeDocumentTags(
    resolvedSearchParams.tags ? resolvedSearchParams.tags.split(',') : [],
  );

  const whereClauses: Prisma.KnowledgeDocumentWhereInput[] = [];
  if (title) {
    whereClauses.push({
      title: { contains: title, mode: 'insensitive' },
    });
  }
  if (category) {
    if (isKnowledgeDocumentCategory(category)) {
      whereClauses.push({ category });
    }
  }
  if (status === 'published') {
    whereClauses.push({ isPublished: true });
  }
  if (status === 'draft') {
    whereClauses.push({ isPublished: false });
  }
  if (tags.length > 0) {
    whereClauses.push({
      tags: { hasSome: tags },
    });
  }

  const where = whereClauses.length ? { AND: whereClauses } : undefined;

  const [total, documents] = await Promise.all([
    prisma.knowledgeDocument.count({ where }),
    prisma.knowledgeDocument.findMany({
      where,
      include: {
        _count: {
          select: {
            chunks: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const pagination = buildPaginationMeta(page, pageSize, total);
  const rows = documents.map((document) => ({
    id: document.id,
    title: document.title,
    category: document.category,
    contentShape: document.contentShape,
    tags: [...document.tags],
    chunkCount: document._count?.chunks ?? 0,
    isPublished: document.isPublished,
    updatedAt: document.updatedAt.toISOString(),
  }));

  return (
    <AdminShell title="文档管理" adminUser={adminUser}>
      <KnowledgeDocumentsFilter
        title={title}
        category={category}
        status={status}
        tags={tags}
        pageSize={pagination.pageSize}
      />
      <KnowledgeDocumentsTableCard rows={rows} />
      <AdminPagination
        basePath="/documents"
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={total}
        params={{
          title,
          category,
          status,
          tags: tags.length > 0 ? tags.join(',') : undefined,
        }}
        totalLabel="篇文档"
      />
    </AdminShell>
  );
}
