import { prisma } from '@mianshitong/db';
import { AdminShell } from '@/components/admin-shell';
import { QuestionEditView } from '@/components/question-edit-view';
import { requireAdminUser } from '@/lib/admin-auth';
import { normalizeQuestionTags } from '@/components/question-bank-options';

interface QuestionEditPageProps {
  params: Promise<{ id?: string }>;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export default async function QuestionEditPage({ params }: QuestionEditPageProps) {
  const adminUser = await requireAdminUser();
  const resolvedParams = await params;
  const id = resolvedParams?.id ? decodeURIComponent(resolvedParams.id) : '';

  const question = id
    ? await prisma.questionBankItem.findUnique({
        where: { id },
      })
    : null;

  if (!question) {
    return (
      <AdminShell title="题目不存在" adminUser={adminUser}>
        <div style={{ padding: '24px 0', color: '#6b7280' }}>未找到该题目。</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="编辑题目"
      adminUser={adminUser}
      hideHeader
      contentStyle={{ padding: 0, overflow: 'hidden' }}
    >
      <QuestionEditView
        initial={{
          id: question.id,
          level: question.level,
          title: question.title,
          prompt: question.prompt ?? null,
          answer: question.answer ?? null,
          keyPoints: toStringArray(question.keyPoints),
          followUps: toStringArray(question.followUps),
          tags: normalizeQuestionTags(question.tags),
          order: question.order ?? null,
          isActive: question.isActive,
        }}
      />
    </AdminShell>
  );
}
