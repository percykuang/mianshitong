import { prisma } from '@mianshitong/db';
import { AdminShell } from '@/components/admin-shell';
import { BackButton } from '@/components/back-button';
import { SessionDetailView } from '@/components/session-detail-view';
import { requireAdminUser } from '@/lib/admin-auth';
import { decodeAdminSessionRuntime } from '@/lib/chat-session-runtime';
import { formatDateTime } from '@/lib/format';
import { normalizeSessionMessages } from '@/lib/session-messages';

interface SessionDetailPageProps {
  params: Promise<{ sessionId?: string }>;
}

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  const adminUser = await requireAdminUser();
  const resolvedParams = await params;
  const sessionId = resolvedParams?.sessionId ? decodeURIComponent(resolvedParams.sessionId) : '';

  const session = sessionId
    ? await prisma.chatSessionRecord.findUnique({
        where: { id: sessionId },
        include: {
          user: { select: { email: true } },
          actor: { select: { id: true, type: true, displayName: true } },
        },
      })
    : null;

  if (!session) {
    return (
      <AdminShell title="会话不存在" adminUser={adminUser}>
        <div style={{ padding: '24px 0', color: '#6b7280' }}>未找到该会话。</div>
      </AdminShell>
    );
  }

  const messages = normalizeSessionMessages(session.messages);
  const runtime = decodeAdminSessionRuntime(session.runtime);

  return (
    <AdminShell title="会话详情" headerPrefix={<BackButton />} adminUser={adminUser}>
      <SessionDetailView
        session={{
          id: session.id,
          title: session.title,
          actorId: session.actor.id,
          actorLabel: session.user?.email ?? session.actor.displayName,
          actorType: session.actor.type,
          modelId: session.modelId,
          status: session.status,
          createdAt: formatDateTime(session.createdAt),
          updatedAt: formatDateTime(session.updatedAt),
        }}
        messages={messages.map((message) => ({
          ...message,
          createdAt: message.createdAt ? formatDateTime(message.createdAt) : '',
        }))}
        runtime={{
          ...runtime,
          planGeneratedAt: runtime.planGeneratedAt ? formatDateTime(runtime.planGeneratedAt) : null,
        }}
      />
    </AdminShell>
  );
}
