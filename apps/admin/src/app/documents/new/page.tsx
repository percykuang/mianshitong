import { AdminShell } from '@/components/admin-shell';
import { KnowledgeDocumentCreateView } from '@/components/knowledge-document-create-view';
import { requireAdminUser } from '@/lib/admin-auth';

export default async function KnowledgeDocumentCreatePage() {
  const adminUser = await requireAdminUser();

  return (
    <AdminShell
      title="新建文档"
      adminUser={adminUser}
      hideHeader
      contentStyle={{ padding: 0, overflow: 'hidden' }}
    >
      <KnowledgeDocumentCreateView />
    </AdminShell>
  );
}
