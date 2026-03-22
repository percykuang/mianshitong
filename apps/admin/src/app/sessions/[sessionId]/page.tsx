import { prisma } from '@mianshitong/db';
import { AdminShell } from '@/components/admin-shell';
import { BackButton } from '@/components/back-button';
import { SessionDetailView } from '@/components/session-detail-view';
import { requireAdminUser } from '@/lib/admin-auth';
import { decodeAdminSessionRuntime } from '@/lib/chat-session-runtime';
import { formatDateTime } from '@/lib/format';
import { isSystemMessage } from '@/lib/session-messages';

interface SessionDetailPageProps {
  params: Promise<{ sessionId?: string }>;
}

type RawMessage = {
  id?: string;
  role?: string;
  kind?: string;
  content?: unknown;
  createdAt?: string;
};

function normalizeMessages(value: unknown): Array<{
  id: string;
  role: string;
  kind: string;
  content: string;
  createdAt: string;
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const message = item as RawMessage;
      const role = typeof message.role === 'string' ? message.role : 'assistant';
      if (role !== 'user' && role !== 'assistant' && role !== 'system') {
        return null;
      }
      let kind = typeof message.kind === 'string' ? message.kind : 'text';
      const content =
        typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
      if (isSystemMessage(message)) {
        kind = 'system';
      }
      const createdAt = message.createdAt ?? '';
      return {
        id: message.id ?? `msg-${index}`,
        role,
        kind,
        content,
        createdAt,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  const adminUser = await requireAdminUser();
  const resolvedParams = await params;
  const sessionId = resolvedParams?.sessionId ? decodeURIComponent(resolvedParams.sessionId) : '';

  const session = sessionId
    ? await prisma.chatSessionRecord.findUnique({
        where: { id: sessionId },
        include: { user: { select: { email: true } } },
      })
    : null;

  if (!session) {
    return (
      <AdminShell title="会话不存在" adminUser={adminUser}>
        <div style={{ padding: '24px 0', color: '#6b7280' }}>未找到该会话。</div>
      </AdminShell>
    );
  }

  const messages = normalizeMessages(session.messages);
  const runtime = decodeAdminSessionRuntime(session.runtime);

  return (
    <AdminShell title="会话详情" headerPrefix={<BackButton />} adminUser={adminUser}>
      <SessionDetailView
        session={{
          id: session.id,
          title: session.title,
          userEmail: session.user.email,
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
