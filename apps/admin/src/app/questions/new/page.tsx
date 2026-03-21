import { AdminShell } from '@/components/admin-shell';
import { QuestionCreateView } from '@/components/question-create-view';
import { requireAdminUser } from '@/lib/admin-auth';

export default async function QuestionCreatePage() {
  const adminUser = await requireAdminUser();

  return (
    <AdminShell
      title="新建题目"
      adminUser={adminUser}
      hideHeader
      contentStyle={{ padding: 0, overflow: 'hidden' }}
    >
      <QuestionCreateView />
    </AdminShell>
  );
}
