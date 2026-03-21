import type { ChatSessionResponse } from '@mianshitong/shared';
import { getCurrentUserId } from '@/lib/server/auth-session';
import { setUserSessionPinnedState } from '@/lib/server/chat-session-pin-repository';
import { renameUserSession } from '@/lib/server/chat-session-rename-repository';
import { deleteUserSession, getUserSession } from '@/lib/server/chat-session-repository';

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
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const session = await getUserSession(userId, sessionId);

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
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const input = isRecord(body) ? body : {};
  const title = normalizeTitle(input.title);
  const pinned = typeof input.pinned === 'boolean' ? input.pinned : null;
  const { sessionId } = await context.params;

  const session =
    title !== null
      ? await renameUserSession(userId, sessionId, title)
      : pinned !== null
        ? await setUserSessionPinnedState(userId, sessionId, pinned)
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
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const deleted = await deleteUserSession(userId, sessionId);
  if (!deleted) {
    return Response.json({ message: 'Session not found' }, { status: 404 });
  }

  return Response.json({ ok: true });
}
