import { prisma } from '@mianshitong/db';
import { AdminShell } from '@/components/admin-shell';
import { KnowledgeDocumentEditView } from '@/components/knowledge-document-edit-view';
import { requireAdminUser } from '@/lib/admin-auth';
import { normalizeKnowledgeDocumentTags } from '@/components/knowledge-document-options';

interface KnowledgeDocumentEditPageProps {
  params: Promise<{ id?: string }>;
}

export default async function KnowledgeDocumentEditPage({
  params,
}: KnowledgeDocumentEditPageProps) {
  const adminUser = await requireAdminUser();
  const resolvedParams = await params;
  const id = resolvedParams?.id ? decodeURIComponent(resolvedParams.id) : '';

  const document = id
    ? await prisma.knowledgeDocument.findUnique({
        where: { id },
      })
    : null;

  if (!document) {
    return (
      <AdminShell title="文档不存在" adminUser={adminUser}>
        <div style={{ padding: '24px 0', color: '#6b7280' }}>未找到该文档。</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="编辑文档"
      adminUser={adminUser}
      hideHeader
      contentStyle={{ padding: 0, overflow: 'hidden' }}
    >
      <KnowledgeDocumentEditView
        initial={{
          id: document.id,
          title: document.title,
          category: document.category,
          contentShape: document.contentShape,
          summary: document.summary ?? null,
          content: document.content,
          tags: normalizeKnowledgeDocumentTags(document.tags),
          isPublished: document.isPublished,
        }}
      />
    </AdminShell>
  );
}
