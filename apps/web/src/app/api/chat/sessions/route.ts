import {
  MODEL_OPTIONS,
  type ChatSessionResponse,
  type ChatSessionsResponse,
  type CreateSessionInput,
} from '@mianshitong/shared';
import { getCurrentChatActor } from '@/lib/server/chat-actor';
import {
  createActorSession,
  deleteAllActorSessions,
  listActorSessionSummaries,
} from '@/lib/server/chat-session-repository';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isModelId(value: unknown): value is (typeof MODEL_OPTIONS)[number]['id'] {
  return MODEL_OPTIONS.some((item) => item.id === value);
}

export async function GET(): Promise<Response> {
  const actor = await getCurrentChatActor({ createGuest: true });
  if (!actor) {
    return Response.json({ message: '无法初始化会话身份' }, { status: 500 });
  }

  const payload: ChatSessionsResponse = {
    sessions: await listActorSessionSummaries(actor.id),
  };

  return Response.json(payload);
}

export async function POST(request: Request): Promise<Response> {
  const actor = await getCurrentChatActor({ createGuest: true });
  if (!actor) {
    return Response.json({ message: '无法初始化会话身份' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const input = isRecord(body) ? body : {};
  const session = await createActorSession(
    actor.id,
    {
      title: typeof input.title === 'string' ? input.title : undefined,
      modelId: isModelId(input.modelId) ? input.modelId : undefined,
      isPrivate: typeof input.isPrivate === 'boolean' ? input.isPrivate : undefined,
      config: isRecord(input.config) ? (input.config as CreateSessionInput['config']) : undefined,
    },
    undefined,
    actor.authUserId,
  );

  const payload: ChatSessionResponse = { session };
  return Response.json(payload, { status: 201 });
}

export async function DELETE(): Promise<Response> {
  const actor = await getCurrentChatActor({ createGuest: true });
  if (!actor) {
    return Response.json({ message: '无法初始化会话身份' }, { status: 500 });
  }

  const deletedCount = await deleteAllActorSessions(actor.id);
  return Response.json({ ok: true, deletedCount });
}
