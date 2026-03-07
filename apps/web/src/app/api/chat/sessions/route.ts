import {
  MODEL_OPTIONS,
  type ChatSessionResponse,
  type ChatSessionsResponse,
  type CreateSessionInput,
} from '@mianshitong/shared';
import { getCurrentUserId } from '@/lib/server/auth-session';
import {
  createUserSession,
  deleteAllUserSessions,
  listUserSessionSummaries,
} from '@/lib/server/chat-session-repository';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isModelId(value: unknown): value is (typeof MODEL_OPTIONS)[number]['id'] {
  return MODEL_OPTIONS.some((item) => item.id === value);
}

export async function GET(): Promise<Response> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const payload: ChatSessionsResponse = {
    sessions: await listUserSessionSummaries(userId),
  };

  return Response.json(payload);
}

export async function POST(request: Request): Promise<Response> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const input = isRecord(body) ? body : {};
  const session = await createUserSession(userId, {
    title: typeof input.title === 'string' ? input.title : undefined,
    modelId: isModelId(input.modelId) ? input.modelId : undefined,
    isPrivate: typeof input.isPrivate === 'boolean' ? input.isPrivate : undefined,
    config: isRecord(input.config) ? (input.config as CreateSessionInput['config']) : undefined,
  });

  const payload: ChatSessionResponse = { session };
  return Response.json(payload, { status: 201 });
}

export async function DELETE(): Promise<Response> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const deletedCount = await deleteAllUserSessions(userId);
  return Response.json({ ok: true, deletedCount });
}
