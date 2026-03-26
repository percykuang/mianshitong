import type { ChatSessionResponse } from '@mianshitong/shared';
import { getCurrentChatActor } from '@/lib/server/chat-actor';
import { setActorSessionPinnedState } from '@/lib/server/chat-session-pin-repository';
import { renameActorSession } from '@/lib/server/chat-session-rename-repository';
import { deleteActorSession, getActorSession } from '@/lib/server/chat-session-repository';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeTitle(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const title = value.replace(/\s+/g, ' ').trim();
  return title || null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const actor = await getCurrentChatActor({ createGuest: true });
  if (!actor) {
    return Response.json({ message: '无法初始化会话身份' }, { status: 500 });
  }

  const { sessionId } = await context.params;
  const session = await getActorSession(actor.id, sessionId);

  if (!session) {
    return Response.json({ message: 'Session not found' }, { status: 404 });
  }

  const payload: ChatSessionResponse = { session };
  return Response.json(payload);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const actor = await getCurrentChatActor({ createGuest: true });
  if (!actor) {
    return Response.json({ message: '无法初始化会话身份' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const input = isRecord(body) ? body : {};
  const title = normalizeTitle(input.title);
  const pinned = typeof input.pinned === 'boolean' ? input.pinned : null;
  const { sessionId } = await context.params;

  const session =
    title !== null
      ? await renameActorSession(actor.id, sessionId, title)
      : pinned !== null
        ? await setActorSessionPinnedState(actor.id, sessionId, pinned)
        : null;

  if (!session) {
    return Response.json(
      { message: title === null && pinned === null ? '请求参数无效' : 'Session not found' },
      { status: title === null && pinned === null ? 400 : 404 },
    );
  }

  const payload: ChatSessionResponse = { session };
  return Response.json(payload);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const actor = await getCurrentChatActor({ createGuest: true });
  if (!actor) {
    return Response.json({ message: '无法初始化会话身份' }, { status: 500 });
  }

  const { sessionId } = await context.params;
  const deleted = await deleteActorSession(actor.id, sessionId);
  if (!deleted) {
    return Response.json({ message: 'Session not found' }, { status: 404 });
  }

  return Response.json({ ok: true });
}
