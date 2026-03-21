import { prisma } from '@mianshitong/db';
import { AdminShell } from '@/components/admin-shell';
import { AdminOverview } from '@/components/admin-overview';
import { requireAdminUser } from '@/lib/admin-auth';

function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN');
}

export default async function Home() {
  const adminUser = await requireAdminUser();
  const [userCount, sessionCount, questionCount] = await Promise.all([
    prisma.authUser.count(),
    prisma.chatSessionRecord.count(),
    prisma.questionBankItem.count(),
  ]);

  const cards = [
    { label: '注册用户', value: formatNumber(userCount) },
    { label: '会话总量', value: formatNumber(sessionCount) },
    { label: '题库题目', value: formatNumber(questionCount) },
  ];

  return (
    <AdminShell title="概览" adminUser={adminUser}>
      <AdminOverview
        cards={cards}
        suggestions={[
          '先完成题库上传与标签规范，保证出题可控。',
          '补充用户会话筛选（按时间、状态、模型）。',
          '再接入模型与配额策略，避免成本失控。',
        ]}
      />
    </AdminShell>
  );
}
